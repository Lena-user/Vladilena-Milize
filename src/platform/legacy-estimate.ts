'use strict';
const store = require('./db');
const { rulesFor, vnToday, nowIso } = require('./request-rules');
const schedule = require('../domain/schedule');

const ESTIMATE_FIELDS = ['kind', 'shift', 'in', 'out', 'extraKind', 'extraIn', 'extraOut', 'preset', 'breakMin'];

function estimateDays(days?: Record<string, any>) {
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

async function estimateSheet(username?: string, month?: string) {
  const sheet = await store.getSheet(username, month);
  return { ...sheet, days: estimateDays(sheet.days) };
}

class AbsentDay {
  declare store: any;

  constructor({ store }: any) {
    this.store = store;
  }

  static dayOf(session?: any) {
    return (session.entry.plannedShift && session.entry.plannedShift.date) || session.date;
  }

  async stateOf(username?: string, date?: string) {
    const staff = await this.store.getStaff(username);
    if (!staff || !staff.payrollSubject) return 'other';
    if (date! > vnToday()) return 'future';
    const month = date!.slice(0, 7);
    const sessions = await this.store.listSessions({ username, month });
    if (sessions.some((s: any) => AbsentDay.dayOf(s) === date && (s.entry.presIn || s.entry.presOut))) return 'punched';
    const holidays = await this.store.getSetting('holidays', []);
    const inService = (!staff.startDate || date! >= staff.startDate) && (!staff.resignedOn || date! <= staff.resignedOn);
    if (!inService || holidays.includes(date) || !(await schedule.isWorkDay(staff, date))) return 'off-schedule';
    const days = (await estimateSheet(username, month)).days;
    const approvals = await this.store.approvals.forSheet(username, month);
    const leave = days[date!];
    const row = approvals[date!];
    if (leave?.kind === 'leave' && row?.item === 'leave' && row?.fingerprint === 'leave' && row?.status === 'rejected')
      delete days[date!];
    const { absent } = (await rulesFor(month)).actualHours.apply(days, sessions, {
      asOf: nowIso(),
      staff,
      holidays,
      month
    });
    return absent.includes(date) ? 'absent' : 'other';
  }
}

const explainedByUser = async (_month?: string): Promise<Map<string, Set<string>>> => new Map();

// Compatibility shim for legacy session lookups during V2 migration.
const closeStale = async (_staff?: any) => {};
const closeStaleFor = async (_people?: any) => {};
const closeStaleIn = async (_month?: any, _names?: any) => {};
const sessionsFor = async (_filter?: any): Promise<any[]> => [];

function toMin(time?: string) {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function spanH(tin?: string, tout?: string) {
  const a = toMin(tin);
  const b = toMin(tout);
  let diff = b - a;
  if (diff <= 0) diff += 1440;
  return diff / 60;
}

function extraOtHours(x?: any) {
  return x.extraKind === 'ot' && x.in && x.out
    ? (x.extraIn ? spanH(x.extraIn, x.in) : 0) + (x.extraOut ? spanH(x.out, x.extraOut) : 0)
    : 0;
}

function estimateOtHours(x?: any) {
  return x.in && x.out ? extraOtHours(x) : 0;
}

function actualOtHours(x?: any) {
  return !x.otReview || x.otReview.ok ? extraOtHours(x) : 0;
}

async function estimateHolidayOtHours(days?: any, holidays?: any, month?: string) {
  const payrollCalendar = (await rulesFor(month)).calendar;
  return Object.entries<any>(days).reduce(
    (sum: number, [date, x]: any) =>
      sum +
      estimateOtHours(x) +
      (x.kind === 'work' && x.in && x.out ? payrollCalendar.splitMainWork(x, date, holidays).holidayH : 0),
    0
  );
}

async function actualHolidayOtHours(rows?: any, holidays?: any, month?: string) {
  const payrollCalendar = (await rulesFor(month)).calendar;
  const holidayShifts = new Map<any, any>();
  for (const s of rows)
    if (s.state === 'closed' && s.entry.attendanceConfirmed && s.entry.kind === 'work') {
      const p = s.entry.plannedShift;
      if (!p || !p.date || !p.in || !p.out) continue;
      const key = `${p.date}|${p.in}|${p.out}`;
      if (!holidayShifts.has(key)) holidayShifts.set(key, { ...p, kind: 'work' });
    }
  return (
    rows.reduce((sum: number, s: any) => sum + (s.state === 'closed' ? actualOtHours(s.entry) : 0), 0) +
    Array.from(holidayShifts.entries()).reduce(
      (sum, [k, p]) => sum + payrollCalendar.splitMainWork(p, p.date, holidays).holidayH,
      0
    )
  );
}

class OtLimits {
  #monthCap: number;
  constructor({ monthCap }: { monthCap: number }) {
    this.#monthCap = monthCap;
  }
  static of(params: any = {}) {
    return new OtLimits({ monthCap: params['law.ceiling.otMonthHours'] ?? 40 });
  }
  get monthCap() {
    return this.#monthCap;
  }
}

const formulasOf = (_args?: any) => ({});
const legacyExplanations = {
  heldByUser: async (_month?: string) => new Map<string, any[]>(),
  explainedByUser: async (_month?: string) => new Map<string, Set<string>>()
};

export = {
  estimateDays,
  estimateSheet,
  AbsentDay,
  explainedByUser,
  closeStale,
  closeStaleFor,
  closeStaleIn,
  sessionsFor,
  actualOtHours,
  estimateHolidayOtHours,
  actualHolidayOtHours,
  OtLimits,
  formulasOf,
  explanations: legacyExplanations
};
