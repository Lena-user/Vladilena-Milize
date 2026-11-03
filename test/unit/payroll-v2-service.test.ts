import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PayrollV2Service } from '../../src/domain/payroll-v2/payroll-v2-service';
import { PayrollV2Repository, EmployeeMonthlyRawData } from '../../src/data/payroll-v2.repository';
import { PayrollV2Controller } from '../../src/modules/payroll-v2/payroll-v2.controller';

class MockPayrollV2Repository extends PayrollV2Repository {
  private data: Map<string, EmployeeMonthlyRawData> = new Map();

  constructor() {
    super(null as any);
  }

  setMonthlyData(employeeId: string, month: string, rawData: EmployeeMonthlyRawData): void {
    this.data.set(`${employeeId}:${month}`, rawData);
  }

  override async getMonthlyData(employeeId: string, month: string): Promise<EmployeeMonthlyRawData | null> {
    return this.data.get(`${employeeId}:${month}`) ?? null;
  }

  override async listEligibleEmployees(): Promise<Array<{ uuid: string; username: string; name: string }>> {
    return Array.from(this.data.values()).map(d => ({
      uuid: d.staff.uuid,
      username: d.staff.username,
      name: d.staff.name
    }));
  }
}

describe('Payroll V2 Service Integration', () => {
  const EMP_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  const MONTH = '2026-10';

  it('generates monthly EmployeePayslip matching canonical GFT October 2026 values', async () => {
    const repo = new MockPayrollV2Repository();
    const service = new PayrollV2Service(repo);

    // Mock raw data matching the GFT October 2026 Canonical Sample:
    // - 24 work days (18 normal, 3 flex, 3 night)
    // - 1 paid leave day, 1 iSAT day, 1 unpaid leave day
    // - 1 approved OT request of 5 hours (x2.0)
    // - 2 days with late arrivals: 15m and 20m (total 35m = 0.58h)
    // - 1 approved advance request of 2,025,000 VND
    // - Position: NV Bậc 1, Base salary 6,000,000 VND, 26 standard workdays
    // - KPI score: 85.6% (Wework 85, User 90, Peer 80, Manager 85, Self 90)

    const timesheets: EmployeeMonthlyRawData['timesheets'] = [];

    // 18 Normal days (no late, 8h)
    for (let i = 1; i <= 18; i++) {
      const date = `2026-10-${String(i).padStart(2, '0')}`;
      const isLateDay1 = i === 5;
      const isLateDay2 = i === 10;
      timesheets.push({
        workDate: date,
        shiftType: 'NORMAL',
        shiftStartTime: '08:00',
        shiftEndTime: '17:00',
        shiftAllowancePct: 0,
        actualCheckIn: isLateDay1 ? '08:15' : isLateDay2 ? '08:20' : '08:00',
        actualCheckOut: '17:00',
        workHours: 8,
        otHours: 0,
        lateMinutes: isLateDay1 ? 15 : isLateDay2 ? 20 : 0,
        earlyMinutes: 0,
        status: 'PRESENT',
        dayStatus: 'VALID'
      });
    }

    // 3 Flex days
    for (let i = 19; i <= 21; i++) {
      timesheets.push({
        workDate: `2026-10-${String(i).padStart(2, '0')}`,
        shiftType: 'FLEX',
        shiftStartTime: '08:00',
        shiftEndTime: '17:00',
        shiftAllowancePct: 20,
        actualCheckIn: '08:00',
        actualCheckOut: '17:00',
        workHours: 8,
        otHours: 0,
        lateMinutes: 0,
        earlyMinutes: 0,
        status: 'PRESENT',
        dayStatus: 'VALID'
      });
    }

    // 3 Night days
    for (let i = 22; i <= 24; i++) {
      timesheets.push({
        workDate: `2026-10-${String(i).padStart(2, '0')}`,
        shiftType: 'NIGHT',
        shiftStartTime: '22:00',
        shiftEndTime: '06:00',
        shiftAllowancePct: 40,
        actualCheckIn: '22:00',
        actualCheckOut: '06:00',
        workHours: 8,
        otHours: 0,
        lateMinutes: 0,
        earlyMinutes: 0,
        status: 'PRESENT',
        dayStatus: 'VALID'
      });
    }

    // 1 Paid leave day
    timesheets.push({
      workDate: '2026-10-25',
      shiftType: 'LEAVE',
      shiftStartTime: '08:00',
      shiftEndTime: '17:00',
      shiftAllowancePct: 0,
      actualCheckIn: null,
      actualCheckOut: null,
      workHours: 8,
      otHours: 0,
      lateMinutes: 0,
      earlyMinutes: 0,
      status: 'LEAVE_PAID',
      dayStatus: 'VALID'
    });

    // 1 iSAT day
    timesheets.push({
      workDate: '2026-10-26',
      shiftType: 'ISAT',
      shiftStartTime: '08:00',
      shiftEndTime: '17:00',
      shiftAllowancePct: 0,
      actualCheckIn: null,
      actualCheckOut: null,
      workHours: 8,
      otHours: 0,
      lateMinutes: 0,
      earlyMinutes: 0,
      status: 'PRESENT',
      dayStatus: 'VALID'
    });

    // 1 Unpaid leave day
    timesheets.push({
      workDate: '2026-10-27',
      shiftType: 'UNPAID',
      shiftStartTime: '08:00',
      shiftEndTime: '17:00',
      shiftAllowancePct: 0,
      actualCheckIn: null,
      actualCheckOut: null,
      workHours: 0,
      otHours: 0,
      lateMinutes: 0,
      earlyMinutes: 0,
      status: 'LEAVE_UNPAID',
      dayStatus: 'VALID'
    });

    repo.setMonthlyData(EMP_ID, MONTH, {
      staff: {
        uuid: EMP_ID,
        username: 'thaott',
        name: 'Trần Thị Thu Thảo',
        positionLevelText: 'NV · Bậc 1',
        contractStatusText: 'HĐLĐ từ 3 tháng',
        baseSalary: 6000000,
        standardWorkdays: 26,
        kpiMaxSalary: 6000000,
        remainingAnnualLeaveDays: 22
      },
      timesheets,
      requests: [
        // 1 Approved OT request (5 hours)
        {
          id: 'req-ot-1',
          type: 'OVERTIME',
          status: 'APPROVED',
          otDate: '2026-10-15',
          otHours: 5
        },
        // 1 Approved advance request
        {
          id: 'req-adv-1',
          type: 'ADVANCE',
          status: 'APPROVED',
          advanceAmount: 2025000,
          advancePeriod: '2026-10'
        }
      ],
      kpiScore: {
        wework: 85,
        user: 90,
        peer: 80,
        manager: 85,
        self: 90
      }
    });

    const payslip = await service.generateMonthlyPayslip(EMP_ID, MONTH);

    // Verify all monthly values match Page 1 & Page 2 Canonical figures
    assert.equal(payslip.actualWorkDays, 24);
    assert.equal(payslip.baseSalaryActual, 5538462);
    assert.equal(payslip.paidLeavePay, 230769);
    assert.equal(payslip.isatPay, 230769);
    assert.equal(payslip.otPayTotal, 288462);
    assert.equal(payslip.totalAllowanceActual, 2743269);
    assert.equal(payslip.kpiActualPay, 5136000);
    assert.equal(payslip.lateEarlyDeductionAmount, -16827);
    assert.equal(payslip.grossIncome, 14150904);
    assert.equal(payslip.insuranceDeduction, 630000);
    assert.equal(payslip.advanceDeduction, 2025000);
    assert.equal(payslip.netIncome, 11495904);
    assert.equal(payslip.remainingAnnualLeaveDays, 22);
  });

  it('PayrollV2Controller handles calculation, single payslip, and period listing endpoints', async () => {
    const repo = new MockPayrollV2Repository();
    const service = new PayrollV2Service(repo);
    const controller = new PayrollV2Controller(service);

    repo.setMonthlyData(EMP_ID, MONTH, {
      staff: {
        uuid: EMP_ID,
        username: 'thaott',
        name: 'Trần Thị Thu Thảo',
        positionLevelText: 'NV · Bậc 1',
        contractStatusText: 'HĐLĐ từ 3 tháng',
        baseSalary: 6000000,
        standardWorkdays: 26,
        kpiMaxSalary: 6000000,
        remainingAnnualLeaveDays: 22
      },
      timesheets: [],
      requests: []
    });

    // 1. GET single payslip
    const mockCtx = { req: {}, seg: ['', 'api', 'v2', 'payroll', MONTH, EMP_ID] } as any;
    const singleRes = (await controller.getEmployeePayslip(mockCtx, MONTH, EMP_ID)) as any;
    assert.ok(singleRes.payslip);
    assert.equal(singleRes.month, MONTH);
    assert.equal(singleRes.payslip.employeeId, EMP_ID);

    // 2. POST calculate single employee
    const calcEmpRes = (await controller.calculateEmployee(mockCtx, MONTH, EMP_ID)) as any;
    assert.equal(calcEmpRes.calculated, true);
    assert.equal(calcEmpRes.payslip.employeeId, EMP_ID);

    // 3. POST calculate period
    const calcPeriodRes = (await controller.calculatePeriod(mockCtx, MONTH)) as any;
    assert.equal(calcPeriodRes.calculated, true);
    assert.equal(calcPeriodRes.count, 1);
    assert.equal(calcPeriodRes.items[0].employeeId, EMP_ID);

    // 4. GET period summaries
    const summaryRes = (await controller.getPeriodSummary(mockCtx, MONTH)) as any;
    assert.equal(summaryRes.total, 1);
    assert.equal(summaryRes.items[0].employeeId, EMP_ID);
  });
});
