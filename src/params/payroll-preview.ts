'use strict';
const crypto = require('node:crypto');
const { AsyncList } = require('../shared/async-list');
const store = require('../platform/db');
const Params = require('../engine/payroll-params');
const Engine = require('../engine/payroll-engine');
const KpiScore = require('../engine/kpi-score');
const PayrollCalendar = require('../engine/payroll-calendar');
const paramsStore = require('./store');
const PayTailCalc = require('../engine/pay-tail-calc');
const payEntries = require('../domain/pay-entries');
const LeaveRules = require('../engine/leave');
const { benefitOf } = require('../platform/request-rules');
const { leaveDates } = require('../domain/leave-days');
const { advanceApprovals } = require('../domain/advance');

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTHS_PER_YEAR = 12;
const pad = (n?) => String(n).padStart(2, '0');
const daysIn = (y?, m?) => new Date(Date.UTC(y, m, 0)).getUTCDate();

class PayrollPolicy {
  static tenureContract(startDate?, month?, months?) {
    if (!DATE_RE.test(String(startDate)) || !MONTH_RE.test(String(month)) || !Number.isInteger(months) || months < 0)
      return null;
    const [sy, sm, sd] = startDate.split('-').map(Number);
    const index = sm - 1 + months;
    const dueYear = sy + Math.floor(index / MONTHS_PER_YEAR),
      dueMonth = (index % MONTHS_PER_YEAR) + 1;
    const due = `${dueYear}-${pad(dueMonth)}-${pad(Math.min(sd, daysIn(dueYear, dueMonth)))}`;
    const [y, m] = month.split('-').map(Number);
    return due <= `${month}-${pad(daysIn(y, m))}` ? 'long' : 'short';
  }

  static contractFor(P?, startDate?, month?, fallback?) {
    if (P['tax.contract.basis'] !== 'tenure') return fallback;
    return PayrollPolicy.tenureContract(startDate, month, P['tax.longTermMonths']) || fallback;
  }
}

const ESTIMATE_FIELDS = ['kind', 'shift', 'in', 'out', 'extraKind', 'extraIn', 'extraOut', 'preset', 'breakMin'];
function estimateDays(days?) {
  const out: Record<string, any> = {};
  for (const [date, entry] of Object.entries<any>(days || {})) {
    if (!entry || entry.kind === 'pending') continue;
    out[date] =
      entry.kind === 'work' || entry.kind === 'makeup'
        ? Object.fromEntries(ESTIMATE_FIELDS.filter(key => Object.hasOwn(entry, key)).map(key => [key, entry[key]]))
        : { kind: entry.kind };
    if (typeof entry.punchNote === 'string' && entry.punchNote) out[date].punchNote = entry.punchNote;
    if (entry.kind === 'willmakeup') {
      if (Array.isArray(entry.makeupPlans)) out[date].makeupPlans = entry.makeupPlans;
      else if (typeof entry.makeupDate === 'string' && entry.makeupDate) out[date].makeupDate = entry.makeupDate;
    }
    if (!out[date].extraKind && out[date].extraOut) out[date].extraKind = 'makeup';
  }
  return out;
}

const kpiScoresOut = (row?, rules?) => {
  const units = rules.toUnits(1);
  return Object.fromEntries(
    rules.COMPONENTS.map(c => [c.key, row && row.scores[c.key] != null ? row.scores[c.key] / units : null])
  );
};

async function kpiOf(username?, month?, sheet?, rules?) {
  return {
    method: 'five',
    parts: kpiScoresOut(await store.getKpiScores(username, month), rules),
    pct: sheet.kpiPct,
    amt: sheet.kpiAmt,
    admPct: null,
    admAmt: sheet.kpiAdmAmt
  };
}

const lastDayOf = (month?) => {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
};
const previousMonth = (month?) => {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
};

