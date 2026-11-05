# SDD ledger — plan: docs/superpowers/plans/2026-11-05-fe-be-auth-foundation.md
Setup: Ruling: no git repo → no worktree, no commits, no task-start/task-done scripts; ledger written by hand — user goal in chat says run continuously — cost if wrong: no per-task diff history.
Pre-flight: T2 consumes T1 ACCESS_KEY/capsOf; T3 changes AuthenticatedUser (adds payrollSubject) consumed by T2 guard; T9 consumes T8 MOCK/notConnected — consistent.
Task 1: Ruling: V1 auth aliases (POST /api/login, /api/logout, PUT /api/password) removed in Task 1 instead of Task 3 — the access table names handlers by their final names — cost if wrong: none, spec 5.5 removes them anyway.
Task 1: complete (tests: npm test → 298 pass, 0 fail, 1 skip)
Task 2: complete (tests: npm test → 308 pass, 0 fail, 1 skip)
Task 3: complete (tests: npm test → 326 pass, 0 fail, 1 skip)
Task 4: complete (tests: npm test → 336 pass, 0 fail, 1 skip)
Task 5: complete (tests: npm test → 343 pass, 0 fail, 1 skip)
Task 6: Ruling: 12 old tests (holidays, payroll-kpi-api, requests-isat-service) called controllers without a session user and asserted the 'system'/null actor fallback; updated them to pass a session user and expect that user, and isat controller test now sends employeeId — spec 5.3 removes the fallback — cost if wrong: none for behaviour; tests now encode the new contract.
Task 6: complete (tests: npm test → 347 pass, 0 fail, 1 skip)
Task 7: Ruling: Docker volumes for local Postgres pre-existed (2026-11-02) with another password; starting a separate Postgres project was denied by the permission classifier → auth-http.pg.test.ts written but NOT RUN (skips without PG_TEST_URL). Added auth-http.test.ts: real HTTP server without DB covering /api/me, 401 sweep, 415, 413, INVALID_JSON, removed aliases — it passed on first run because it verifies wiring done in Tasks 1-5 — cost if wrong: DB-backed login/session flows unverified end-to-end.
Task 8: Ruling: web/.env.mock would be git-ignored by root .gitignore (.env.*) → mode 'mock' sets VITE_DATA and a global __MOCK__ via vite define — cost if wrong: none.
Task 8: Ruling: Rolldown (Vite 8) does not fold an imported MOCK const across modules and keeps mock modules pulled in by display constants → services use global __MOCK__, display constants moved to src/constants/labels.ts (mock re-exports), mock modules marked side-effect free, /thiet-ke route only in mock mode — spec 8.3 bundle check — cost if wrong: none at runtime.
Task 8/9: build (api) → no 'aicb.mock.session', no mock names in dist.
Task 10: written (playwright.api.config.ts, tests/api/auth.spec.ts) — NOT RUN: needs BE + Postgres (blocked, see Task 7).
Task 9: Ruling: in mock mode api() keeps the old contract (reject mock_missing, no network) — 3 Playwright tests assert mock mode makes no /api calls — cost if wrong: none.
Task 9: Ruling: shell.decide(id, verb) now carries approve/reject to the server (PATCH /requests/:id/review); remind/declare → not_connected — mock decided by removal only — cost if wrong: one extra arg.
Wiring (goal "nối API hiện có"): Ruling: connected Nhân sự (employees), chuông/việc chờ (requests PENDING + review), Lịch (holidays), Nhật ký (system/audit), Bảng lương cả kỳ (payroll/:month) via pure builders web/src/builders/api/* tested in test/v2/fe-api-builders.test.ts (10 tests, RED→GREEN). Not connected (need new/changed APIs, see specs/2026-11-05-missing-apis-design.md): staff app, Yêu cầu screen (V1 approvals model), Chấm công Admin, phiếu lương chi tiết/duyệt, Tổng quan, kỳ lương, Cài đặt (params/positions/shifts/roles) — cost if wrong: those screens show "chưa nối"/server error in api mode.
Wiring: Ruling: CalendarView shows "—" when payDay is null (BE has no pay-day setting) — template fallback, no unit test infra for .vue — cost if wrong: cosmetic.
Final review: self-review (user did not ask for agents).
Final: minor (deferred): Nhân sự maps locked accounts to "Chưa kích hoạt" (BE has no activation concept).
Final: minor (deferred): audit filters apply only within the fetched page (BE has no filter/count).
Final: minor (deferred): resolveRequest falls back to name "nhân viên" when the item was not in the last inbox read.
Verification: npm test → 365 pass, 0 fail, 2 skip (PG tests). Playwright mock full → 252 pass, 1 fail, 15 skip; the fail (attendance-ux 'dragging scrolls…') passed 3/3 in isolation and in the earlier 3-file run → flaky under parallel load. Build (api) → no mock session, no mock names.
Next plan written: docs/superpowers/plans/2026-11-05-me-apis.md (not executed).
Wiring round 2 (stop-hook: existing APIs still unwired):
- Yêu cầu/Giải trình/Tạm ứng → /requests via builders/api/requests.ts (RED→GREEN). Ruling: keep V1 row builders, adapt BE DTO to V1 raw rows — screens unchanged — cost if wrong: client-side month filter over ≤1000 requests.
- Kỳ lương → /system/periods via builders/api/period.ts (RED→GREEN).
- Phiếu lương chi tiết + KPI → GET payslip, PUT kpi then POST calculate {employeeIds:[id]} (RED→GREEN). Ruling: preview in api mode does not run the mockup formula — could diverge from BE rules — cost: money updates only after save.
- Chấm công Admin (tuần, ngày, hồ sơ) → timesheets + employees + pending via builders/api/attendance.ts (RED→GREEN).
- Chức vụ (xem) → meta/positions via builders/api/catalog.ts. Ruling/TDD gap: test and code were written in one command, RED not observed.
- Ca làm (xem) → meta/shifts (no times in BE).
- Tài khoản → /roles + /employees + PUT /employees/:u via builders/api/accounts.ts (RED→GREEN).
- BE security fixes found while wiring accounts (RED→GREEN, test/v2/employees-account-security.test.ts): lock without lockedAt now stamps locked_at (before: "locked" accounts could still log in); password change through PUT /employees bumps session_version.
- Postgres: second attempt (throwaway container) denied by permission classifier → PG tests still not run.
Verification round 2: npm test → 380 pass, 0 fail, 2 skip (PG). Playwright mock full → 252 pass, 1 fail (attendance-ux drag), 15 skip; attendance-ux file with --workers=1 → 42/42 pass → flaky under parallel load. Build (api) → no mock session/names.
Round 3: buttons for existing APIs — quick-add holidays (CalendarView), calculate payroll (PayrollView), lock period (PeriodStrip, cap attendance.lock). Ruling: UI-only wiring without unit-test infra for .vue; verified by build + Playwright mock (252 pass, 1 known flaky) — cost if wrong: button errors surface as toasts. Ruling: forms for create/deactivate employee and admin-filed requests need new UI design → separate UI spec. npm test → 381 pass, 0 fail, 2 skip.
Round 4 (plan me-apis executed natively under the user's goal):
- BE: src/modules/me (MeController + domain/me-views) — me-domain.test.ts 6 RED→GREEN, me-controller.test.ts 7 RED→GREEN; access table extended; 401 sweep includes /me.
- FE: builders/api/staff-phone.ts (fe-staff-phone-builders.test.ts 7 RED→GREEN), services/staff-phone.ts api branch, phone HomeView Check-in button.
- Ruling: /nv-may-tinh (desktop staff UI on V1 /sheet model) redirects to /nv/hom-nay in api mode — rebuilding it on /me is a separate task — cost if wrong: desktop staff see the phone layout (max-width 430px) on wide screens.
- Verification: npm test → 401 pass, 0 fail, 2 skip; Playwright mock (2 workers) → 253 pass, 0 fail, 15 skip; build api → no mock data.
Round 5: payslip decision API POST /payroll/:month/:username/decision (payroll-decision.test.ts 5 RED→GREEN) + FE decidePayslip; Overview composed on FE from existing APIs (builders/api/overview.ts RED→GREEN). Admin forms (deactivate/add employee, admin-filed requests) NOT done — usage limit. Playwright not rerun after round 5.
