import { expect, test, type Page } from '@playwright/test';

async function mockAttendance(page: Page, emptySummary = false) {
  await page.route('**/api/**', async route => {
    const requestUrl = new URL(route.request().url());
    const path = requestUrl.pathname.replace('/api', '');
    let body: unknown = {};
    if (path === '/me') {
      body = {
        user: { username: 'demo_admin', name: 'Demo Admin', role: 'admin' },
        roles: ['admin'],
        caps: ['attendance.correct', 'attendance.lock', 'request.decide.*'],
        payrollSubject: true,
        serverNow: '2026-11-03T12:00:00.000Z'
      };
    } else if (/^\/periods\/\d{4}-\d{2}$/.test(path)) body = { status: 'reviewed', needsRecalculate: false };
    else if (path === '/periods') body = { periods: [] };
    else if (path.startsWith('/alerts')) body = { missingPunches: [] };
    else if (path.startsWith('/team'))
      body = {
        month: '2026-11',
        rows: emptySummary
          ? []
          : [
              {
                staff: { username: 'employee-1', name: 'Ánh Nguyễn', type: 'nv', shiftCode: 'day' },
                days: {},
                attendanceSessions: [{ id: 'punch-1', date: '2026-11-03', status: 'pending' }]
              },
              {
                staff: { username: 'employee-2', name: 'Bình Trần Nhân Sự Có Tên Dài', type: 'nv', shiftCode: 'day' },
                days: {},
                attendanceSessions: [{ id: 'punch-2', date: '2026-11-03', status: 'rejected' }]
              }
            ]
      };
    else if (path === '/today') body = { today: '2026-11-03', rows: [] };
    else if (path === '/settings/shifts')
      body = { shifts: [{ code: 'day', name: 'Ca ngày', in: '08:00', out: '17:00' }] };
    else if (path === '/holidays') body = { dates: [] };
    else if (path === '/sheet')
      body = {
        owner: {
          name: requestUrl.searchParams.get('user') === 'employee-2' ? 'Bình Trần Nhân Sự Có Tên Dài' : 'Ánh Nguyễn',
          type: 'nv',
          shiftCode: 'day'
        },
        attendanceSessions: [],
        days: {},
        approvals: {},
        rev: 1
      };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

for (const width of [375, 768, 1024, 1440]) {
  test(`timesheet stays in a keyboard-scrollable region at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockAttendance(page);
    await page.goto('/admin/cham-cong?thang=2026-11&filter=all&q=needle');
    const region = page.getByRole('region', { name: /Bảng công tháng 11/ });
    await expect(region).toBeVisible();
    if (width <= 1100) await expect(page.locator('#timesheet-scroll-help')).toBeVisible();
    const metrics = await region.evaluate(el => ({
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      columns: el.querySelectorAll('thead th').length,
      employees: [...el.querySelectorAll('tbody td:first-child')].map(cell => cell.textContent?.trim()).join(' '),
      lastColumn: el.querySelector('thead th:last-child')?.textContent?.trim(),
      overflow: getComputedStyle(el).overflowX,
      offenders: [...document.querySelectorAll<HTMLElement>('body *')]
        .filter(node => node.getBoundingClientRect().right > innerWidth + 1)
        .slice(0, 8)
        .map(node => ({ tag: node.tagName, class: node.className, right: node.getBoundingClientRect().right }))
    }));
    expect(metrics.document).toBe(0);
    expect(metrics.scrollWidth).toBeGreaterThanOrEqual(metrics.clientWidth);
    expect(metrics.columns).toBe(33);
    expect(metrics.employees).toContain('Ánh Nguyễn');
    expect(metrics.employees).toContain('Bình Trần Nhân Sự Có Tên Dài');
    expect(metrics.lastColumn).toBe('Chờ xử lý');
    expect(metrics.overflow).toBe('auto');
    if (process.env.ATTENDANCE_SCREENSHOT_DIR) {
      await page.screenshot({
        path: `${process.env.ATTENDANCE_SCREENSHOT_DIR}/admin-attendance-${width}.png`,
        fullPage: true
      });
    }
    if (metrics.scrollWidth > metrics.clientWidth) {
      await region.focus();
      await page.keyboard.press('End');
      expect(await region.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    }
    await expect(region.getByRole('columnheader', { name: 'Nhân sự' })).toBeVisible();
    await expect(region.getByRole('columnheader', { name: 'Chờ xử lý' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ngày 3, T3. Mở chấm công hôm nay' })).toBeVisible();
    const opener = page.getByRole('button', { name: 'Ánh Nguyễn, ngày 3: Lượt chờ xử lý' });
    await expect(opener).toBeVisible();

    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Ánh Nguyễn');
    await expect(dialog.locator('input, button').first()).toBeFocused();
    await expect(page).toHaveURL(/thang=2026-11.*filter=all.*q=needle.*hop=chi-tiet-ngay/);

    await page.evaluate(() => {
      const url = new URL(location.href);
      url.searchParams.set('nv', 'employee-2');
      url.searchParams.set('ngay', '2026-11-04');
      history.pushState({}, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(dialog).toContainText('Bình Trần Nhân Sự Có Tên Dài');
    await expect(dialog).toContainText('04/11/2026');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    await expect(page).toHaveURL(/thang=2026-11.*filter=all.*q=needle/);
    await expect(page).not.toHaveURL(/hop=|nv=|ngay=/);
  });
}

test('phone uses labeled employee filter and retains both Today entry points', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockAttendance(page);
  await page.goto('/admin/cham-cong?thang=2026-11');

  const filter = page.getByLabel('Lọc nhân sự');
  await expect(filter).toBeVisible();
  await filter.selectOption('pending');
  await expect(page.locator('.timesheet-scroll tbody tr')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Ánh Nguyễn, ngày 3: Lượt chờ xử lý/ })).toBeVisible();

  await page.getByRole('button', { name: 'Ngày 3, T3. Mở chấm công hôm nay' }).click();
  await expect(page.getByRole('dialog', { name: /hôm nay/i })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Hôm nay (0 đang trong ca)' }).click();
  await expect(page.getByRole('dialog', { name: /hôm nay/i })).toBeVisible();
});

test('Today title action remains available when monthly attendance summary is empty', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockAttendance(page, true);
  await page.goto('/admin/cham-cong?thang=2026-11');

  const today = page.getByRole('button', { name: 'Hôm nay', exact: true });
  await expect(today).toBeVisible();
  await today.click();
  await expect(page.getByRole('dialog', { name: 'Chấm công hôm nay' })).toBeVisible();
});
