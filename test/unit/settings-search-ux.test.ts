import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAllSettings, filterAllSettings, searchAllSettings } from '../../web/src/builders/admin-config/all-settings';

const idx = {
  entries: [
    { id: 'pay.method', group: 2, label: 'Phương thức trả lương', class: 'choice', wired: true, instances: [{ key: 'pay.method', value: 'monthly' }], rules: { options: [{ value: 'monthly', label: 'Hàng tháng' }] } },
    { id: 'system.tax-code', group: 10, label: 'Mã thuế tham chiếu', class: 'fixed', readOnly: true, instances: [{ key: 'system.tax-code', value: 'TX-1' }] },
    { id: 'advance.period', group: 1, label: 'Tạm ứng theo kỳ', class: 'fixed', readOnly: true, instances: [{ key: 'advance.period', value: 'monthly' }] }
  ]
};

test('cross-group search returns labeled editable results and stable deep links', () => {
  const results = searchAllSettings(idx, 'phương thức');
  assert.equal(results.length, 1);
  assert.equal(results[0].groupKey, 'ngay-cong');
  assert.match(results[0].groupLabel, /Lương theo ngày công/);
  assert.deepEqual(results[0].query, { q: 'phương thức', group: 'ngay-cong', setting: 'pay.method' });
});

test('Vietnamese search ignores accents while keeping the typed query unchanged in the link', () => {
  const result = searchAllSettings(idx, 'tam ung')[0];
  assert.equal(result.groupKey, 'tam-ung');
  assert.equal(result.settingKey, 'advance.period');
  assert.equal(result.query.q, 'tam ung');
});

test('no matches is a successful empty result and readonly match has stable target without edit access', () => {
  assert.deepEqual(searchAllSettings(idx, 'no such setting'), []);
  const result = searchAllSettings(idx, 'mã thuế')[0];
  assert.equal(result.settingKey, 'system.tax-code');
  assert.equal(result.readonly, true);
  assert.equal('capability' in result, false);
  const detail = buildAllSettings(idx, { total: 0 }, 'thue').detail;
  assert.equal(detail.readonly[0].key, 'system.tax-code');
});

test('deep-linked readonly target stays visible when query only matches group and local filter excludes readonly', () => {
  const detail = buildAllSettings(idx, { total: 0 }, 'thue').detail;
  for (const filter of ['unconfirmed', 'editable']) {
    const visible = filterAllSettings(detail, 'kế toán', filter, 'system.tax-code');
    assert.equal(visible.readonly.length, 1);
    assert.equal(visible.readonly[0].key, 'system.tax-code');
  }
});
