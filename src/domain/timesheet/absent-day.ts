'use strict';
const { rulesFor, vnToday, nowIso } = require('../../platform/request-rules');
const schedule = require('../schedule');
const { estimateSheet } = require('../sheet');

class AbsentDay {
  declare store: any;

  constructor({ store }: any) {
    this.store = store;
  }

  static dayOf(session?) {
    return (session.entry.plannedShift && session.entry.plannedShift.date) || session.date;
  }

  async stateOf(username?, date?) {
    const staff = await this.store.getStaff(username);
    if (!staff || !staff.payrollSubject) return 'other';
    if (date > vnToday()) return 'future';
    const month = date.slice(0, 7);
    const sessions = await this.store.listSessions({ username, month });
    if (sessions.some(s => AbsentDay.dayOf(s) === date && (s.entry.presIn || s.entry.presOut))) return 'punched';
    const holidays = await this.store.getSetting('holidays', []);
    const inService = (!staff.startDate || date >= staff.startDate) && (!staff.resignedOn || date <= staff.resignedOn);
    if (!inService || holidays.includes(date) || !(await schedule.isWorkDay(staff, date))) return 'off-schedule';
    const days = (await estimateSheet(username, month)).days;
    const approvals = await this.store.approvals.forSheet(username, month);
    const leave = days[date];
    const row = approvals[date];
    if (leave?.kind === 'leave' && row?.item === 'leave' && row?.fingerprint === 'leave' && row?.status === 'rejected')
      delete days[date];
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

export = { AbsentDay, explainedByUser };
