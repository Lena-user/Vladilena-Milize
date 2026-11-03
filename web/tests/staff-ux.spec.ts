import { expect, test, type Page } from '@playwright/test';

const me = {
  user: {
    username: 'demo_staff',
    name: 'Linh Nguyễn',
    givenName: 'Linh',
    role: 'staff',
    shiftCode: 'day',
    startDate: '2026-01-01',
    jobTitle: 'Nhân viên'
  },
  roles: ['staff'],
  caps: [],
  payrollSubject: true,
  serverNow: '2026-11-03T12:00:00.000Z',
  positionLabel: 'Nhân viên',
  geofenceRequired: true,
  benefits: { paidLeave: true },
  holidays: []
};

const session = {
  id: 'session-1',
  date: '2026-11-02',
  state: 'closed',
  status: 'checked-out',
  entry: {
    presIn: '2026-11-02T01:00:00.000Z',
    presOut: null,
    reason: 'forgot-out',
    requestedOut: false
  }
};

const sheet = {
  month: '2026-11',
  rev: 1,
  days: {},
  approvals: {},
  actualReport: { missing: [], report: {} },
  scheduledDates: Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`),
  attendanceSessions: [session],
  workSchedule: { describe: { label: 'Thứ Hai đến Thứ Sáu' } },
  leaveBalance: { balance: 8, granted: 12, used: 4 },
  kpiParts: {}
};

const punch = {
  serverNow: me.serverNow,
  canCheckIn: true,
  open: null,
  lastSession: null,
  done: null,
  shiftConfig: { shifts: { day: { name: 'Ca ngày', start: '08:00', end: '17:00' } } }
};

const estimate = {
  m: { count: 2, total: 120000, net: { net: 120000, gross: 120000 } },
  net: { net: 120000, gross: 120000 },
  toDate: { count: 2, upTo: '2026-11-03' },
  label: 'Ước tính tạm thời'
};

function dataFor(path: string) {
  if (path === '/me') return me;
  if (path === '/punch') return punch;
  if (path === '/explanations') return { items: [], absent: [] };
  if (path.startsWith('/sheet')) return sheet;
  if (path.startsWith('/me/estimate')) return estimate;
  if (path.startsWith('/advance-approvals')) return { items: [], rev: 1 };
  return {};
}

async function mockStaffApi(
  page: Page,
  failures: Record<string, number> = {},
  options: {
    me?: Partial<typeof me>;
    punchGate?: Promise<void>;
    onPunch?: () => void;
    failAt?: Record<string, number[]>;
    requestGates?: Record<string, Promise<void>>;
    onRequest?: (key: string) => void;
  } = {}
) {
  const hits: Record<string, number> = {};
  const queryHits: Record<string, number> = {};
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api', '');
    const requestKey = path + url.search;
    options.onRequest?.(requestKey);
    hits[path] = (hits[path] || 0) + 1;
    queryHits[requestKey] = (queryHits[requestKey] || 0) + 1;
    if (path.includes('/payslips/')) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
      return;
    }
    const failCount = failures[requestKey] ?? failures[path] ?? 0;
    const hitCount = failures[requestKey] === undefined ? hits[path] : queryHits[requestKey];
    if (options.requestGates?.[requestKey]) await options.requestGates[requestKey];
    if (hitCount <= failCount || options.failAt?.[path]?.includes(hits[path])) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Server temporarily unavailable' })
      });
      return;
    }
    if (path === '/punch' && route.request().method() === 'POST') {
      options.onPunch?.();
      if (options.punchGate) await options.punchGate;
    }
    const body = path === '/me' ? { ...me, ...options.me } : dataFor(path);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

for (const screen of [
  { path: '/nv/cham-cong', previousData: '.stats', query: '/sheet?month=2026-10' },
  { path: '/nv/thu-nhap', previousData: '.slip', query: '/me/estimate?month=2026-10' }
]) {
  test(`${screen.path} hides the previous month's values while the new month request is pending or fails`, async ({
    page
  }) => {
    let releaseRequest: () => void = () => {};
    let monthAttempts = 0;
    const requestGate = new Promise<void>(resolve => (releaseRequest = resolve));
    await page.setViewportSize({ width: 375, height: 812 });
    await mockStaffApi(
      page,
      { [screen.query]: 1 },
      {
        requestGates: { [screen.query]: requestGate },
        onRequest: key => {
          if (key === screen.query) monthAttempts++;
        }
      }
    );
    await page.goto(screen.path);
    await expect(page.locator(screen.previousData)).toBeVisible();

    await page.getByRole('button', { name: 'Tháng trước' }).click();
    await expect(page.getByText('Tháng 10/2026')).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Đang tải dữ liệu');
    await expect(page.locator(screen.previousData)).toHaveCount(0);
    await expect.poll(() => monthAttempts).toBe(1);
    releaseRequest();
    await expect(page.getByRole('alert')).toContainText('Máy chủ trả lỗi 500');
    await expect(page.locator(screen.previousData)).toHaveCount(0);
    expect(monthAttempts).toBe(1);
  });
}

