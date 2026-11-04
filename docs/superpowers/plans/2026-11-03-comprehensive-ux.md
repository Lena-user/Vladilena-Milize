# Comprehensive UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the admin and staff experiences across navigation, settings, operational screens, payroll, KPI, attendance, and responsive layouts without changing routes, permissions, APIs, business rules, or money calculations.

**Architecture:** Evolve the existing Vue 3/Vue Router shell, views, services, and builders in eight scoped tasks. Keep data shaping in existing builders/services and presentation in views; add only small pure helpers where behavior needs an isolated contract and unit test. Use the checked-in Playwright harness for browser interactions.

**Tech Stack:** Vue 3, Vue Router, TypeScript, Vite, Node `node:test`/`tsx`, PostgreSQL test runner, `@playwright/test` and Chromium.

**Spec:** `docs/superpowers/specs/2026-11-03-ux-redesign-design.md`

## Global Constraints

- Keep the current Vue/router/service/builder architecture; do not replace Vue or rewrite the frontend.
- Keep existing routes, query parameters, bookmarks, redirect behavior, role/capability checks, API endpoints and payloads.
- Do not change payroll, attendance, KPI, rounding, period lifecycle, or status calculations; display server/builder values with their unit and scope.
- Use the existing brand and color tokens; keep the workspace quiet, without new gradients, promotional hero sections, or cards around every block.
- Do not infer capabilities from an Admin role; direct routes and backend authorization remain authoritative.
- Preserve staff task parity across phone and desktop while allowing layout differences; do not duplicate business logic.
- Responsive review uses widths 375, 768, 1024, and 1440 px; keyboard focus, touch targets, loading, error, empty, and permission states are part of acceptance.
- PostgreSQL tests use the disposable control URL `postgresql://luong_test@127.0.0.1:55433/luong_test_control`; never point tests at real payroll data.
- Repo scripts declare `npm --prefix web run build`, `npm run typecheck:web`, `npm run test:unit`, `npm test`, `npm run format:check`, and `npm --prefix web run test:ui`.

## Review Focus

- Deep links and history navigation with legacy query keys, `q`, `group`, `setting`, and `hop` — Task 1 and Task 2 unit/browser checks.
- Unsaved settings edits while changing group or opening a search result — Task 2 draft-state/browser checks.
- Role/capability differences on direct navigation, read-only fields, and row actions — Tasks 2–6 browser checks with permitted and restricted accounts.
- Paginated, mixed-status payroll data and period totals — Task 5 multi-page service/builder test using server-shaped fixtures.
- Staff check-in, request, attendance, income, and profile parity across phone and desktop — Task 7 same-account browser comparison.

## File Ownership and Execution Order

Each task owns the files listed under it; no later task edits another task's files without first handing ownership back explicitly. Work is sequential where the same shell, route contract, or test surface could overlap. Every task has its own test file; do not add to `test/unit/fe-be-sync-ui.test.ts`.

Keep view files focused. Existing high-volume views such as `OverviewView.vue`, `TimesheetView.vue`, `PayrollView.vue`, and `HomeView.vue` are below the repository's 800-line soft frontend guard at this baseline. If a task would push a view above 800 lines, split the new responsibility into a focused component beside that view and keep the parent as orchestration; do not raise the existing size budget.

### Task 1: Admin shell, navigation, and KPI labels

**Files (owner: Task 1 implementer):**
- Modify: `web/src/components/shell/AdminSidebar.vue`
- Modify: `web/src/components/shell/AdminLayout.vue`
- Modify: `web/src/components/shell/PeriodStrip.vue` only if required for responsive shell behavior
- Modify: `web/src/styles/base.css` (owner: Task 1) for `.app`, `.side`, `.canvas`, and shell-level responsive rules; keep rules grouped and scoped by shell classes
- Modify: `web/src/views/admin/settings/nav.ts`
- Modify: `web/src/router/routes/admin-settings.ts` only for visible route metadata labels; paths stay identical
- Create: `test/unit/admin-navigation-ux.test.ts`

