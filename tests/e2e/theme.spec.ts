import { test, expect, type Locator } from "@playwright/test";
import { answers, generatedResult } from "../fixtures";

async function expectContrast(locator: Locator, background?: string) {
  // WCAG relative luminance, using the browser's resolved sRGB colors.
  const ratio = await locator.evaluate((el, backdrop) => {
    const rgb = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const luminance = (value: string) => rgb(value).reduce((sum, channel, i) => {
      const s = channel / 255;
      return sum + (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i];
    }, 0);
    let node: Element | null = el;
    let bg = backdrop;
    while (!bg && node) {
      const color = getComputedStyle(node).backgroundColor;
      if (color.startsWith('rgb(')) bg = color;
      node = node.parentElement;
    }
    const a = luminance(getComputedStyle(el).color), b = luminance(bg ?? getComputedStyle(document.body).backgroundColor);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }, background);
  expect(ratio).toBeGreaterThanOrEqual(4.5);
}

test('theme toggles with animated icons, persists on refresh and workspace navigation without API requests', async ({ page, isMobile }) => {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  let calls = 0;
  await page.route('**/api/blueprint', async route => { calls++; await route.abort(); });
  await page.goto('/');
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(248, 247, 244)');
  await expect(page.locator('.theme-sun')).toHaveCSS('opacity', '1');
  const toggle = page.getByRole('button', { name: 'Switch to dark theme' });
  const buttonBounds = await toggle.boundingBox();
  await toggle.click();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.theme-moon')).toHaveCSS('opacity', '1');
  await expect(page.locator('.theme-sun')).toHaveCSS('opacity', '0');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(20, 29, 35)');
  expect(await page.locator('.theme-toggle').boundingBox()).toEqual(buttonBounds);
  await expectContrast(page.locator('body'));
  await expectContrast(page.locator('header a').first());
  await page.screenshot({ path: test.info().outputPath('dark-homepage.png'), fullPage: true });
  // Existing transform animations continue in dark mode.
  const ring = page.locator('.orbit-one');
  const start = await ring.evaluate(el => getComputedStyle(el).transform);
  await expect.poll(() => ring.evaluate(el => getComputedStyle(el).transform)).not.toBe(start);
  const preview = page.locator('.preview-card');
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toHaveCSS('background-color', 'rgb(29, 41, 47)');
  await expectContrast(preview);
  await page.reload();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
  if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Open workspace' }).click();
  await expect(page.locator('#field-industry')).toBeVisible();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expectContrast(page.locator('#field-industry'));
  await expectContrast(page.locator('#field-description'));
  await page.getByRole('button', { name: 'Switch to light theme' }).focus();
  await page.keyboard.press('Enter');
  await expect(root).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.theme-sun')).toHaveCSS('opacity', '1');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(248, 247, 244)');
  await page.reload();
  await expect(root).toHaveAttribute('data-theme', 'light');
  expect(calls).toBe(0);
  expect(failures).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('dark questionnaire stages and cached blueprint remain readable without changing saved data', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/blueprint', async route => { calls++; await route.abort(); });
  await page.addInitScript(({ answers, result }) => {
    localStorage.setItem('cynbit.theme', 'dark');
    if (!localStorage.getItem('cynbit.discovery.v3')) localStorage.setItem('cynbit.discovery.v3', JSON.stringify({ version: 3, id: crypto.randomUUID(), answers, step: 3, result, view: 'results' }));
  }, { answers, result: generatedResult });
  await page.goto('/workspace');
  await expect(page.getByRole('heading', { name: 'Your solution blueprint.' })).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem('cynbit.discovery.v3'));
  await page.locator('summary').filter({ hasText: 'Benefits & measurable KPIs' }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await expectContrast(page.getByRole('columnheader', { name: 'KPI', exact: true }));
  await expectContrast(page.getByRole('table').locator('td').first());
  await expectContrast(page.locator('summary').first());
  await page.screenshot({ path: test.info().outputPath('dark-blueprint.png'), fullPage: true });
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  expect(await page.evaluate(() => localStorage.getItem('cynbit.discovery.v3'))).toBe(saved);
  await page.getByRole('button', { name: 'Back to Questionnaire' }).click();
  for (const [stage, field] of [['Business', '#field-industry'], ['Challenge', '#field-problem'], ['Requirements', '#field-timeline']]) {
    await page.getByRole('button', { name: stage, exact: true }).click();
    await expect(page.locator(field)).toBeVisible();
    await expectContrast(page.locator(field));
  }
  await expectContrast(page.locator('#field-budget'));
  await expectContrast(page.locator('#field-budgetCurrency'));
  expect(calls).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('reduced motion disables theme icon motion and retains static decorative effects', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('.theme-moon')).toHaveCSS('opacity', '1');
  expect(await page.locator('.theme-moon').evaluate(el => parseFloat(getComputedStyle(el).transitionDuration))).toBeLessThan(0.001);
  await expect(page.locator('.orbit-one')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.preview-card')).toHaveCSS('animation-name', 'none');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('.theme-sun')).toHaveCSS('opacity', '1');
});

test('saved dark preference is applied before hydration, including when scripts cannot hydrate', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: true });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('cynbit.theme', 'dark'));
  // Block application JS: the synchronous head script must style the server HTML itself.
  await page.route('**/_next/**/*.js*', route => route.abort());
  await page.goto(baseURL!);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(20, 29, 35)');
  await expect(page.locator('.theme-moon')).toHaveCSS('opacity', '1');
  await context.close();
});

test('dark theme preserves ambient motion, hover effects and CTA spotlight interactions', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => localStorage.setItem('cynbit.theme', 'dark'));
  await page.goto('/');
  for (const selector of ['.particle-one', '.preview-card', '.preview-decor .architecture-ambient']) {
    const element = page.locator(selector);
    const start = await element.evaluate(el => getComputedStyle(el).transform);
    await expect.poll(() => element.evaluate(el => getComputedStyle(el).transform)).not.toBe(start);
  }
  if (!isMobile) {
    const step = page.locator('.process-step').first();
    await page.locator('.process-step-hover').first().hover();
    await expect(step).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, -4)');
    const capability = page.locator('.capability-card').first();
    await capability.hover();
    await expect(capability).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, -4)');
  }
  const cta = page.locator('.cta-spotlight-card');
  await cta.scrollIntoViewIfNeeded();
  if (!isMobile) {
    await cta.hover({ position: { x: 50, y: 60 } });
    await expect(cta).toHaveAttribute('data-spotlight-active', 'true');
    await expect(cta.locator('.cta-spotlight')).toHaveCSS('opacity', '1');
  } else {
    await expect(cta.locator('.cta-spotlight')).toHaveCSS('opacity', '0.5');
  }
  await expectContrast(cta);
  await cta.getByRole('link', { name: 'Start AI Discovery' }).click();
  await expect(page.locator('#field-industry')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expectContrast(page.getByRole('alert').filter({ hasText: 'Please complete the highlighted fields' }));
  await expectContrast(page.locator('#error-industry'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
