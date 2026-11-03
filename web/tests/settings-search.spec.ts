import { expect, test, type Page } from '@playwright/test';

async function mockSettingsApi(page: Page, delayParams = false, reverseParams = false) {
  let paramsReads = 0;
  let putRevision: number | null = null;
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
    else if (path === '/settings/params' && route.request().method() === 'GET') {
      const readNumber = ++paramsReads;
      if (reverseParams && readNumber === 2) await new Promise(resolve => setTimeout(resolve, 450));
      else if (reverseParams && readNumber === 3) await new Promise(resolve => setTimeout(resolve, 20));
      else if (delayParams && readNumber > 1) await new Promise(resolve => setTimeout(resolve, 180));
      paramCompletions.push(readNumber);
      body = {
        month: '2026-11',
        paramsRev: reverseParams ? readNumber : 1,
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
      putRevision = route.request().postDataJSON().expectedRev;
      body = { ok: true, paramsRev: putRevision, saved: ['pay.method'] };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return { putRevision: () => putRevision, paramsReads: () => paramsReads, paramCompletions: () => [...paramCompletions] };
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
  await page.locator('[data-setting-key="pay.method"] .c button').filter({ hasText: 'Theo ngày' }).click();
  await page.locator('.gl .chip').filter({ hasText: 'Chấm công' }).click();
  await expect.poll(api.paramsReads).toBe(2);
  await page.locator('.gl .chip').filter({ hasText: 'Lương theo ngày công' }).click();
  await expect.poll(api.paramsReads).toBe(3);
  await expect(page).toHaveURL(/group=ngay-cong/);
  await expect.poll(api.paramCompletions).toEqual([1, 3, 2]);
  await expect(page.locator('[data-setting-key="pay.method"] .c button.on')).toContainText('Theo ngày');
  await page.getByRole('button', { name: 'Xem trước và lưu' }).click();
  await expect.poll(api.putRevision).toBe(3);
});

test('dirty drafts survive rapid group changes and back navigation; route leave can be cancelled or confirmed', async ({ page }) => {
  await mockSettingsApi(page, true);
  await page.goto('/admin/cai-dat/tat-ca?q=ph%C6%B0%C6%A1ng%20th%E1%BB%A9c&group=ngay-cong&setting=pay.method');
  await page.locator('[data-setting-key="pay.method"] .c button').filter({ hasText: 'Theo ngày' }).click();
  await page.locator('.gl .chip').filter({ hasText: 'Chấm công' }).click();
  await page.locator('.gl .chip').filter({ hasText: 'Nghỉ và phép' }).click();
  await expect(page).toHaveURL(/group=nghi-phep/);
  await page.waitForTimeout(250);
  await page.goBack();
  await page.waitForTimeout(250);
  await page.goBack();
  await expect(page).toHaveURL(/group=ngay-cong.*setting=pay.method/);
  await expect(page.locator('[data-setting-key="pay.method"] .c button.on')).toContainText('Theo ngày');

  const beforeCancel = page.url();
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('nav.sub a').first().click();
  await expect(page).toHaveURL(beforeCancel);
  await expect(page.locator('[data-setting-key="pay.method"] .c button.on')).toContainText('Theo ngày');

  page.once('dialog', dialog => dialog.accept());
  await page.locator('nav.sub a').first().click();
  await expect(page).not.toHaveURL(/\/tat-ca/);
});
