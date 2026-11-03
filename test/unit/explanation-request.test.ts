import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RequestV2Service } from '../../src/modules/request-v2/request-v2.service';
import { RequestV2Repository } from '../../src/data/request-v2.repository';
import { AttendanceV2Repository } from '../../src/data/attendance-v2.repository';
import { SystemRequest } from '../../src/domain/request-v2';

class MockAttendanceV2Repository extends AttendanceV2Repository {
  public dayStatuses: Map<string, string> = new Map();

  constructor() {
    super(null as any);
  }

  override async updateDayStatus(employeeId: string, workDate: string, dayStatus: string): Promise<void> {
    this.dayStatuses.set(`${employeeId}:${workDate}`, dayStatus);
  }

  getDayStatus(employeeId: string, workDate: string): string | undefined {
    return this.dayStatuses.get(`${employeeId}:${workDate}`);
  }
}

class MockRequestV2Repository extends RequestV2Repository {
  private requests: Map<string, SystemRequest> = new Map();

  constructor() {
    super(null as any);
  }

  override async save(request: SystemRequest): Promise<void> {
    const clone = SystemRequest.fromRow(request.toRow());
    this.requests.set(clone.id, clone);
  }

  override async findById(id: string): Promise<SystemRequest | null> {
    const found = this.requests.get(id);
    if (!found) return null;
    return SystemRequest.fromRow(found.toRow());
  }
}

describe('Attendance Explanation Request Workflow (Task 2)', () => {
  const EMP_ID = 'e1111111-1111-1111-1111-111111111111';
  const REVIEWER_ID = 'a9999999-9999-9999-9999-999999999999';
  const WORK_DATE = '2026-10-14';

  it('submits an EXPLANATION request for a date with NEEDS_EXPLANATION', async () => {
    const reqRepo = new MockRequestV2Repository();
    const attRepo = new MockAttendanceV2Repository();
    const service = new RequestV2Service(reqRepo, attRepo);

    // Initial state: date requires explanation
    attRepo.dayStatuses.set(`${EMP_ID}:${WORK_DATE}`, 'NEEDS_EXPLANATION');

    const reqDto = await service.createExplanationRequest({
      employeeId: EMP_ID,
      title: 'Giải trình quên chấm công vào',
      reason: 'Bảo vệ toà nhà sửa cửa cuốn nên vào bằng cửa ngách không có máy chấm vân tay',
      workDate: WORK_DATE,
      actualCheckIn: '08:00',
      actualCheckOut: '17:00'
    });

    assert.ok(reqDto.id);
    assert.equal(reqDto.type, 'EXPLANATION');
    assert.equal(reqDto.status, 'PENDING');
    assert.equal(reqDto.employeeId, EMP_ID);
    assert.equal(reqDto.correctionDate, WORK_DATE);
    assert.equal(attRepo.getDayStatus(EMP_ID, WORK_DATE), 'NEEDS_EXPLANATION');
  });

  it('approves an EXPLANATION request and transitions day_status to VALID', async () => {
    const reqRepo = new MockRequestV2Repository();
    const attRepo = new MockAttendanceV2Repository();
    const service = new RequestV2Service(reqRepo, attRepo);

    attRepo.dayStatuses.set(`${EMP_ID}:${WORK_DATE}`, 'NEEDS_EXPLANATION');

    const reqDto = await service.createExplanationRequest({
      employeeId: EMP_ID,
      title: 'Giải trình quên chấm công',
      reason: 'Lý do chính đáng',
      workDate: WORK_DATE
    });

    const reviewed = await service.reviewRequest(reqDto.id, REVIEWER_ID, 'APPROVE', 'Chấp thuận giải trình');
    assert.equal(reviewed.status, 'APPROVED');
    assert.equal(reviewed.reviewedBy, REVIEWER_ID);

    // Timesheet day_status must transition to 'VALID'
    assert.equal(attRepo.getDayStatus(EMP_ID, WORK_DATE), 'VALID');
  });

  it('rejects an EXPLANATION request, keeping day_status NEEDS_EXPLANATION without punitive fine', async () => {
    const reqRepo = new MockRequestV2Repository();
    const attRepo = new MockAttendanceV2Repository();
    const service = new RequestV2Service(reqRepo, attRepo);

    attRepo.dayStatuses.set(`${EMP_ID}:${WORK_DATE}`, 'NEEDS_EXPLANATION');

    const reqDto = await service.createExplanationRequest({
      employeeId: EMP_ID,
      title: 'Giải trình đi muộn',
      reason: 'Kẹt xe không có bằng chứng',
      workDate: WORK_DATE
    });

    const reviewed = await service.reviewRequest(reqDto.id, REVIEWER_ID, 'REJECT', 'Lý do chưa thỏa đáng');
    assert.equal(reviewed.status, 'REJECTED');
    assert.equal(reviewed.reviewedBy, REVIEWER_ID);

    // Day status remains NEEDS_EXPLANATION and no punitive fine is deducted
    assert.equal(attRepo.getDayStatus(EMP_ID, WORK_DATE), 'NEEDS_EXPLANATION');
  });
});