async function payrollPeople(month?, usernames?, params?) {
  const end = lastDayOf(month);
  const unsetInsured = new Set<any>(await store.repos.staff.usernamesWithUnsetInsured());
  const coverage = params || (await paramsStore.resolve(month)).params;
  const withContract = (s?) => {
    const contract = PayrollPolicy.contractFor(coverage, s.startDate, month, s.contract);
    return contract === s.contract ? s : { ...s, contract };
  };
  const staff = (await store.listStaff())
    .map(withContract)
    .map(s =>
      unsetInsured.has(s.username) ? { ...s, insured: coverage[`insurance.coverage.${s.contract}`] === true } : s
    )
    .filter(s => s.payrollSubject)
    .filter(s => !usernames || usernames.includes(s.username))
    .filter(s => !PayrollCalendar.isValidDate(s.startDate) || s.startDate <= end)
    .filter(s => !PayrollCalendar.isValidDate(s.resignedOn) || s.resignedOn >= `${month}-01`);
  return AsyncList.filter(staff, async s => {
    if (!s.locked) return true;
    return (
      Object.keys((await store.getSheet(s.username, month)).days).length > 0 ||
      (await store.listSessions({ username: s.username, month })).length > 0
    );
  });
}

async function leaveSettlements(month?, staffList?, params?) {
  const out = new Map<any, any>();
  const rules = LeaveRules.create(params);
  for (const staff of staffList) {
    if (!benefitOf(params, staff.type, 'leaveAccount', staff.level) || !PayrollCalendar.isValidDate(staff.startDate))
      continue;
    const days = rules.settlementFor(staff, await leaveDates(staff), month);
    if (days > 0) out.set(staff.username, days);
  }
  return out;
}

async function loadInputs(month?, { usernames, lookbackMonths = 0, asOf, params }: any = {}) {
  if (!PayrollCalendar.isValidMonth(month))
    throw Object.assign(new Error('Tháng phải có dạng YYYY-MM'), { code: 'BAD_MONTH', httpStatus: 400 });
  const holidays = await store.getSetting('holidays', []);
  const when = asOf || new Date(Date.now()).toISOString();
  const kpiRules = KpiScore.create(params || (await paramsStore.resolve(month)).params);
  const entriesOf = await payEntries.approvedByUser(month);
  const advanceOf = await advanceApprovals.approvedSet(month);
  const people = new Map<any, any>();
  const loadParams = params || (await paramsStore.resolve(month)).params;
  const expiryMonth = loadParams['leave.expiry.month'];
  const settlesThisMonth = expiryMonth >= 1 && Number(month.slice(5)) === (expiryMonth % 12) + 1;
  const staffList = await payrollPeople(month, usernames, params);
  const settleOf = settlesThisMonth ? await leaveSettlements(month, staffList, loadParams) : new Map();

  for (const staff of staffList) {
    const sheet = await store.getSheet(staff.username, month);
    const history: Record<string, any> = {};
    let cursor = month;
    for (let i = 0; i < lookbackMonths; i++) {
      cursor = previousMonth(cursor);
      history[cursor] = await store.getSheet(staff.username, cursor);
    }
    people.set(
      staff.username,
      JSON.parse(
        JSON.stringify({
          staff,
          days: estimateDays(sheet.days),
          approvals: await store.approvals.forSheet(staff.username, month),
          sessions: (await store.listSessions({ username: staff.username, month })).map(s => ({
            id: s.id,
            state: s.state,
            date: s.date,
            entry: s.entry
          })),
          kpi: await kpiOf(staff.username, month, sheet, kpiRules),
          ...(entriesOf.has(staff.username) ? { entries: entriesOf.get(staff.username) } : {}),
          ...(advanceOf.has(staff.username) ? { advance: true } : {}),
          ...(settleOf.has(staff.username) ? { leaveSettleDays: settleOf.get(staff.username) } : {}),
          ...(lookbackMonths ? { history } : {})
        })
      )
    );
  }
  const overrides: Record<string, any> = {};
  for (const username of people.keys()) {
    const { values } = await store.getSlipOverride(username, month);
    if (Object.keys(values).length) overrides[username] = values;
  }
  return { month, holidays, asOf: when, people, overrides };
}

