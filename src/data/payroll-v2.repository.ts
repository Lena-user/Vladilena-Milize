import type { Kysely } from 'kysely';
import type { Schema } from './schema.generated';

export interface EmployeeMonthlyRawData {
  staff: {
    uuid: string;
    username: string;
    name: string;
    positionLevelText: string;
    contractStatusText: string;
    baseSalary: number;
    standardWorkdays: number;
    kpiMaxSalary?: number;
    remainingAnnualLeaveDays?: number;
  };
  timesheets: Array<{
    workDate: string;
    shiftType: string;
    shiftStartTime: string;
    shiftEndTime: string;
    shiftAllowancePct: number;
    actualCheckIn?: string | null;
    actualCheckOut?: string | null;
    workHours: number;
    otHours: number;
    lateMinutes: number;
    earlyMinutes: number;
    status: string;
    dayStatus: string;
  }>;
  requests: Array<{
    id: string;
    type: string;
    status: string;
    correctionDate?: string | null;
    leaveStartDate?: string | null;
    leaveEndDate?: string | null;
    leaveType?: string | null;
    otDate?: string | null;
    otHours?: number | null;
    advanceAmount?: number | bigint | null;
    advancePeriod?: string | null;
  }>;
  kpiScore?: {
    wework: number;
    user: number;
    peer: number;
    manager: number;
    self: number;
  } | null;
}

export class PayrollV2Repository {
  constructor(private readonly qb: Kysely<Schema>) {}

  async getMonthlyData(employeeId: string, month: string): Promise<EmployeeMonthlyRawData | null> {
    if (!this.qb) return null;

    // Query staff
    const staffRow = await this.qb
      .selectFrom('staff')
      .selectAll()
      .where(eb => eb.or([eb('uuid', '=', employeeId), eb('username', '=', employeeId)]))
      .executeTakeFirst();

    if (!staffRow) return null;

    // Position level
    const positionRow = await this.qb
      .selectFrom('position_levels')
      .selectAll()
      .where('type_code', '=', staffRow.type || 'nv')
      .where('level_no', '=', staffRow.level || 1)
      .executeTakeFirst();

    const baseSalary = positionRow?.base_salary ?? 6000000;
    const kpiMaxSalary = positionRow?.kpi_max ? Number(positionRow.kpi_max) : baseSalary;

    // Timesheet entries
    const startDate = `${month}-01`;
    const endDate = `${month}-31`;
    const timesheetRows = await this.qb
      .selectFrom('timesheet_entries')
      .selectAll()
      .where('employee_id', '=', staffRow.uuid || employeeId)
      .where('work_date', '>=', startDate)
      .where('work_date', '<=', endDate)
      .orderBy('work_date', 'asc')
      .execute();

    // Requests
    const requestRows = await this.qb
      .selectFrom('system_requests')
      .selectAll()
      .where('employee_id', '=', staffRow.uuid || employeeId)
      .where('status', '=', 'APPROVED')
      .execute();

    // KPI scores
    const kpiRow = await this.qb
      .selectFrom('kpi_scores')
      .selectAll()
      .where('username', '=', staffRow.username)
      .where('month', '=', month)
      .executeTakeFirst();

    return {
      staff: {
        uuid: staffRow.uuid || employeeId,
        username: staffRow.username,
        name: staffRow.name,
        positionLevelText: positionRow?.name || `${(staffRow.type || 'NV').toUpperCase()} · Bậc ${staffRow.level || 1}`,
        contractStatusText: staffRow.contract_status || 'HĐLĐ từ 3 tháng',
        baseSalary,
        standardWorkdays: 26,
        kpiMaxSalary,
        remainingAnnualLeaveDays: 22
      },
      timesheets: timesheetRows.map(r => ({
        workDate: r.work_date,
        shiftType: r.shift_type,
        shiftStartTime: r.shift_start_time,
        shiftEndTime: r.shift_end_time,
        shiftAllowancePct: Number(r.shift_allowance_pct),
        actualCheckIn: r.actual_check_in instanceof Date ? r.actual_check_in.toISOString() : r.actual_check_in,
        actualCheckOut: r.actual_check_out instanceof Date ? r.actual_check_out.toISOString() : r.actual_check_out,
        workHours: Number(r.work_hours),
        otHours: Number(r.ot_hours),
        lateMinutes: Number(r.late_minutes),
        earlyMinutes: Number(r.early_minutes),
        status: r.status,
        dayStatus: r.day_status
      })),
      requests: requestRows.map(r => ({
        id: r.id,
        type: r.type,
        status: r.status,
        correctionDate: r.correction_date,
        leaveStartDate: r.leave_start_date,
        leaveEndDate: r.leave_end_date,
        leaveType: r.leave_type,
        otDate: r.ot_date,
        otHours: r.ot_hours !== null ? Number(r.ot_hours) : null,
        advanceAmount: r.advance_amount,
        advancePeriod: r.advance_period
      })),
      kpiScore: kpiRow ? {
        wework: Number(kpiRow.wework ?? 0),
        user: Number(kpiRow.user_score ?? 0),
        peer: Number(kpiRow.peer ?? 0),
        manager: Number(kpiRow.manager ?? 0),
        self: Number(kpiRow.self_score ?? 0)
      } : null
    };
  }
}
