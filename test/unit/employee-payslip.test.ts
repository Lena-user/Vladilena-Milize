import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EmployeePayslip, DailyAttendanceLineProps } from '../../src/domain/payroll-v2';

describe('Payroll V2 - EmployeePayslip Domain Model', () => {
  // Canonical GFT October 2026 Sample Data (Phiếu lương mẫu GFT Tháng 10/2026)
  const sampleDailyLines: DailyAttendanceLineProps[] = [
    // 18 Normal work days (8h each, on time)
    ...Array.from({ length: 18 }, (_, i) => ({
      date: `2026-10-${String(i + 1).padStart(2, '0')}`,
      dayOfWeekText: 'Thứ 2 - Thứ 6',
      shiftCode: 'NORMAL',
      shiftLabel: 'Normal',
      inOutText: '08:00–17:00',
      workHours: 8,
      daySalary: 230769,
      flexAllowancePay: 0,
      nightAllowancePay: 0,
      offPaidPay: 0,
      otHours: 0,
      otPay: 0,
      deductionHours: 0,
      deductionAmount: 0,
      dailyTotal: 230769
    })),
    // 3 Flex shifts (+20% allowance = 46,154/day)
    ...Array.from({ length: 3 }, (_, i) => ({
      date: `2026-10-${String(i + 19).padStart(2, '0')}`,
      dayOfWeekText: 'Thứ 2 - Thứ 6',
      shiftCode: 'FLEX',
      shiftLabel: 'Flex +20%',
      inOutText: '08:00–17:00',
      workHours: 8,
      daySalary: 230769,
      flexAllowancePay: 46154,
      nightAllowancePay: 0,
      offPaidPay: 0,
      otHours: 0,
      otPay: 0,
      deductionHours: 0,
      deductionAmount: 0,
      dailyTotal: 230769 + 46154
    })),
    // 3 Night shifts (+40% allowance = 92,308/day, Off Paid = 37,500/day)
    ...Array.from({ length: 3 }, (_, i) => ({
      date: `2026-10-${String(i + 22).padStart(2, '0')}`,
      dayOfWeekText: 'Thứ 2 - Thứ 6',
      shiftCode: 'NIGHT',
      shiftLabel: 'Night +40%',
      inOutText: '22:00–06:00',
      workHours: 8,
      daySalary: 230769,
      flexAllowancePay: 0,
      nightAllowancePay: 92308,
      offPaidPay: 37500,
      otHours: 0,
      otPay: 0,
      deductionHours: 0,
      deductionAmount: 0,
      dailyTotal: 230769 + 92308 + 37500
    })),
    // 1 Paid leave day
    {
      date: '2026-10-25',
      dayOfWeekText: 'Chủ nhật / Nghỉ phép',
      shiftCode: 'LEAVE',
      shiftLabel: 'Nghỉ phép',
      inOutText: 'Hưởng lương ngày',
      workHours: 8,
      daySalary: 230769,
      flexAllowancePay: 0,
      nightAllowancePay: 0,
      offPaidPay: 0,
      otHours: 0,
      otPay: 0,
      deductionHours: 0,
      deductionAmount: 0,
      dailyTotal: 230769
    },
    // 1 iSAT day (Saturday duty)
    {
      date: '2026-10-26',
      dayOfWeekText: 'Thứ 7 iSAT',
      shiftCode: 'ISAT',
      shiftLabel: 'iSAT',
      inOutText: 'Hưởng lương ngày',
      workHours: 8,
      daySalary: 230769,
      flexAllowancePay: 0,
      nightAllowancePay: 0,
      offPaidPay: 0,
      otHours: 0,
      otPay: 0,
      deductionHours: 0,
      deductionAmount: 0,
      dailyTotal: 230769
    },
    // 1 Unpaid leave day
    {
      date: '2026-10-27',
      dayOfWeekText: 'Thứ 3',
      shiftCode: 'UNPAID',
      shiftLabel: 'Không lương',
      inOutText: 'Không tính lương',
      workHours: 0,
      daySalary: 0,
      flexAllowancePay: 0,
      nightAllowancePay: 0,
      offPaidPay: 0,
      otHours: 0,
      otPay: 0,
      deductionHours: 0,
      deductionAmount: 0,
      dailyTotal: 0
    }
  ];

  it('matches 100% of the canonical GFT October 2026 payslip numbers down to 1 VND', () => {
    const payslip = new EmployeePayslip({
      employeeId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      fullName: 'Trần Thị Thu Thảo',
      positionLevelText: 'NV · Bậc 1',
      contractStatusText: 'HĐLĐ từ 3 tháng',
      month: '2026-10',
      standardWorkdays: 26,
      baseSalaryPolicy: 6000000,
      dailyLines: sampleDailyLines,
      // Specific Overtime: 5 hours @ x2.0
      otHoursByRate: {
        x15: 0,
        x20: 5,
        x30: 0
      },
      // Specific Deductions: 0.58 hours late/early
      lateEarlyHours: 0.58,
      // KPI Component weights & scores
      kpiScores: {
        wework: 0.85,
        user: 0.90,
        peer: 0.80,
        manager: 0.85,
        self: 0.90
      },
      kpiMaxSalary: 6000000,
      advanceDeduction: 2025000,
      remainingAnnualLeaveDays: 22
    });

    // Page 1 Attendance Metrics
    assert.equal(payslip.actualWorkDays, 24);
    assert.equal(payslip.flexShiftCount, 3);
    assert.equal(payslip.nightShiftCount, 3);
    assert.equal(payslip.paidLeaveDays, 1);
    assert.equal(payslip.isatDays, 1);
    assert.equal(payslip.unpaidLeaveDays, 1);
    assert.equal(payslip.holidayPaidDays, 0);
    assert.equal(payslip.totalOtHours, 5);
    assert.equal(payslip.lateEarlyHours, 0.58);

    // Block 1: Base Salary
    assert.equal(payslip.baseSalaryPolicy, 6000000);
    assert.equal(payslip.baseSalaryActual, 5538462);

    // Block 2: Leave & Holiday
    assert.equal(payslip.paidLeavePay, 230769);
    assert.equal(payslip.leaveSettlementPay, 0);
    assert.equal(payslip.isatPay, 230769);
    assert.equal(payslip.holidayPay, 0);

    // Block 3: Overtime
    assert.equal(payslip.ot15Hours, 0);
    assert.equal(payslip.ot20Hours, 5);
    assert.equal(payslip.ot30Hours, 0);
    assert.equal(payslip.otPayTotal, 288462);

    // Block 4: Allowances (Policy vs Actual)
    assert.equal(payslip.attendanceAllowancePolicy, 1500000);
    assert.equal(payslip.attendanceAllowanceActual, 1384615);
    assert.equal(payslip.travelAllowancePolicy, 900000);
    assert.equal(payslip.travelAllowanceActual, 830769);
    assert.equal(payslip.flexAllowancePolicy, 1200000);
    assert.equal(payslip.flexAllowanceActual, 138462);
    assert.equal(payslip.offPaidNightPolicy, 975000);
    assert.equal(payslip.offPaidNightActual, 112500);
    assert.equal(payslip.nightAllowancePolicy, 2400000);
    assert.equal(payslip.nightAllowanceActual, 276923);
    assert.equal(payslip.totalAllowanceActual, 2743269);

    // Block 5: KPI Pay
    assert.equal(Math.round(payslip.kpiTotalScorePct * 1000) / 10, 85.6);
    assert.equal(payslip.kpiMaxSalary, 6000000);
    assert.equal(payslip.kpiActualPay, 5136000);

    // Block 6: Late / Early deductions
    assert.equal(payslip.lateEarlyDeductionAmount, -16827);

    // Block 7: Gross to Net deductions
    assert.equal(payslip.grossIncome, 14150904);
    assert.equal(payslip.taxExemptIncome, 1003846);
    assert.equal(payslip.taxableIncome, 13147058);
    assert.equal(payslip.insuranceDeduction, 630000);
    assert.equal(payslip.incomeAfterInsurance, 13520904);
    assert.equal(payslip.personalIncomeTax, 0);
    assert.equal(payslip.advanceDeduction, 2025000);
    assert.equal(payslip.netIncome, 11495904);

    // Block 8: Balance
    assert.equal(payslip.remainingAnnualLeaveDays, 22);

    // Reconciliation Invariant Checks
    assert.equal(
      payslip.grossIncome - payslip.insuranceDeduction - payslip.personalIncomeTax - payslip.advanceDeduction,
      payslip.netIncome
    );
  });

  it('provides clean summary DTO via toSummary() and toJSON()', () => {
    const payslip = new EmployeePayslip({
      employeeId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      fullName: 'Trần Thị Thu Thảo',
      positionLevelText: 'NV · Bậc 1',
      contractStatusText: 'HĐLĐ từ 3 tháng',
      month: '2026-10',
      standardWorkdays: 26,
      baseSalaryPolicy: 6000000,
      dailyLines: sampleDailyLines
    });

    const summary = payslip.toSummary();
    assert.equal(summary.employeeId, 'f47ac10b-58cc-4372-a567-0e02b2c3d479');
    assert.equal(summary.fullName, 'Trần Thị Thu Thảo');
    assert.equal(summary.netIncome, payslip.netIncome);

    const json = payslip.toJSON();
    assert.equal(json.month, '2026-10');
    assert.equal(Array.isArray(json.dailyLines), true);
    assert.equal(json.dailyLines.length, sampleDailyLines.length);
  });
});
