'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildPeriodView } = require('../../web/src/builders/admin-payroll/payroll');

const period = {
  status: 'reviewed',
  rev: 3,
  stages: { attendanceLocked: {}, approved: {}, paid: {} },
  totals: {
    people: 31,
    gross: 31000000,
    insurance: 1200000,
    tax: 700000,
    advance: 250000,
    net: 28850000,
    approved: 4,
    pending: 25,
    draft: 1,
    error: 1
  },
  run: { runNo: 2 }
};
const row = (username, status, gross) => ({
  username,
  name: username,
  type: 'nv',
  level: 1,
  daysWorked: 20,
  gross,
  insurance: 1000,
  tax: 2000,
  advance: 3000,
  net: gross - 6000,
  tienNgayCong: gross,
  phuCap: 0,
  ot: 0,
  kpi: 0,
  status
});

test('payroll UX keeps API totals and page amounts distinct across paginated status rows', () => {
  const cases: Array<[number, any[]]> = [
    [1, [row('draft', 'draft', 100000), row('pending', 'pending', 200000)]],
    [2, [row('approved', 'approved', 300000), row('error', 'error', 0)]],
    [3, [row('pending-2', 'pending', 400000)]]
  ];
  for (const [page, rows] of cases) {
    const view = buildPeriodView('2026-10', period, { rows, page, total: 31 }, { filter: 'all', pageSize: 2 });
    assert.equal(view.facts.total, 31);
    assert.equal(view.paging.total, 31);
    assert.equal(view.rows.length, rows.length);
    for (const [index, source] of rows.entries()) {
      assert.equal(view.rows[index].income, source.gross);
      assert.equal(view.rows[index].net, source.net);
    }
  }
});