**Interfaces:**
- Consumes: current route metadata `nav`, `useSessionStore` capability state, `usePeriodStore`, shell counts, and existing `?hop=` contracts.
- Produces: one consistent navigation hierarchy over the existing route destinations; operation label `Đánh giá KPI`, configuration label `Quy tắc KPI`; mobile menu state that closes on navigation and leaves existing account, bell, password, and period behavior intact.

- [ ] **Step 1: Add failing navigation contract tests** in `test/unit/admin-navigation-ux.test.ts`. Test that the shell destination set still includes `/admin/tong-quan`, `/admin/yeu-cau`, `/admin/cham-cong`, `/admin/kpi`, `/admin/bang-luong`, `/admin/nhan-su`, and `/admin/cai-dat`; the KPI configuration item is labeled `Quy tắc KPI`, the operational item `Đánh giá KPI`, and active child routes resolve to the parent nav key without changing paths.
- [ ] **Step 2: Run the focused test and observe the mismatch.**

Run: `PG_TEST_URL=postgresql://luong_test@127.0.0.1:55433/luong_test_control node --no-warnings --import=tsx scripts/test/postgres-runner.ts "test/unit/admin-navigation-ux.test.ts"`

Expected: FAIL on the old duplicate KPI label or missing tested active/mobile behavior before implementation.
- [ ] **Step 3: Update the shell hierarchy and label sources.** Keep existing destinations and capability gates; add responsive open/close semantics only to the existing admin shell. Do not introduce placeholder destinations or dashboard cards.
- [ ] **Step 4: Re-run focused tests, then build and type-check the web package.**

Run: `PG_TEST_URL=postgresql://luong_test@127.0.0.1:55433/luong_test_control node --no-warnings --import=tsx scripts/test/postgres-runner.ts "test/unit/admin-navigation-ux.test.ts"`

Run: `npm --prefix web run build && npm run typecheck:web`

Expected: test passes; Vite build and `vue-tsc` complete successfully.
- [ ] **Step 5: Browser-check widths 375/768/1024/1440 and keyboard.** At 375 px verify the shell and menu fit the viewport without clipping or hiding content; do not use `overflow:hidden` to mask overflow from views not yet addressed. Verify active nav on nested routes, menu open/close with Escape and focus return, and query-backed shell dialogs open/close consistently with the URL. Record actual route and role used. Document-wide overflow is an integration acceptance after Tasks 2–7.

### Task 2: Cross-group settings search, deep links, and drafts

**Files (owner: Task 2 implementer):**
- Modify: `web/src/views/admin/settings/AllSettingsView.vue`
- Modify: `web/src/views/admin/settings/SettingsFrame.vue`
- Modify: `web/src/views/admin/settings/settings-extra.css` and `web/src/views/admin/settings/all/SettingItem.vue` only for search result/focus/draft presentation
- Modify: `web/src/services/admin-settings.ts`
- Modify: `web/src/services/admin-config.ts`
- Modify: `web/src/builders/admin-config/all-settings.ts`
- Modify: `web/src/views/admin/settings/lib/useDraft.ts` only if the existing draft lifecycle cannot preserve or explicitly guard a group transition
- Create: `web/src/builders/admin-config/search-settings.ts` for pure result matching/route mapping if needed
- Create: `test/unit/settings-search-ux.test.ts`
- Modify: `spec/reference/web-routes.md` only if a route declaration actually changes; the intended design does not require route changes

**Interfaces:**
- Consumes: current `SECTIONS`, `buildAllSettings(idx, firstRun, group)`, `getAllSettings(group)`, existing `useDraft`, router `q`/`hop`, and capability checks attached to each setting.
- Produces: a pure search result contract containing `groupKey`, visible group label, stable setting key/title, and a deep-link query `{ q, group, setting }`; the selected detail remains the existing group detail model. Add/use a stable key for read-only registry results (whose current view model only carries title/description/value) so a read-only match can be targeted without granting edit access. The implementer must keep existing save payloads and service signatures unless a concrete use-site requires a backwards-compatible additive helper.

