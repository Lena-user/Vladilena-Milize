import { expect, test, type Page } from '@playwright/test';

async function mockSettingsApi(
  page: Page,
  delayParams = false,
  reverseParams = false,
  concurrentEdit = false
) {
  let paramsReads = 0;
  let putRevision: number | null = null;
  let putChanges: { key: string; value: unknown }[] = [];
  const paramCompletions: number[] = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api', '');
    let body: Record<string, unknown> = {};
    if (path === '/me') {
      body = {
        user: { username: 'demo_admin', name: 'Demo Admin', role: 'admin' },
        roles: ['admin'],
        caps: ['config.read', 'payroll.calculate', 'payroll.approve', 'attendance.correct', 'attendance.lock', 'audit.read'],
        payrollSubject: true,
        serverNow: '2026-11-03T12:00:00.000Z'
      };
    } else if (path === '/settings/first-run') body = { total: 0, items: [] };
    else if (path === '/positions') body = { positions: [] };
    else if (path === '/settings/params' && route.request().method() === 'GET') {
      const readNumber = ++paramsReads;
      if (reverseParams && readNumber === 2) await new Promise(resolve => setTimeout(resolve, 450));
      else if (reverseParams && readNumber === 3) await new Promise(resolve => setTimeout(resolve, 20));
      else if (delayParams && readNumber > 1) await new Promise(resolve => setTimeout(resolve, 180));
      paramCompletions.push(readNumber);
      body = {
        month: '2026-11',
        paramsRev: reverseParams ? readNumber : concurrentEdit && readNumber > 1 ? 2 : 1,
        groups: [
          {
            entries: [
              {
                id: 'pay.method',
                group: 2,
                label: 'Phương thức trả lương',
                class: 'choice',
                wired: true,
                instances: [{ key: 'pay.method', value: 'monthly', status: 'unset' }],
                rules: { options: [{ value: 'monthly', label: 'Hàng tháng' }, { value: 'daily', label: 'Theo ngày' }] }
              },
              {
                id: 'type.<type>.workdays',
                group: 2,
                label: 'Số ngày công',
                class: 'number',
                wired: true,
                ui: { unit: 'day' },
                instances: [
                  {
                    key: 'type.nv.workdays',
                    value: 22,
                    status: 'unset',
                    label: 'Số ngày công (Nhân viên)'
                  },
                  {
                    key: 'type.ctv.workdays',
                    value: concurrentEdit && readNumber > 1 ? 24 : 30,
                    status: 'unset',
                    label: 'Số ngày công (Chuyên trách viên)'
                  }
                ]
              },
              {
                id: 'system.tax-code',
                group: 10,
                label: 'Mã thuế tham chiếu',
                class: 'fixed',
                readOnly: true,
                instances: [{ key: 'system.tax-code', value: 'TX-1' }]
              }
            ]
          }
        ]
      };
    } else if (path === '/settings/params' && route.request().method() === 'PUT') {
      const payload = route.request().postDataJSON();
      putRevision = payload.expectedRev;
      putChanges = payload.changes;
      body = { ok: true, paramsRev: putRevision, saved: ['pay.method'] };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return {
    putRevision: () => putRevision,
    putChanges: () => putChanges,
    paramsReads: () => paramsReads,
    paramCompletions: () => [...paramCompletions]
  };
}

test('search opens a matching setting in another group by mouse and keyboard', async ({ page }) => {
  await mockSettingsApi(page);
  await page.goto('/admin/cai-dat/tat-ca');
  await page.getByLabel('Tìm theo tên cài đặt').fill('phương thức');
  const result = page.locator('.result').filter({ hasText: 'Phương thức trả lương' });
  await expect(result).toBeVisible();
  await result.focus();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/q=ph%C6%B0%C6%A1ng\+th%E1%BB%A9c.*group=ngay-cong.*setting=pay.method/);
  await expect(page.getByRole('heading', { name: /Lương theo ngày công/ })).toBeVisible();
  await expect(page.locator('[data-setting-key="pay.method"]')).toBeVisible();
  await expect(page.locator('[data-setting-key="pay.method"] .c button.on')).toContainText('Hàng tháng');
});

test('frame search carries only month context and returns to its source with Back', async ({ page }) => {
  await mockSettingsApi(page);
  const source = '/admin/cai-dat/lich?thang=2026-11&hop=them-chuc-vu&group=old&setting=old.setting';
  await page.goto(source);
  await page.getByLabel('Tìm cài đặt').fill('thuế');
  await page.getByLabel('Tìm cài đặt').press('Enter');

  await expect(page).toHaveURL(/\/admin\/cai-dat\/tat-ca\?thang=2026-11&q=thu%E1%BA%BF$/);
  await expect(page.getByRole('heading', { name: 'Thêm chức vụ' })).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(source);
});

