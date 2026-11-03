// Session persistence is separate from salary estimates and the immutable punch log.
const { AttendanceSessionsRepository } = require('../data');
const { AsyncList } = require('../shared/async-list');
const P = require('../engine/punch');
const { DEFAULTS } = require('../engine/payroll-params');

const scheduleOfType = (type?) => {
  const key = `type.${type}.dows`;
  return [...(Object.hasOwn(DEFAULTS, key) ? DEFAULTS[key] : DEFAULTS['type.nv.dows'])];
};

const ADMIN_ORIGIN = 'sheet.onBehalf';
module.exports = function sessionStore(db, { bootFail, transaction, queryBuilder }: any) {
  const sessionsRepo = new AttendanceSessionsRepository(queryBuilder);

  const now = () => new Date(Date.now()).toISOString();
  const row = (r?) =>
    r
      ? {
          id: r.id,
          sessionId: r.id,
          username: r.username,
          date: r.date,
          state: r.state,
          entry: JSON.parse(r.entry_json),
          version: r.version,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        }
      : null;
  const api = {
    sessionsRepo,
    getSession: async (id?) => row(await sessionsRepo.find(id)),
    openSession: async (u?) => row(await sessionsRepo.open(u)),
    lastSession: async (u?) => row(await sessionsRepo.last(u, ADMIN_ORIGIN, now())),
    async listSessions({ username, month, date, includeScheduled = false }: any = {}) {
      const hide = includeScheduled ? null : { origin: ADMIN_ORIGIN, nowIso: now() };
      return (await sessionsRepo.list({ username, month, date }, hide)).map(row);
    },
    async createSession(u?, date?, state?, entry?, legacyKey: any = null, createdAt = now(), updatedAt = createdAt) {
      const id = await sessionsRepo.insert({
        username: u,
        date,
        state,
        entry_json: JSON.stringify(entry),
        legacy_key: legacyKey,
        created_at: createdAt,
        updated_at: updatedAt
      });
      return await api.getSession(id);
    },
    async updateSession(id, version, { date, state, entry }: any) {
      const changed = await sessionsRepo.update(id, version, {
        date,
        state,
        entryJson: JSON.stringify(entry),
        at: now()
      });
      return changed ? await api.getSession(id) : null;
    },
    sessionPunches: async (id?) =>
      (await sessionsRepo.punchesOf(id)).map(p => ({
        ...p,
        ts: p.at,
        context: p.context_json ? JSON.parse(p.context_json) : null
      })),
    getPunchRequest: async (u?, id?) => await sessionsRepo.punchRequest(u, id),
    async savePunchRequest(u?, id?, operation?, sid?, response?) {
      await sessionsRepo.savePunchRequest({
        username: u,
        request_id: id,
        operation,
        session_id: sid ?? null,
        response_json: JSON.stringify(response),
        created_at: now()
      });
    },
    async purgePunchRequests(olderThanDays?) {
      const days = Number(olderThanDays);
      if (!Number.isFinite(days) || !(days > 0)) throw new Error('purgePunchRequests cần số ngày lớn hơn 0');
      const cutoff = new Date(Date.now() - days * DEFAULTS['unit.msPerDay']).toISOString();
      return await transaction(async () => await sessionsRepo.purgePunchRequests(cutoff));
    }
  };

  return api;
};
module.exports.ADMIN_ORIGIN = ADMIN_ORIGIN;