- [x] **Step 1: Write failing behavior tests** in `test/unit/settings-search-ux.test.ts`: a term matches a setting outside the selected group and includes that group's label/key; a result link carries `q`, `group`, and `setting`; an empty match is distinguishable from a failed load; a read-only result has a stable target key, remains read-only, and does not gain an edit capability.
- [x] **Step 2: Run the focused unit test and confirm it fails for the missing cross-group result.** RED observed before implementation; focused unit suite later passed after the implementation and test fixes.

Run: `PG_TEST_URL=postgresql://luong_test@127.0.0.1:55433/luong_test_control node --no-warnings --import=tsx scripts/test/postgres-runner.ts "test/unit/settings-search-ux.test.ts"`

Expected: FAIL because current search only filters the selected `draft.detail`.
- [x] **Step 3: Implement a cross-group search from the already loaded settings parameter index.** Return labeled matches and navigate within `/admin/cai-dat/tat-ca`; deep-link loading selects `group` and scrolls/focuses `setting`. Keep `q` and valid `hop` values through updates. Do not add an endpoint or make one request per group when the existing index already contains the data.
- [x] **Step 4: Add guarded transition behavior for unsaved edits.** Protect both chip changes and URL-driven group changes (direct/deep link, browser back/forward, query updates) because the existing `useDraft` resets when `data.detail` changes. Preserve drafts by group for in-session transitions; if a transition cannot preserve a draft, present a clear discard/cancel choice before changing the URL/group. Cancel must retain the old group, query, focus, and draft. Save/preview/revert continue to use existing capability and effective-month/revision behavior; do not alter the save payload.
- [x] **Step 5: Run the focused test plus web build/type-check.** Focused unit and browser suites passed; web build and type-check succeeded.

Run: `PG_TEST_URL=postgresql://luong_test@127.0.0.1:55433/luong_test_control node --no-warnings --import=tsx scripts/test/postgres-runner.ts "test/unit/settings-search-ux.test.ts"`

Run: `npm --prefix web run build && npm run typecheck:web`

Expected: tests pass and frontend build/type-check succeed.
- [ ] **Step 6: Browser-check settings flows** at 375/768/1024/1440: search for an editable and read-only setting in another group; activate by mouse and keyboard; verify the correct group/item receives focus and URL contains expected query; use direct URL and back/forward while dirty; attempt chip change while dirty and test both cancel and discard/preserve; verify loading, no-results, load-error/retry, read-only and restricted-role states. Cancel must leave draft and query unchanged. Check `spec/reference/web-routes.md` if any route changed.

### Task 3: Admin overview, requests, and staff management

**Files (owner: Task 3 implementer):**
- Modify: `web/src/views/admin/overview/OverviewView.vue`
- Modify: `web/src/views/admin/requests/RequestsView.vue`
- Modify: `web/src/views/admin/requests/RequestTable.vue` and focused group components only where needed for row actions or responsive display
- Modify: `web/src/views/admin/staff/StaffView.vue`
- Modify: `web/src/views/admin/staff/ProfileDrawer.vue` and staff dialogs only where needed to preserve current actions/focus
- Modify: `web/src/builders/admin-main/overview.ts` only for an actual data-display mapping issue; do not create counts in the view
- Create: `test/unit/admin-workflows-ux.test.ts`

**Interfaces:**
- Consumes: current Overview builder and `getOverview`, request services/routes/scopes and row selection, staff list service, `loc`, `q`, `hop`, and `nv` query contracts.
- Produces: action-oriented Overview links using the exact blocker/month/filter values already returned by the builder; explicit requests scope/status/type; staff search/filter/pagination and profile actions with current query/capability behavior.