for (const path of ['/nv/cham-cong', '/nv/thu-nhap']) {
  test(`${path} handles month context 500 with retry and no unhandled rejection`, async ({ page }) => {
    const pageErrors: string[] = [];
    let meRequests = 0;
    await page.setViewportSize({ width: 375, height: 812 });
    page.on('pageerror', error => pageErrors.push(error.message));
    await mockStaffApi(
      page,
      {},
      {
        failAt: { '/me': [2] },
        onRequest: key => {
          if (key === '/me') meRequests++;
        }
      }
    );
    await page.goto(path);
    await expect(page.getByRole('alert')).toContainText('Máy chủ trả lỗi 500');
    await expect(pageErrors).toEqual([]);
    expect(meRequests).toBe(2);
    await page.getByRole('button', { name: 'Thử lại' }).click();
    await expect(page.locator(path.endsWith('cham-cong') ? '.stats' : '.slip')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(pageErrors).toEqual([]);
    expect(meRequests).toBe(3);
  });
}

test('home disables check-in while a slow request is pending and prevents duplicate punches', async ({ page }) => {
  let punchPosts = 0;
  let releasePunch: () => void = () => {};
  const punchGate = new Promise<void>(resolve => (releasePunch = resolve));
  await page.setViewportSize({ width: 375, height: 812 });
  await mockStaffApi(page, {}, { me: { geofenceRequired: false }, punchGate, onPunch: () => punchPosts++ });
  await page.goto('/nv/hom-nay');
  const checkIn = page.locator('.cta');
  const firstClick = checkIn.click();
  await expect.poll(() => punchPosts).toBe(1);
  await expect(checkIn).toBeDisabled();
  await expect(checkIn).toContainText('Đang xử lý');
  await checkIn.click({ force: true });
  expect(punchPosts).toBe(1);
  releasePunch();
  await firstClick;
  await expect(checkIn).toBeEnabled();
  expect(punchPosts).toBe(1);
});

const phoneScreens = [
  { path: '/nv/hom-nay', failure: '/punch', failCount: 1, loaded: '.home' },
  { path: '/nv/cham-cong', failure: '/sheet', failCount: 1, loaded: '.stats' },
  { path: '/nv/yeu-cau', failure: '/sheet', failCount: 1, loaded: '.req' },
  { path: '/nv/thu-nhap', failure: '/me/estimate', failCount: 1, loaded: '.slip' },
  { path: '/nv/toi', failure: '/punch', failCount: 1, loaded: '.toi' }
];

for (const screen of phoneScreens) {
  test(`phone ${screen.path} presents retry after 500 and loads after 200`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockStaffApi(page, { [screen.failure]: screen.failCount });
    await page.goto(screen.path);

    await expect(page.getByRole('alert')).toContainText('Máy chủ trả lỗi 500');
    const retry = page.getByRole('button', { name: 'Thử lại' });
    await expect(retry).toBeVisible();
    await retry.click();
    await expect(page.locator(screen.loaded)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);

    const tabs = page.getByRole('navigation', { name: 'Điều hướng' }).getByRole('link');
    await expect(tabs).toHaveCount(5);
    await expect(tabs).toHaveText(['Hôm nay', 'Chấm công', 'Yêu cầu', 'Thu nhập', 'Tôi']);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBe(0);
  });
}

test('nested staff sheets trap focus and Escape closes only the top sheet', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockStaffApi(page);
  await page.goto('/nv/cham-cong');
  const day = page.getByRole('button', { name: '2', exact: true });
  await day.click();
  const dialogs = page.getByRole('dialog');
  await expect(dialogs).toHaveCount(1);
  await page.getByRole('button', { name: 'Giải trình lượt này' }).click();
  await expect(dialogs).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Đóng' }).last()).toBeFocused();
  await expect(page.locator('html')).toHaveCSS('overflow', 'hidden');

  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Gửi giải trình' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialogs).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Giải trình lượt này' })).toBeFocused();
  await expect(page.locator('html')).toHaveCSS('overflow', 'hidden');

  await page.locator('.ph-sheet .sheet-close').click();
  await expect(dialogs).toHaveCount(0);
  await expect(day).toBeFocused();
  await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
});

for (const [width, columnCount] of [
  [768, 1],
  [1024, 1],
  [1440, 3]
] as const) {
  test(`staff desktop keeps its task order without overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await mockStaffApi(page);
    await page.goto('/nv-may-tinh?kb=linh');
    const columns = page.locator('.pg > .col');
    await expect(columns).toHaveCount(3);
    await expect(columns.nth(0)).toContainText('Ca hôm nay');
    await expect(columns.nth(1)).toContainText('Chấm công tháng');
    await expect(columns.nth(2)).toContainText('Thu nhập');
    await expect(columns.nth(2)).toContainText('Yêu cầu');
    const metrics = await page.locator('.pg').evaluate(el => ({
      columns: getComputedStyle(el).gridTemplateColumns.split(' ').length,
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth
    }));
    expect(metrics.columns).toBe(columnCount);
    expect(metrics.pageWidth).toBe(metrics.viewportWidth);
  });
}