test('group-only search keeps a read-only deep-link target visible and resets restrictive filters', async ({ page }) => {
  await mockSettingsApi(page);
  await page.goto('/admin/cai-dat/tat-ca?q=k%E1%BA%BF%20to%C3%A1n');
  const result = page.locator('.result').filter({ hasText: 'Mã thuế tham chiếu' });
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/q=k%E1%BA%BF(?:\+|%20)to%C3%A1n.*group=thue.*setting=system.tax-code/);
  const target = page.locator('[data-setting-key="system.tax-code"]');
  await expect(target).toBeVisible();
  await expect(target).toBeFocused();
  await expect(page.getByRole('button', { name: 'Chỉ đọc', exact: true })).toHaveClass(/on/);

  await page.getByRole('button', { name: 'Chưa xác nhận' }).click();
  await expect(target).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chưa xác nhận', exact: true })).toHaveClass(/on/);

  await page.locator('.gl .chip').filter({ hasText: 'Chấm công' }).click();
  await expect(page).not.toHaveURL(/setting=/);
  await expect(page).toHaveURL(/q=k%E1%BA%BF(?:\+|%20)to%C3%A1n/);
  await page.goBack();
  await expect(page).toHaveURL(/setting=system.tax-code/);
  await expect(target).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chỉ đọc', exact: true })).toHaveClass(/on/);

  const directUrl = page.url();
  await page.goto(directUrl);
  await expect(target).toBeVisible();
  await expect(target).toBeFocused();
  await expect(page.getByRole('button', { name: 'Chỉ đọc', exact: true })).toHaveClass(/on/);
});

test('out-of-order group reads cannot replace the active settings revision used by save', async ({ page }) => {
  const api = await mockSettingsApi(page, false, true);
  await page.goto('/admin/cai-dat/tat-ca?group=ngay-cong');
  await page.locator('.gl .chip').filter({ hasText: 'Chấm công' }).click();
  await expect.poll(api.paramsReads).toBe(2);
  await page.locator('.gl .chip').filter({ hasText: 'Lương theo ngày công' }).click();
  await expect.poll(api.paramsReads).toBe(3);
  await expect(page).toHaveURL(/group=ngay-cong/);
  await expect.poll(api.paramCompletions).toEqual([1, 3, 2]);
  await page.locator('[data-setting-key="pay.method"] .c button').filter({ hasText: 'Theo ngày' }).click();
  await expect(page.locator('[data-setting-key="pay.method"] .c button.on')).toContainText('Theo ngày');
  await page.getByRole('button', { name: 'Xem trước và lưu' }).click();
  await expect.poll(api.putRevision).toBe(3);
});

test('dirty group change cancel preserves query and values; confirmed discard uses fresh revision without overwriting another edit', async ({ page }) => {
  const api = await mockSettingsApi(page, false, false, true);
  await page.goto('/admin/cai-dat/tat-ca?q=ng%C3%A0y%20c%C3%B4ng&group=ngay-cong&setting=type.%3Ctype%3E.workdays');
  const x = page.getByLabel('Số ngày công · Nhân viên');
  const y = page.getByLabel('Số ngày công · Chuyên trách viên');
  await page.getByRole('button', { name: 'Sửa được', exact: true }).click();
  await x.fill('23');
  await y.fill('31');

  const beforeCancel = page.url();
  const attendance = page.locator('.gl .chip').filter({ hasText: 'Chấm công' });
  page.once('dialog', dialog => dialog.dismiss());
  await attendance.click();
  await expect(page).toHaveURL(beforeCancel);
  await expect(x).toHaveValue('23');
  await expect(y).toHaveValue('31');
  await expect(page.getByRole('button', { name: 'Sửa được', exact: true })).toHaveClass(/on/);
  await expect(attendance).toBeFocused();

  page.once('dialog', dialog => dialog.accept());
  await attendance.click();
  await expect(page).toHaveURL(/q=ng%C3%A0y(?:\+|%20)c%C3%B4ng.*group=cham-cong/);
  await page.locator('.gl .chip').filter({ hasText: 'Lương theo ngày công' }).click();
  await expect(page).toHaveURL(/q=ng%C3%A0y(?:\+|%20)c%C3%B4ng.*group=ngay-cong/);
  await expect(page.getByLabel('Số ngày công · Nhân viên')).toHaveValue('22');
  await expect(y).toHaveValue('24');

  await x.fill('23');
  await page.getByRole('button', { name: 'Xem trước và lưu' }).click();
  await expect.poll(api.putRevision).toBe(2);
  await expect.poll(api.putChanges).toEqual([{ key: 'type.nv.workdays', value: 23 }]);
});