- [ ] **Step 1: Write failing data/route behavior tests** in `test/unit/admin-workflows-ux.test.ts`: Overview blocker links retain the selected month and target filter; request scope changes do not clear unrelated filters/selection unexpectedly; staff issue filters remain URL-reproducible; empty result, no-access, and load error are not represented as a zero-data success. Base expected values on service/builder fixtures, not copied component markup.
- [ ] **Step 2: Run the test and confirm the targeted regression is reproduced.**

Run: `PG_TEST_URL=postgresql://luong_test@127.0.0.1:55433/luong_test_control node --no-warnings --import=tsx scripts/test/postgres-runner.ts "test/unit/admin-workflows-ux.test.ts"`

Expected: FAIL on the missing route/state behavior before implementation.
- [ ] **Step 3: Improve the Overview hierarchy and deep links.** Lead with selected period, blockers, and next valid actions; keep KPI/period summaries secondary; do not add a count unless its source, period, and denominator are already returned by the server/builder.
- [ ] **Step 4: Improve requests and staff task hierarchy.** Clarify current-month vs all-month scope, status/type filters, selected-row behavior, staff issue filters, pagination, profile drawer and bulk assignment. Keep existing per-row/bulk actions and capability checks; do not add new mutations.
- [ ] **Step 5: Run focused tests and web build/type-check.**

Run: `PG_TEST_URL=postgresql://luong_test@127.0.0.1:55433/luong_test_control node --no-warnings --import=tsx scripts/test/postgres-runner.ts "test/unit/admin-workflows-ux.test.ts"`

Run: `npm --prefix web run build && npm run typecheck:web`

Expected: tests pass and frontend build/type-check succeed.
- [ ] **Step 6: Browser-check routes, roles, and states** at all four widths. Follow an Overview action and use back/forward; switch request scope and filters with and without selected rows; open staff by `?loc=...`, `?hop=...&nv=...`; verify paging, long names, empty/no-result/loading/error/403, and that unauthorized actions remain unavailable.

### Task 4: Responsive and keyboard-accessible attendance

**Files (owner: Task 4 implementer):**
- Modify: `web/src/views/admin/attendance/AttendanceShell.vue`
- Modify: `web/src/views/admin/attendance/TimesheetView.vue`
- Modify: `web/src/views/admin/attendance/TodayView.vue`
- Modify: `web/src/views/admin/attendance/OvertimeView.vue`
- Modify: `web/src/views/admin/attendance/DayDetailDialog.vue`, `TodayDialog.vue`, `OvertimeDialog.vue`, and `BulkPunchDialog.vue` only for the owned dialog keyboard/responsive behavior
- Modify: `web/src/builders/admin-attendance/timesheet.ts` only if a displayed value lacks an existing server-backed mapping
- Create: `web/src/views/admin/attendance/cell-aria.ts` only if needed to extract the accessible cell label used by `TimesheetView.vue` into a directly testable helper
- Create: `test/unit/attendance-ux.test.ts`

**Interfaces:**
- Consumes: `getAttendanceSummary`, `getTimesheet(month, { filter, q, page })`, current attendance builders, `?filter=`, `?thang=`, `?hop=` and existing `session` capabilities.
- Produces: accessible timesheet cell names/row labels, readable responsive table treatment, and dialog open/close behavior that keeps URL and focus in sync. Original/revised times, reasons, versions, decisions, and audit context remain available.

- [ ] **Step 1: Add failing attendance behavior tests** in `test/unit/attendance-ux.test.ts` against the builder or helper actually consumed by `TimesheetView.vue` (never source text): a row/cell's accessible description identifies person, date, and present attendance state; a multi-page fixture retains server totals instead of counting only visible rows; closing the dialog removes only its own `hop`, retaining month/filter query.
- [ ] **Step 2: Run the focused test and confirm the target behavior is absent or incorrect.**

Run: `PG_TEST_URL=postgresql://luong_test@127.0.0.1:55433/luong_test_control node --no-warnings --import=tsx scripts/test/postgres-runner.ts "test/unit/attendance-ux.test.ts"`

