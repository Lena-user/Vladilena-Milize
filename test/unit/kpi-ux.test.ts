import assert from 'node:assert/strict';
import test from 'node:test';
import { buildKpiHistory, buildKpiSummary, KPI_RULES_LINK } from '../../web/src/builders/admin-kpi/kpi';

const fixture = {
  month: '2026-11',
  weights: { wework: 40, user: 20, peer: 10, manager: 20, self: 10 },
  items: [
    { username: 'an', name: 'An', type: 'nv', level: 1, complete: true, pass: true, amtApproved: 1_250_000 },
    { username: 'binh', name: 'Bình', type: 'nv', level: 2, complete: false, pass: false, amtProposed: 350_000 }
  ]
};

test('KPI summary keeps server counts and salary total with an explicit denominator', () => {
  const summary = buildKpiSummary(fixture);
  assert.equal(summary.total, fixture.items.length);
  assert.equal(summary.passed, 1);
  assert.equal(summary.incomplete, 1);
  assert.equal(summary.salaryTotal, 1_600_000);
});

test('KPI presentation distinguishes incomplete evaluation from no data', () => {
  assert.equal(buildKpiSummary(fixture).state, 'incomplete');
  assert.equal(buildKpiSummary({ ...fixture, items: [] }).state, 'empty');
});

test('KPI history retains its route and row identity', () => {
  const history = buildKpiHistory(
    { rows: [{ id: 8, action: 'kpi.score', subject: 'an', at: '2026-11-02T08:00:00Z', actor: 'admin' }] },
    fixture
  );
  assert.equal(history.route, '/admin/kpi/lich-su');
  assert.equal(history.rows[0].id, '8');
  assert.equal(history.rows[0].name, 'An');
});

test('KPI rules link uses its configuration route and task label', () => {
  assert.deepEqual(KPI_RULES_LINK, { path: '/admin/cai-dat/kpi', label: 'Quy tắc KPI' });
});
