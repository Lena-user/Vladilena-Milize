const store = require('../platform/db');
const { rulesFor, vnToday } = require('../platform/request-rules');
const schedule = require('./schedule'); // lịch làm việc của người (một nguồn)
const { leaveDates } = require('./leave-days'); // ngày nghỉ phép năm thực sự trừ phép

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

// Lịch ước tính chỉ chứa các trường người dùng được khai tay.
async function estimateSheet(username?, month?) {
  const sheet = await store.getSheet(username, month);
  return { ...sheet, days: estimateDays(sheet.days) };
}

// hai ngày giáp ranh của tháng: ngày cuối tháng trước và ngày 1 tháng sau (để kiểm chồng giờ ca đêm qua ranh giới tháng)
async function neighborDays(username?, month?) {
  const [y, m] = month.split('-').map(Number),
    mk = (t?) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
  const pm = mk(new Date(y, m - 2, 1)),
    nm = mk(new Date(y, m, 1));
  const prevLast = `${pm}-${String(new Date(y, m - 1, 0).getDate()).padStart(2, '0')}`,
    nextFirst = `${nm}-01`;
  const out: Record<string, any> = {},
    a = (await estimateSheet(username, pm)).days[prevLast],
    b = (await estimateSheet(username, nm)).days[nextFirst];
  if (a) out[prevLast] = a;
  if (b) out[nextFirst] = b;
  return out;
}

const leaveSummary = async (s?) => {
  const { ledger } = (await rulesFor()).leave;
  const a = ledger(
    s,
    (await leaveDates(s)).filter(d => d <= vnToday()),
    vnToday()
  );
  const { settled, ...rest } = a;
  return { ...rest, balance: a.balance };
};

export = { estimateDays, estimateSheet, leaveDates, neighborDays, leaveSummary, schedule };