Expected: FAIL for the behavior under change.
- [ ] **Step 3: Implement the responsive attendance hierarchy.** Keep month/date headers, names, status/declared-day labels, filters, pager, and close-attendance-to-payroll deep link. At mobile sizes use labeled rows or a clearly announced horizontal scroll region; retain day/name context for long tables.
- [ ] **Step 4: Implement semantic keyboard interaction for attendance dialogs/cells.** Use native button/link semantics, visible focus, focus into modal and back to opener, Escape to close only when safe, and URL cleanup preserving unrelated keys. Do not bind global shortcuts that intercept input.
- [ ] **Step 5: Run focused test, web build, and type-check.**

Run: `PG_TEST_URL=postgresql://luong_test@127.0.0.1:55433/luong_test_control node --no-warnings --import=tsx scripts/test/postgres-runner.ts "test/unit/attendance-ux.test.ts"`

Run: `npm --prefix web run build && npm run typecheck:web`

Expected: test passes and frontend build/type-check succeed.
- [ ] **Step 6: Browser-check 375/768/1024/1440** with long names, all day columns, no rows, pending/rejected rows, loading/error, and users with/without `request.decide.*`. At 375 px verify the document itself does not overflow horizontally and the dense timesheet scrolls inside its labeled table region; do not hide any attendance columns. Tab through filters, cells, pager and dialogs; verify Enter/Space activation, Escape, focus restoration, scroll containment, target size, and query preservation.

### Task 5: Payroll hierarchy and dense-data correctness

**Files (owner: Task 5 implementer):**
- Modify: `web/src/views/admin/payroll/PayrollView.vue`
- Modify: `web/src/views/admin/payroll/parts/PayrollTable.vue`
- Modify: `web/src/views/admin/payroll/parts/PayrollWideTable.vue`
- Modify: `web/src/views/admin/payroll/parts/PayrollDialogs.vue` and relevant payroll/payslip dialogs only when keyboard/viewport handling requires it
- Modify: `web/src/builders/admin-payroll/payroll.ts` only for presentation mapping that can be proven not to alter calculation
- Modify: `web/src/services/admin-payroll.ts` only for a display-fetch defect; do not change endpoints or amount logic
- Create: `test/unit/payroll-ux.test.ts`

**Interfaces:**
- Consumes: `getPayroll(month, opts)`, `buildPeriodView`, `describeScenario`, period `facts`, current route query `thang`, `kb`, `hop`, `phieu`, selection/return/approve actions, and session capability checks.
- Produces: status-first presentation of the selected period, blockers and valid actions; accessible paginated rows and compact/wide tables; unchanged service/builders amount, status, and period contracts.

- [ ] **Step 1: Add failing payroll behavior tests** in `test/unit/payroll-ux.test.ts`: fixtures spanning at least three pages and draft/pending/approved/error states keep API totals distinct from current page length; selecting/clearing rows preserves intended `kb`/month; opening and closing `?phieu=` or `?hop=` does not lose other query values; displayed amount fields equal the builder/server values exactly.
- [ ] **Step 2: Run the focused test and verify it fails for the selected behavior.**

Run: `PG_TEST_URL=postgresql://luong_test@127.0.0.1:55433/luong_test_control node --no-warnings --import=tsx scripts/test/postgres-runner.ts "test/unit/payroll-ux.test.ts"`

Expected: FAIL on the behavior being changed; never use a UI-computed replacement as the expected amount.
- [ ] **Step 3: Reorder payroll hierarchy** so month/status/blockers/allowed next action lead; place filters, search, pagination, print/export, extras, and detailed formula explanations at their current task context. Preserve all operational controls and confirmation/reason requirements.
- [ ] **Step 4: Improve dense table and dialog responsiveness.** At narrow widths retain access to every payroll column through labeled rows or announced horizontal scroll with name/identity anchored; keep dialog content scrollable and confirmation actions visible. Keep calculations in existing backend/builders.
- [ ] **Step 5: Run focused test, web build, type-check, and payroll contract/unit regression.**

