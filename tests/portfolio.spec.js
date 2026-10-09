import { test, expect } from '@playwright/test';
import { testSettings } from './settings.js';
const origin = { Origin: testSettings.baseURL };
test('invalid server responses show a recoverable error instead of crashing', async ({ page }) => {
  await page.route('**/api/content', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<html>Unavailable</html>' }),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Portfolio unavailable' })).toBeVisible();
  await expect(
    page.getByText('The server returned an invalid response. Please try again.'),
  ).toBeVisible();
  await page.unroute('**/api/content');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'KYLE BRYAN DAVID' })).toBeVisible();
});

test('malformed JSON requests return a client error', async ({ request }) => {
  const response = await request.post('/api/auth/login', {
    headers: { ...origin, 'Content-Type': 'application/json' },
    data: '{',
  });
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: 'Request body must be valid JSON.' });
});

async function signIn(request) {
  const result = await request.post('/api/auth/login', {
    headers: origin,
    data: { password: testSettings.adminPassword },
  });
  expect(result.ok()).toBeTruthy();
}
test('public content and project interaction render without runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'KYLE BRYAN DAVID' })).toBeVisible();
  await page.getByRole('button', { name: 'View PawFolio', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'PawFolio' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('#skills').scrollIntoViewIfNeeded();
  await expect(page.getByRole('img', { name: 'Python: 75%' }).locator('span')).toHaveText('75%');
  await page.locator('#software').scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: 'SOFTWARES KNOWN' })).toBeVisible();
  for (const id of ['about', 'projects', 'skills', 'software', 'contact']) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
  }
  await expect(page.getByRole('heading', { name: 'KYLE BRYAN DAVID' })).toHaveText(
    'KYLE BRYAN DAVID',
  );
  await page.locator('.software-card').last().scrollIntoViewIfNeeded();
  await expect(page.locator('.software-list .reveal').last()).toHaveClass(/visible/);
  await page.waitForTimeout(850);
  await page.screenshot({ path: 'reference/desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('mobile layout fits and navigation works', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'KYLE BRYAN DAVID' })).toBeVisible();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Skills', exact: true }).click();
  await expect(page).toHaveURL(/#skills$/);
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  for (const id of ['about', 'projects', 'skills', 'software', 'contact'])
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
  await page.locator('.software-card').last().scrollIntoViewIfNeeded();
  await page.waitForTimeout(850);
  await page.screenshot({ path: 'reference/mobile.png', fullPage: true });
});
test('reduced motion displays final name, role, and percentages', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'KYLE BRYAN DAVID' })).toHaveText(
    'KYLE BRYAN DAVID',
  );
  await expect(page.locator('.typed-role')).toHaveText('Programming');
  await expect(page.getByRole('img', { name: 'Python: 75%' }).locator('span')).toHaveText('75%');
});
test('content writes and uploads require authentication and allowed origin', async ({
  request,
}) => {
  const read = await request.get('/api/content');
  const record = await read.json();
  expect((await request.put('/api/content', { headers: origin, data: record })).status()).toBe(401);
  expect((await request.post('/api/uploads', { headers: origin })).status()).toBe(401);
  expect(
    (
      await request.post('/api/auth/login', { headers: origin, data: { password: 'wrong' } })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post('/api/auth/login', {
        headers: { Origin: 'https://untrusted.example' },
        data: { password: testSettings.adminPassword },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post('/api/auth/login', { data: { password: testSettings.adminPassword } })
    ).status(),
  ).toBe(403);
});
test('editor saves and reloads persisted content, previews drafts, and uploads images', async ({
  page,
  request,
}) => {
  const original = await (await request.get('/api/content')).json();
  await page.goto('/admin');
  await page.getByLabel('Admin password').fill(testSettings.adminPassword);
  await page.getByRole('button', { name: 'Sign in →' }).click();
  await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible();
  try {
    await page.getByLabel('Greeting', { exact: true }).fill('Hello from the editor');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(
      page
        .getByRole('dialog', { name: 'Draft portfolio preview' })
        .getByText('Hello from the editor', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Back to editor' }).click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('status')).toHaveText(
      'Changes saved. Your portfolio is up to date.',
    );
    await page.reload();
    await expect(page.getByLabel('Greeting', { exact: true })).toHaveValue('Hello from the editor');
    await page.goto('/');
    await expect(page.getByText('Hello from the editor', { exact: true })).toBeVisible();
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible();
    await page.screenshot({ path: 'reference/admin.png', fullPage: true });
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );
    await page
      .locator('.asset-field')
      .filter({ has: page.getByLabel('Hero portrait', { exact: true }) })
      .locator('input[type=file]')
      .setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByLabel('Hero portrait', { exact: true })).toHaveValue(
      /\/uploads\/.+\.png/,
    );
    const src = await page.getByLabel('Hero portrait', { exact: true }).inputValue();
    expect((await request.get(src)).ok()).toBeTruthy();
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    await page.getByRole('button', { name: '+ Add project' }).click();
    await expect(page.getByRole('heading', { name: 'Project 4' })).toBeVisible();
  } finally {
    await signIn(request);
    const current = await (await request.get('/api/content')).json();
    expect(
      (
        await request.put('/api/content', {
          headers: origin,
          data: { content: original.content, revision: current.revision },
        })
      ).ok(),
    ).toBeTruthy();
    // Restore before leaving the editor, so test drafts do not trigger a leave warning.
    page.on('dialog', (dialog) => dialog.accept());
  }
});
test('invalid content, stale updates, and unsupported uploads are rejected', async ({
  request,
}) => {
  await signIn(request);
  const original = await (await request.get('/api/content')).json();
  expect(
    (
      await request.put('/api/content', {
        headers: origin,
        data: { ...original, content: { ...original.content, email: 'invalid' } },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post('/api/uploads', {
        headers: origin,
        multipart: {
          file: {
            name: 'bad.html',
            mimeType: 'text/html',
            buffer: Buffer.from('<script>alert(1)</script>'),
          },
        },
      })
    ).status(),
  ).toBe(400);
  const first = await request.put('/api/content', { headers: origin, data: original });
  expect(first.ok()).toBeTruthy();
  expect((await request.put('/api/content', { headers: origin, data: original })).status()).toBe(
    409,
  );
  const latest = await first.json();
  expect(
    (
      await request.put('/api/content', {
        headers: origin,
        data: { content: original.content, revision: latest.revision },
      })
    ).ok(),
  ).toBeTruthy();
  await request.post('/api/auth/logout', { headers: origin });
  expect((await request.get('/api/auth/session')).status()).toBe(401);
});
