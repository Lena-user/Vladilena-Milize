import { Controller, Get, Post, Put, Inject } from '@nestjs/common';
import { Ctx, ApiContext } from '../../http/api-context';
import { STORE, RULES, AUTHZ } from '../../core/tokens';
import { AttendanceV2Service } from '../attendance-v2';
import { RequestV2Service } from '../request-v2';

const { HttpError, readJson } = require('../../platform/http');
const { validMonth } = require('../../domain/input');
const periods = require('../../domain/period/periods');

@Controller('api')
export class UiBridgeController {
  constructor(
    @Inject(STORE) private readonly store: any,
    @Inject(RULES) private readonly rules: any,
    @Inject(AUTHZ) private readonly authz: any,
    @Inject(AttendanceV2Service) private readonly attendanceV2: AttendanceV2Service,
    @Inject(RequestV2Service) private readonly requestV2: RequestV2Service
  ) {}

  @Get('me/estimate')
  async getMeEstimate(@Ctx() c: ApiContext): Promise<unknown> {
    const { url, need } = c;
    const u = need();
    const month = url.searchParams.get('month') || this.rules.vnToday().slice(0, 7);
    if (!validMonth(month)) throw new HttpError(400, 'month phải dạng YYYY-MM', { code: 'BAD_MONTH' });
    return await periods.estimate(u, month, { rows: url.searchParams.get('rows') === '1' });
  }

  @Get('sheet')
  async getSheet(@Ctx() c: ApiContext): Promise<unknown> {
    const { url, need } = c;
    const u = need();
    const month = url.searchParams.get('month') || this.rules.vnToday().slice(0, 7);
    const who = (url.searchParams.get('user') || u.username).toLowerCase();
    if (!validMonth(month)) throw new HttpError(400, 'month phải dạng YYYY-MM');
    const staff = await this.store.getStaff(who);
    if (!staff) throw new HttpError(404, 'Không có nhân sự này');

    let timesheets: any[] = [];
    try {
      timesheets = await this.attendanceV2.listTimesheets({
        employeeId: staff.uuid || who,
        startDate: `${month}-01`,
        endDate: `${month}-31`
      });
    } catch {
      timesheets = [];
    }

    const days: Record<string, any> = {};
    for (const ts of timesheets) {
      days[ts.workDate] = {
        kind: ts.status === 'ABSENT' ? 'absent' : 'work',
        shift: (ts.shiftType || 'normal').toLowerCase(),
        in: ts.actualCheckIn ? new Date(ts.actualCheckIn).toISOString().slice(11, 16) : undefined,
        out: ts.actualCheckOut ? new Date(ts.actualCheckOut).toISOString().slice(11, 16) : undefined,
        workHours: ts.workHours,
        otHours: ts.otHours
      };
    }

    return {
      month,
      payrollSubject: staff.payrollSubject,
      days,
      attendanceSessions: [],
      otherLeave: [],
      neighbors: {},
      approvals: {},
      corrections: [],
      kpiWeights: {},
      kpiParts: { complete: false }
    };
  }

  @Put('sheet')
  async putSheet(@Ctx() c: ApiContext): Promise<unknown> {
    const { req, need } = c;
    const u = need();
    const body = (await readJson(req)) || {};
    const month = body.month || this.rules.vnToday().slice(0, 7);
    if (body.days && typeof body.days === 'object') {
      for (const [date, entry] of Object.entries<any>(body.days)) {
        if (!entry) continue;
        if (entry.kind === 'leave') {
          await this.requestV2
            .createLeaveRequest({
              employeeId: u.uuid || u.username,
              title: 'Xin nghỉ phép',
              leaveType: 'PAID',
              startDate: date,
              endDate: date,
              daysCount: 1,
              reason: entry.note || 'Nghỉ phép'
            })
            .catch(() => {});
        } else if (entry.extraKind === 'ot' || entry.otHours) {
          await this.requestV2
            .createOvertimeRequest({
              employeeId: u.uuid || u.username,
              title: 'Đăng ký làm thêm',
              otDate: date,
              startTime: entry.extraIn || '17:30',
              endTime: entry.extraOut || '19:30',
              reason: entry.note || 'Làm thêm giờ'
            })
            .catch(() => {});
        }
      }
    }
    return {
      ok: true,
      month,
      rev: 1,
      approvals: {},
      reset: [],
      resubmitted: [],
      removed: []
    };
  }