Run: `PG_TEST_URL=postgresql://luong_test@127.0.0.1:55433/luong_test_control node --no-warnings --import=tsx scripts/test/postgres-runner.ts "test/unit/payroll-ux.test.ts"`

Run: `PG_TEST_URL=postgresql://luong_test@127.0.0.1:55433/luong_test_control npm run test:unit`

Run: `npm --prefix web run build && npm run typecheck:web`

Expected: focused payroll test passes and build/type-check succeed. Record the unit-suite result against baseline; do not treat existing failures as caused by this task without evidence. If implementation changes any calculation or endpoint to satisfy a visual need, stop and revert that scope rather than adapt the expected value.
- [ ] **Step 6: Browser-check each relevant period state** (`tam-tinh`, `da-chot-cong`, `ban-nhap`, `cho-phe-duyet`, `chon-phieu`, `da-duyet-50`, `can-tinh-lai`, `da-phe-duyet`, `da-tra-luong`) with multi-page test data. At all widths verify totals, selection counts, filter/search/pager, drawer, printing/export, loading/error/empty/permission and that illegal actions follow server state.

### Task 6: KPI operation vs configuration clarity

**Files (owner: Task 6 implementer):**
- Modify: `web/src/views/admin/kpi/KpiShell.vue`
- Modify: `web/src/views/admin/kpi/KpiScoresView.vue`
- Modify: `web/src/views/admin/kpi/KpiHistoryView.vue`
- Modify: `web/src/builders/admin-kpi/kpi.ts` only if an existing server-backed field needs a display adapter
- Modify: `web/src/services/admin-kpi.ts` only to repair presentation data loading without changing endpoints or aggregation rules
- Create: `test/unit/kpi-ux.test.ts`
- Do not edit `AdminSidebar.vue`, settings navigation, or Task 1 files; the shared KPI labels are owned by Task 1.

**Interfaces:**
- Consumes: `getKpiSummary(month)`, current KPI rows/history builders, supplied weights/pass result/amounts and existing `/admin/kpi`, `/admin/kpi/lich-su`, `/admin/cai-dat/kpi` routes.
- Produces: clear operational KPI hierarchy with denominator/incomplete count and a visible path to `Quy tắc KPI`; history remains reachable; no UI-side re-scoring or salary aggregation beyond the current builder response.

- [ ] **Step 1: Add failing KPI behavior tests** in `test/unit/kpi-ux.test.ts`: summary counts and salary total remain identical to the builder fixture; incomplete and no-data states are distinct; history route and existing row identity survive presentation changes; configuration link targets `/admin/cai-dat/kpi` and labels it `Quy tắc KPI`.
- [ ] **Step 2: Run focused tests and observe the outdated label/state behavior.**

Run: `PG_TEST_URL=postgresql://luong_test@127.0.0.1:55433/luong_test_control node --no-warnings --import=tsx scripts/test/postgres-runner.ts "test/unit/kpi-ux.test.ts"`

Expected: FAIL on the KPI behavior selected before implementation.
- [ ] **Step 3: Clarify evaluation vs rule configuration.** Show period, passed/incomplete denominator, failed explanation, and server-provided salary amount in a compact hierarchy. Keep weights and history as secondary but discoverable content, not a replacement route.
- [ ] **Step 4: Run focused tests, web build, and type-check.**

Run: `PG_TEST_URL=postgresql://luong_test@127.0.0.1:55433/luong_test_control node --no-warnings --import=tsx scripts/test/postgres-runner.ts "test/unit/kpi-ux.test.ts"`

Run: `npm --prefix web run build && npm run typecheck:web`

Expected: tests pass and frontend build/type-check succeed.
- [ ] **Step 5: Browser-check month and role variants** at all four widths: enter from sidebar, settings cross-link and KPI summary; verify data denominator, loading/error/empty, history deep link/back navigation, read-only vs write-capable state, keyboard, and absence of duplicated settings/operations labels.