const engines = new WeakMap<any, any>();
const engineFor = (params?) => {
  if (!engines.has(params)) engines.set(params, Engine.create(params));
  return engines.get(params);
};

function computeFor(month?, staff?, inputs?, params?, options: any = {}) {
  PayTailCalc.assertAvailable(params);
  const upTo = Object.hasOwn(options, 'upTo') ? options.upTo : null;
  const person = inputs.people.get(staff.username);
  if (!person) throw Object.assign(new Error('Không có đầu vào của người này'), { code: 'NO_INPUT' });
  const input = JSON.parse(
    JSON.stringify({
      staff,
      days: person.days,
      approvals: person.approvals,
      sessions: person.sessions,
      kpi: person.kpi,
      ...(person.entries ? { entries: person.entries } : {}),
      ...(person.advance ? { advanceApproved: true } : {}),
      ...(person.leaveSettleDays ? { leaveSettleDays: person.leaveSettleDays } : {}),
      holidays: inputs.holidays,
      month,
      upTo,
      asOf: inputs.asOf
    })
  );
  if (upTo === undefined) delete input.upTo;
  return engineFor(params).computeMonth(input);
}

const COMPONENTS = Object.freeze([
  { id: 1, key: 'wage', label: 'Lương cơ bản' },
  { id: 2, key: 'overtime', label: 'Tiền làm thêm' },
  { id: 3, key: 'allowance', label: 'Phụ cấp' },
  { id: 4, key: 'kpi', label: 'Lương KPI' },
  { id: 5, key: 'cut', label: 'Trừ đi trễ, về sớm' },
  { id: 6, key: 'advance', label: 'Tạm ứng' },
  { id: 7, key: 'insurance', label: 'Bảo hiểm' },
  { id: 8, key: 'tax', label: 'Thuế TNCN' }
]);

const contextOf = (inputs?: any) => ({ holidays: inputs.holidays, asOf: inputs.asOf });

const digestOf = (inputs?: any) =>
  crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        holidays: inputs.holidays,
        asOf: inputs.asOf,
        people: Array.from(inputs.people.entries()).map(([u, d]) => [u, d]),
        overrides: inputs.overrides
      })
    )
    .digest('hex');

const paramsFor = async (month?: string) => await paramsStore.resolve(month);

const SLIP_KPI_CELLS: Record<string, string> = Object.freeze({
  wework: 'kpi_wework',
  user: 'kpi_user',
  peer: 'kpi_peer',
  manager: 'kpi_manager',
  self: 'kpi_self'
});

async function kpiSlipCells(username?: string, month?: string, params?: any) {
  const rules = KpiScore.create(params || (await paramsStore.resolve(month)).params);
  const row = await store.getKpiScores(username, month);
  const parts = kpiScoresOut(row, rules);
  return Object.fromEntries(rules.COMPONENTS.map((c: any) => [SLIP_KPI_CELLS[c.key], parts[c.key]]));
}

function thanhPhanOf(m?) {
  const t = m.trace;
  const cut = m.cut || 0;
  return {
    wage: t.tienNgayCong + cut + (t.quyetToanPhepDu || 0),
    overtime: t.lamBu + t.tienOt + t.tienLamLe,
    allowance:
      t.phuCapCa +
      t.gioNghiDem +
      t.phuCapDiLai +
      t.phuCapChuyenCan +
      (m.blocks || []).reduce((sum, b) => sum + b.amount, 0),
    kpi: t.luongKpi,
    cut,
    advance: m.net.advance,
    insurance: m.net.insurance,
    tax: m.net.tax
  };
}

export = {
  loadInputs,
  computeFor,
  estimateDays,
  contextOf,
  digestOf,
  paramsFor,
  COMPONENTS,
  thanhPhanOf,
  engineFor,
  lastDayOf,
  previousMonth,
  payrollPeople,
  kpiSlipCells,
  PayrollPolicy
};