test('browser back and forward guard dirty query-driven group changes', async ({ page }) => {
  await mockSettingsApi(page);
  await page.goto('/admin/cai-dat/tat-ca?q=ng%C3%A0y%20c%C3%B4ng&group=ngay-cong');
  const workdays = page.getByLabel('Số ngày công · Nhân viên');
  await page.locator('.gl .chip').filter({ hasText: 'Chấm công' }).click();
  await expect(page).toHaveURL(/group=cham-cong/);
  await page.locator('.gl .chip').filter({ hasText: 'Lương theo ngày công' }).click();
  await expect(page).toHaveURL(/group=ngay-cong/);
  await workdays.fill('23');

  page.once('dialog', dialog => dialog.dismiss());
  await page.goBack();
  await expect(page).toHaveURL(/group=ngay-cong/);
  await expect(workdays).toHaveValue('23');

  page.once('dialog', dialog => dialog.accept());
  await page.goBack();
  await expect(page).toHaveURL(/group=cham-cong/);
  await page.goForward();
  await expect(page).toHaveURL(/group=ngay-cong/);
  await expect(page.getByLabel('Số ngày công · Nhân viên')).toHaveValue('22');
});

test('adding a position asks before discarding an in-progress settings draft', async ({ page }) => {
  await mockSettingsApi(page);
  await page.goto('/admin/cai-dat/tat-ca?q=ph%C6%B0%C6%A1ng%20th%E1%BB%A9c&group=ngay-cong');
  const option = page.locator('[data-setting-key="pay.method"] .c button').filter({ hasText: 'Theo ngày' });
  await option.click();
  const beforeCancel = page.url();

  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Thêm chức vụ' }).click();
  await expect(page).toHaveURL(beforeCancel);
  await expect(page.locator('[data-setting-key="pay.method"] .c button.on')).toContainText('Theo ngày');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Thêm chức vụ' }).click();
  await expect(page).toHaveURL(/q=ph%C6%B0%C6%A1ng(?:\+|%20)th%E1%BB%A9c.*group=ngay-cong.*hop=them-chuc-vu/);
  await expect(page.getByRole('dialog', { name: 'Thêm chức vụ' })).toBeVisible();
  await expect(page.locator('[data-setting-key="pay.method"] .c button.on')).toContainText('Hàng tháng');
});

test('same-group item focus and chip keep drafts; reset/save leave no stale dirty prompt', async ({ page }) => {
  const api = await mockSettingsApi(page);
  await page.goto('/admin/cai-dat/tat-ca?q=ph%C6%B0%C6%A1ng%20th%E1%BB%A9c&group=ngay-cong');
  const option = page.locator('[data-setting-key="pay.method"] .c button').filter({ hasText: 'Theo ngày' });
  await option.click();
  let prompts = 0;
  page.on('dialog', dialog => {
    prompts += 1;
    void dialog.dismiss();
  });

  await page.locator('.gl .chip').filter({ hasText: 'Lương theo ngày công' }).click();
  await page.locator('.result').filter({ hasText: 'Phương thức trả lương' }).click();
  await expect(page.locator('[data-setting-key="pay.method"] .c button.on')).toContainText('Theo ngày');
  await expect.poll(() => prompts).toBe(0);

  await page.getByRole('button', { name: 'Huỷ', exact: true }).click();
  await expect(page.locator('[data-setting-key="pay.method"] .c button.on')).toContainText('Hàng tháng');
  await option.click();
  await page.getByRole('button', { name: 'Xem trước và lưu' }).click();
  await expect.poll(api.putRevision).toBe(1);
  await page.locator('.gl .chip').filter({ hasText: 'Chấm công' }).click();
  await expect(page).toHaveURL(/group=cham-cong/);
  await expect.poll(() => prompts).toBe(0);
});

test('add position guards dirty drafts; same-group navigation, reset, and save do not prompt later', async ({ page }) => {
  await mockSettingsApi(page);
  await page.goto('/admin/cai-dat/tat-ca?q=ph%C6%B0%C6%A1ng%20th%E1%BB%A9c&group=ngay-cong');
  const option = page.locator('[data-setting-key="pay.method"] .c button').filter({ hasText: 'Theo ngày' });
  await option.click();
  let prompts = 0;
  page.on('dialog', dialog => {
    prompts += 1;
    void dialog.dismiss();
  });

  await page.locator('.gl .chip').filter({ hasText: 'Lương theo ngày công' }).click();
  await expect(page.locator('[data-setting-key="pay.method"] .c button.on')).toContainText('Theo ngày');
  await page.locator('.result').filter({ hasText: 'Phương thức trả lương' }).click();
  await expect(page.locator('[data-setting-key="pay.method"] .c button.on')).toContainText('Theo ngày');
  await expect.poll(() => prompts).toBe(0);

  await page.getByRole('button', { name: 'Huỷ', exact: true }).click();
  await expect(page.locator('[data-setting-key="pay.method"] .c button.on')).toContainText('Hàng tháng');
  await page.locator('[data-setting-key="pay.method"] .c button').filter({ hasText: 'Theo ngày' }).click();
  await page.getByRole('button', { name: 'Xem trước và lưu' }).click();
  await expect.poll(() => prompts).toBe(0);
  await page.locator('.gl .chip').filter({ hasText: 'Chấm công' }).click();
  await expect(page).toHaveURL(/group=cham-cong/);
  await expect.poll(() => prompts).toBe(0);
});