### Task 7: Staff mobile/desktop task parity

**Files (owner: Task 7 implementer):**
- Modify: `web/src/layouts/PhoneLayout.vue`
- Modify: `web/src/layouts/StaffDesktopLayout.vue` only if needed for responsive shell parity
- Modify: `web/src/styles/phone.css` (owner: Task 7) for phone-shell breakpoints and touch targets; do not let this task edit Task 1's `base.css`
- Modify: `web/src/views/staff-phone/HomeView.vue`, `AttendanceView.vue`, `RequestsView.vue`, `IncomeView.vue`, and `ProfileView.vue`
- Modify: `web/src/views/staff-phone/components/AttendanceCalendar.vue`, `DayDetailSheet.vue`, `DayRequestSheet.vue`, `ExplanationSheet.vue`, `IncomeSlip.vue`, and `BottomSheet.vue` only for focused parity/accessibility behavior
- Modify: `web/src/views/staff-desktop/StaffHome.vue` and the relevant `parts/` components for the same tasks
- Modify: existing staff builders/services only if a same-source mapping inconsistency is demonstrated; never duplicate a service in the view
- Create: `test/unit/staff-ux.test.ts`

**Interfaces:**
- Consumes: phone and desktop staff services/builders, current five phone tabs, desktop home, `?thang=`, `?kb=`, `?hop=` and request deep links, GPS/geofence response handling.
- Produces: consistent names, status values, task outcomes and deep links between layouts. Phone remains one column with five task tabs; desktop remains a useful wide summary and collapses to the same task order at narrow widths.

- [ ] **Step 1: Add failing staff parity tests** in `test/unit/staff-ux.test.ts`: given the same server fixture, phone and desktop builders expose equivalent check-in state, attendance values, request status and income amount; changing presentation does not alter geofence-required payload/error behavior; month/request dialog URLs preserve unrelated query keys.
- [ ] **Step 2: Run focused tests and verify the target mismatch.**

Run: `PG_TEST_URL=postgresql://luong_test@127.0.0.1:55433/luong_test_control node --no-warnings --import=tsx scripts/test/postgres-runner.ts "test/unit/staff-ux.test.ts"`

Expected: FAIL for a proven mismatch or newly specified shared display contract, not for different but valid layouts.
- [ ] **Step 3: Prioritize phone tasks**: current shift and check-in/out on Home, month/day detail on Attendance, request state/create action on Requests, period/status/payslip on Income, account/profile on Me. Make GPS requirement and server errors understandable; retain the five-tab navigation and remove hover-only actions.
- [ ] **Step 4: Align desktop content and breakpoints** with the same source data and task order. At widths below the three-column fit, collapse to a single column; do not shrink columns below readable size or create duplicated business state.
- [ ] **Step 5: Run focused test, web build, and type-check.**

Run: `PG_TEST_URL=postgresql://luong_test@127.0.0.1:55433/luong_test_control node --no-warnings --import=tsx scripts/test/postgres-runner.ts "test/unit/staff-ux.test.ts"`

Run: `npm --prefix web run build && npm run typecheck:web`

Expected: tests pass and frontend build/type-check succeed.
- [ ] **Step 6: Browser-check same staff account/data on phone and desktop** at widths 375/768/1024/1440. Complete check-in and check-out paths, view attendance day details, submit/review a request, open income/payslip, and view profile. Check touch targets, keyboard/focus for sheets/dialogs, GPS denied/required, network error/retry, loading/empty, URL/back behavior, and compare displayed values on both layouts.

### Task 8: Responsive, accessible shared admin overlays

**Files (owner: Task 8 implementer):**
- Modify: `web/src/components/ui/AppModal.vue`
- Modify: `web/src/components/ui/AppDrawer.vue`
- Modify: `web/src/styles/overlay.css`
- Create: a focused shared overlay-focus helper under `web/src/components/ui/` if needed
- Create: `web/tests/admin-overlays.spec.ts` and minimal test-only fixtures under `web/tests/fixtures/` if needed

