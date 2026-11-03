import { EmployeePayslip, DailyAttendanceLineProps, KpiScores } from './employee-payslip';
import { PayrollV2Repository } from '../../data/payroll-v2.repository';

export class PayrollV2Service {
  constructor(private readonly repo: PayrollV2Repository) {}

  async generateMonthlyPayslip(employeeId: string, month: string): Promise<EmployeePayslip> {
    const data = await this.repo.getMonthlyData(employeeId, month);
    if (!data) {
      throw new Error(`Data not found for employee ${employeeId} in month ${month}`);
    }

    const { staff, timesheets, requests, kpiScore } = data;
    const standardWorkdays = staff.standardWorkdays || 26;
    const baseSalaryPolicy = staff.baseSalary;
    const dayRate = baseSalaryPolicy / standardWorkdays;
    const hourRate = dayRate / 8;

    // Build DailyAttendanceLineProps[]
    const dailyLines: DailyAttendanceLineProps[] = [];
    let totalDeductionHours = 0;

    for (const ts of timesheets) {
      const shiftCode = ts.shiftType.toUpperCase();
      let shiftLabel = 'Normal';
      let inOutText = '08:00–17:00';
      let flexAllowancePay = 0;
      let nightAllowancePay = 0;
      let offPaidPay = 0;
      let daySalary = 0;

      if (shiftCode === 'FLEX') {
        shiftLabel = 'Flex +20%';
        flexAllowancePay = Math.round(0.20 * dayRate);
        daySalary = Math.round(dayRate);
      } else if (shiftCode === 'NIGHT') {
        shiftLabel = 'Night +40%';
        nightAllowancePay = Math.round(0.40 * dayRate);
        offPaidPay = 37500;
        inOutText = '22:00–06:00';
        daySalary = Math.round(dayRate);
      } else if (shiftCode === 'LEAVE') {
        shiftLabel = 'Nghỉ phép';
        inOutText = 'Hưởng lương ngày';
        daySalary = Math.round(dayRate);
      } else if (shiftCode === 'ISAT') {
        shiftLabel = 'iSAT';
        inOutText = 'Hưởng lương ngày';
        daySalary = Math.round(dayRate);
      } else if (shiftCode === 'UNPAID') {
        shiftLabel = 'Không lương';
        inOutText = 'Không tính lương';
        daySalary = 0;
      } else {
        // NORMAL
        shiftLabel = 'Normal';
        daySalary = Math.round(dayRate);
      }

      // Late/early deductions
      const lateMins = ts.lateMinutes || 0;
      const earlyMins = ts.earlyMinutes || 0;
      const deductionHours = (lateMins + earlyMins) / 60;
      totalDeductionHours += deductionHours;
      const deductionAmount = Math.round(deductionHours * hourRate);

      const dailyTotal = daySalary + flexAllowancePay + nightAllowancePay + offPaidPay - deductionAmount;

      dailyLines.push({
        date: ts.workDate,
        dayOfWeekText: 'Thứ 2 - Thứ 6',
        shiftCode,
        shiftLabel,
        inOutText,
        workHours: ts.workHours,
        daySalary,
        flexAllowancePay,
        nightAllowancePay,
        offPaidPay,
        otHours: ts.otHours,
        otPay: 0,
        deductionHours: Math.round(deductionHours * 100) / 100,
        deductionAmount,
        dailyTotal
      });
    }

    // Overtime from approved requests
    let totalOtHours = 0;
    for (const req of requests) {
      if (req.type === 'OVERTIME' && req.status === 'APPROVED') {
        totalOtHours += req.otHours || 0;
      }
    }

    // Advance deduction from approved requests
    let advanceDeduction = 0;
    for (const req of requests) {
      if (req.type === 'ADVANCE' && req.status === 'APPROVED') {
        advanceDeduction += Number(req.advanceAmount || 0);
      }
    }

    // KPI scores
    let kpiScoresProps: KpiScores | undefined = undefined;
    if (kpiScore) {
      kpiScoresProps = {
        wework: kpiScore.wework > 1 ? kpiScore.wework / 100 : kpiScore.wework,
        user: kpiScore.user > 1 ? kpiScore.user / 100 : kpiScore.user,
        peer: kpiScore.peer > 1 ? kpiScore.peer / 100 : kpiScore.peer,
        manager: kpiScore.manager > 1 ? kpiScore.manager / 100 : kpiScore.manager,
        self: kpiScore.self > 1 ? kpiScore.self / 100 : kpiScore.self
      };
    }

    const roundedLateEarlyHours = Math.round(totalDeductionHours * 100) / 100;

    return new EmployeePayslip({
      employeeId: staff.uuid,
      fullName: staff.name,
      positionLevelText: staff.positionLevelText,
      contractStatusText: staff.contractStatusText,
      month,
      standardWorkdays,
      baseSalaryPolicy,
      dailyLines,
      otHoursByRate: {
        x15: 0,
        x20: totalOtHours,
        x30: 0
      },
      lateEarlyHours: roundedLateEarlyHours,
      kpiScores: kpiScoresProps,
      kpiMaxSalary: staff.kpiMaxSalary || baseSalaryPolicy,
      advanceDeduction,
      remainingAnnualLeaveDays: staff.remainingAnnualLeaveDays || 22
    });
  }
}
