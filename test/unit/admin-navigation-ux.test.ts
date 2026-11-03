import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_SIDEBAR_GROUPS, SETTINGS_NAV } from '../../web/src/views/admin/settings/nav.ts';

test('rendered admin sidebar keeps all established destinations and operation label', () => {
  const items = ADMIN_SIDEBAR_GROUPS.flatMap(([, links]) => links);
  const paths = items.map(([, , , path]) => path);
  for (const path of ['/admin/tong-quan', '/admin/yeu-cau', '/admin/cham-cong', '/admin/kpi', '/admin/bang-luong', '/admin/nhan-su']) {
    assert.ok(paths.includes(path), `missing rendered sidebar destination ${path}`);
  }
  assert.equal(items.find(([, , , path]) => path === '/admin/kpi')?.[2], 'Đánh giá KPI');
});

test('rendered settings navigation calls the KPI configuration destination Quy tắc KPI', () => {
  const items = SETTINGS_NAV.flatMap(([, links]) => links);
  assert.equal(items.find(([, , , path]) => path === '/admin/cai-dat/kpi')?.[2], 'Quy tắc KPI');
});
