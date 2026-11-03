import { Controller, Get, Post, Inject, Param } from '@nestjs/common';
import { Ctx, ApiContext } from '../../http/api-context';
import { PayrollV2Service } from '../../domain/payroll-v2';

const { HttpError, readJson } = require('../../platform/http');

@Controller('api/v2/payroll')
export class PayrollV2Controller {
  constructor(@Inject(PayrollV2Service) private readonly service: PayrollV2Service) {}

  /**
   * Tính toán toàn bộ bảng lương của một kỳ
   * POST /api/v2/payroll/:month/calculate
   */
  @Post(':month/calculate')
  async calculatePeriod(@Ctx() c: ApiContext, @Param('month') paramMonth?: string): Promise<unknown> {
    const month = paramMonth || c.seg[4];
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new HttpError(400, 'Tháng không hợp lệ (định dạng YYYY-MM)', { code: 'INVALID_MONTH' });
    }

    const body = (c.req?.headers ? await readJson(c.req) : {}) || {};
    const employeeIds = Array.isArray(body.employeeIds) ? body.employeeIds : undefined;

    try {
      const summaries = await this.service.generatePeriodPayslips(month, employeeIds);
      return {
        month,
        calculated: true,
        count: summaries.length,
        items: summaries
      };
    } catch (err: any) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(500, err.message, { code: 'CALCULATE_ERROR' });
    }
  }

  /**
   * Tính toán phiếu lương cho 1 nhân viên trong kỳ
   * POST /api/v2/payroll/:month/calculate/:employeeId
   */
  @Post(':month/calculate/:employeeId')
  async calculateEmployee(
    @Ctx() c: ApiContext,
    @Param('month') paramMonth?: string,
    @Param('employeeId') paramEmp?: string
  ): Promise<unknown> {
    const month = paramMonth || c.seg[4];
    const employeeId = paramEmp || c.seg[6];
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new HttpError(400, 'Tháng không hợp lệ (định dạng YYYY-MM)', { code: 'INVALID_MONTH' });
    }
    if (!employeeId) {
      throw new HttpError(400, 'Thiếu employeeId', { code: 'MISSING_EMPLOYEE_ID' });
    }

    try {
      const payslip = await this.service.generateMonthlyPayslip(employeeId, month);
      return {
        month,
        calculated: true,
        payslip: payslip.toJSON()
      };
    } catch (err: any) {
      if (err instanceof HttpError) throw err;
      if (err.message?.includes('not found')) {
        throw new HttpError(404, err.message, { code: 'NOT_FOUND' });
      }
      throw new HttpError(400, err.message, { code: 'BAD_REQUEST' });
    }
  }

  /**
   * Lấy chi tiết phiếu lương 2 trang chuẩn GFT của 1 nhân viên
   * GET /api/v2/payroll/:month/:employeeId
   */
  @Get(':month/:employeeId')
  async getEmployeePayslip(
    @Ctx() c: ApiContext,
    @Param('month') paramMonth?: string,
    @Param('employeeId') paramEmp?: string
  ): Promise<unknown> {
    const month = paramMonth || c.seg[4];
    const employeeId = paramEmp || c.seg[5];
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new HttpError(400, 'Tháng không hợp lệ (định dạng YYYY-MM)', { code: 'INVALID_MONTH' });
    }
    if (!employeeId) {
      throw new HttpError(400, 'Thiếu employeeId', { code: 'MISSING_EMPLOYEE_ID' });
    }

    try {
      const payslip = await this.service.generateMonthlyPayslip(employeeId, month);
      return {
        month,
        payslip: payslip.toJSON()
      };
    } catch (err: any) {
      if (err instanceof HttpError) throw err;
      if (err.message?.includes('not found')) {
        throw new HttpError(404, err.message, { code: 'NOT_FOUND' });
      }
      throw new HttpError(400, err.message, { code: 'BAD_REQUEST' });
    }
  }

  /**
   * Lấy danh sách tóm tắt bảng lương kỳ
   * GET /api/v2/payroll/:month
   */
  @Get(':month')
  async getPeriodSummary(@Ctx() c: ApiContext, @Param('month') paramMonth?: string): Promise<unknown> {
    const month = paramMonth || c.seg[4];
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new HttpError(400, 'Tháng không hợp lệ (định dạng YYYY-MM)', { code: 'INVALID_MONTH' });
    }

    try {
      const summaries = await this.service.generatePeriodPayslips(month);
      return {
        month,
        total: summaries.length,
        items: summaries
      };
    } catch (err: any) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(500, err.message, { code: 'FETCH_ERROR' });
    }
  }
}