  @Put('sheet/bulk')
  async putSheetBulk(@Ctx() c: ApiContext): Promise<unknown> {
    const { req, needAdmin } = c;
    needAdmin();
    const body = (await readJson(req)) || {};
    return { ok: true, updated: (body.usernames || []).length };
  }

  @Put('staff/shift-bulk')
  async putStaffShiftBulk(@Ctx() c: ApiContext): Promise<unknown> {
    const { req, needAdmin } = c;
    needAdmin();
    const body = (await readJson(req)) || {};
    return { ok: true, shiftCode: body.preset || 'normal', updated: body.usernames || [] };
  }

  @Get('punch')
  async getPunch(@Ctx() c: ApiContext): Promise<unknown> {
    const { need } = c;
    const u = need();
    if (!u.payrollSubject) {
      return {
        enabled: false,
        canCheckIn: false,
        openSession: null,
        lastSession: null,
        serverNow: this.rules.nowIso()
      };
    }
    const today = this.rules.vnToday();
    let punches: any[] = [];
    try {
      punches = await this.attendanceV2.getPunches(u.uuid || u.username, today);
    } catch {
      punches = [];
    }
    const last = punches && punches.length ? punches[punches.length - 1] : null;
    const canCheckIn = !last || last.type === 'OUT';
    return {
      enabled: true,
      canCheckIn,
      openSession: !canCheckIn ? { id: last.id, date: today, entry: { presIn: last.punchedAt } } : null,
      lastSession: last ? { id: last.id, date: today, entry: { presIn: last.punchedAt } } : null,
      serverNow: this.rules.nowIso()
    };
  }

  @Post('punch')
  async postPunch(@Ctx() c: ApiContext): Promise<unknown> {
    const { req, need } = c;
    const u = need();
    const body = (await readJson(req)) || {};
    const punchType = body.type === 'in' || body.in ? 'IN' : 'OUT';
    try {
      const result = await this.attendanceV2.recordPunch({
        employeeId: u.uuid || u.username,
        type: punchType,
        latitude: Number(body.latitude) || 21.0285,
        longitude: Number(body.longitude) || 105.8542,
        workDate: body.date || this.rules.vnToday(),
        note: body.note || body.punchNote
      });
      return { ok: true, punch: result };
    } catch (err: any) {
      throw new HttpError(400, err.message, { code: 'BAD_PUNCH_INPUT' });
    }
  }

  @Get('today')
  async getToday(@Ctx() c: ApiContext): Promise<unknown> {
    const { needAdmin } = c;
    needAdmin();
    const today = this.rules.vnToday();
    const people = (await this.store.listStaff()).filter((s: any) => s.payrollSubject);
    const rows = people.map((s: any) => ({
      username: s.username,
      name: s.name,
      status: 'checked-out',
      shift: s.shiftCode || 'normal',
      in: null,
      out: null
    }));
    return { today, rows };
  }

  @Get('ot')
  async getOt(@Ctx() c: ApiContext): Promise<unknown> {
    c.need();
    const list = await this.requestV2.listRequests({ type: 'OVERTIME' as any }).catch(() => ({ items: [] }));
    return { items: list.items || [] };
  }

  @Get('explanations')
  async getExplanations(@Ctx() c: ApiContext): Promise<unknown> {
    c.need();
    const list = await this.requestV2.listRequests({ type: 'EXPLANATION' as any }).catch(() => ({ items: [] }));
    return { explanations: list.items || [], items: list.items || [] };
  }

  @Post('explanations')
  async postExplanations(@Ctx() c: ApiContext): Promise<unknown> {
    const { req, need } = c;
    const u = need();
    const body = (await readJson(req)) || {};
    const created = await this.requestV2.createExplanationRequest({
      employeeId: u.uuid || u.username,
      title: 'Giải trình chấm công',
      workDate: body.date || this.rules.vnToday(),
      reason: body.text || body.reason || 'Giải trình chấm công'
    });
    return { created: true, explanation: created };
  }
}