**Interfaces:** Keep existing `title`, `sub`, `width`, `top`, `dismissable`, slots and `close` events. The topmost visible dialog handles Escape and Tab; opening focuses it and closing restores focus to its connected opener. Nested overlays preserve the existing reference-counted scroll lock. `dismissable=false` continues to block backdrop and Escape without changing the existing explicit-close control.

- [ ] **Step 1: Write failing browser regressions** using the real shared components: at 375px a wide modal and drawer fit the viewport with controls reachable; opening moves focus inside; Tab and Shift+Tab remain in the topmost overlay; nested Escape closes only the inner overlay and returns focus to its opener; closing the last overlay restores scroll and focus. Check non-dismissible backdrop/Escape and long content.
- [ ] **Step 2: Run the focused test and confirm the current fixed-width/focus behavior fails.**

Run: `npm --prefix web run test:ui -- --grep 'admin overlays'`

- [ ] **Step 3: Implement shared overlay focus/stack behavior and responsive sizing.** Keep existing API/slots and explicit close behavior; do not alter any business form or mutation. Keep long content and footer actions reachable by pointer and keyboard.
- [ ] **Step 4: Run the focused browser test, web build and typecheck.** Check 375, 768, 1024 and 1440 px, nested modal/drawer behavior, reduced motion, scroll lock and focus restoration.
- [ ] **Step 5: Review integration with the attendance day dialog and staff sheets.** Avoid duplicate or conflicting focus handlers; preserve all existing close events and URL behavior.

## Final Integration Verification (after all eight tasks)

- [ ] Run all task-specific test files separately using their documented focused commands; do not combine changes into `test/unit/fe-be-sync-ui.test.ts`.
- [ ] Run `PG_TEST_URL=postgresql://luong_test@127.0.0.1:55433/luong_test_control npm run test:unit` and `PG_TEST_URL=postgresql://luong_test@127.0.0.1:55433/luong_test_control npm test` against the disposable test database; compare failures with the baseline from before these tasks, record actual failing tests, and do not change backend payroll/attendance/request logic to silence baseline failures.
- [ ] Run `npm --prefix web run build`, `npm run typecheck:web`, `npm run format:check`, and `npm run spec:check` from repo root.
- [ ] Inspect `git diff --check`; review route/query changes against `spec/reference/web-routes.md` and verify no product/API/business-logic files changed outside explicitly allowed display adapters.
- [ ] Run `npm --prefix web run test:ui` with Chromium installed; complete representative browser QA at widths 375/768/1024/1440 and report the actual mock/live-data coverage.
- [ ] Record actual test outcomes, roles, viewport, routes/queries, and limitations. This plan is not evidence that any implementation or test has run.

## Plan Status and Baseline Note

- Task 2 implementation is complete. Focused unit tests, the 13-test settings browser suite, web build, web type-check, Prettier checks, and `git diff --check` passed. Browser coverage used mocked settings data; live-data, restricted-role, and full error/retry QA remain outstanding, so Task 2 Step 6 remains unchecked.
- Other task implementation and final integration verification remain in progress; task commits and review status are recorded in the plan-scoped SDD ledger.
- The lead reported that the pre-change full-test baseline already includes failures involving `staff.night_pct` and `explanations`; compare actual test output against the baseline before attributing those failures to UI work. Do not change backend behavior in these tasks to silence them.
- A pre-change Playwright baseline at 375 px reported page overflow of 688–1065 px; the report is `/tmp/ux-baseline/report.json` and the probe script is `/tmp/luna-ui-baseline.cjs`. Tasks 1 and 4 explicitly own the shell-level overflow and attendance-table containment acceptance criteria.
- Worktree: `/home/lena/.codex/worktrees/0b28/Vladilena-Milize-main`; branch: `codex/ux-redesign`; base HEAD: `59e6790e2a9bab730475e0aabc411a3350949c68`.
