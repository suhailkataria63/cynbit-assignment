import { test, expect, type Page } from "@playwright/test";
import { answers, generatedResult, result as legacyResult } from "../fixtures";
import { blueprintText } from "../../src/lib/blueprint/presentation";

import { studioSections } from "../../src/components/discovery/studio-content";

const savedResult = { ...generatedResult, blueprint: { ...generatedResult.blueprint, userSuccessCriteria: answers.success } };
async function seed(page: Page, theme: string, legacy = false) {
  let requests = 0;
  await page.route('**/api/blueprint', async route => { requests++; await route.abort(); });
  await page.addInitScript(({ theme, result, answers }) => {
    localStorage.setItem('cynbit.theme', theme);
    if (!localStorage.getItem('cynbit.discovery.v3')) localStorage.setItem('cynbit.discovery.v3', JSON.stringify({ version: 3, id: crypto.randomUUID(), answers, step: 3, result, view: 'results' }));
  }, { theme, result: legacy ? legacyResult : savedResult, answers });
  await page.goto('/workspace');
  await expect(page.locator('.blueprint-studio')).toBeVisible();
  return () => requests;
}
async function navigate(page: Page, id: string, mobile: boolean) {
  if (mobile) await page.getByLabel('In this blueprint', { exact: true }).selectOption(id);
  else {
    const index = studioSections.findIndex(section => section.id === id);
    await page.getByRole('navigation', { name: 'Blueprint sections', exact: true }).getByRole('link', { name: `${String(index + 1).padStart(2, '0')} ${studioSections[index].title}`, exact: true }).click();
  }
  await expect.poll(() => page.locator(`#blueprint-${id}`).evaluate(el => {
    const header = document.querySelector('header')!.getBoundingClientRect();
    const selector = document.querySelector('.studio-mobile-nav')!.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const offset = header.height + selector.height + 24;
    const desiredScroll = Math.max(0, Math.min(window.scrollY + rect.top - offset, document.documentElement.scrollHeight - innerHeight));
    return Math.abs(window.scrollY - desiredScroll) < 3 && rect.top >= header.bottom + selector.height && rect.top < innerHeight - 50;
  })).toBe(true);
  if (mobile) await expect(page.getByLabel('In this blueprint', { exact: true })).toHaveValue(id);
  else await expect(page.locator(`#blueprint-navigation a[href="#blueprint-${id}"]`)).toHaveAttribute('aria-current', 'location');
}

for (const theme of ['light', 'dark']) {
  test(`Blueprint Studio has continuous sections, repeated navigation and responsive collapse in ${theme}`, async ({ page, isMobile }) => {
    test.setTimeout(60_000);
    const calls = await seed(page, theme);
    const unchanged = await page.evaluate(() => localStorage.getItem('cynbit.discovery.v3'));
    const sections = studioSections;
    await expect(page.locator('[data-studio-section]')).toHaveCount(5);
    expect(await page.locator('[data-studio-section]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-studio-section')))).toEqual(sections.map(section => section.id));
    await expect(page.locator('#blueprint-summary')).toContainText(savedResult.blueprint.executiveSummary);
    await expect(page.locator('#blueprint-overview')).toContainText('Business Challenge');
    await expect(page.locator('#blueprint-overview')).toContainText('Target Outcome');
    if (!isMobile) {
      const content = page.locator('.studio-document');
      const before = (await content.boundingBox())!.width;
      await page.getByRole('button', { name: 'Collapse blueprint navigation' }).click();
      await expect(page.getByRole('button', { name: 'Expand blueprint navigation' })).toHaveAttribute('aria-expanded', 'false');
      await expect.poll(async () => (await content.boundingBox())!.width).toBeGreaterThan(before + 100);
      await page.getByRole('button', { name: 'Expand blueprint navigation' }).click();
      await expect.poll(async () => (await content.boundingBox())!.width).toBeCloseTo(before, 0);
    } else {
      await expect(page.getByRole('navigation', { name: 'Blueprint sections' })).toBeHidden();
      await expect(page.getByLabel('In this blueprint', { exact: true })).toBeVisible();
    }
    for (const id of [...sections.map(section => section.id), 'technical-architecture', 'overview', 'business-outcomes', 'implementation-plan', 'proposed-solution', 'overview', 'overview']) await navigate(page, id, isMobile);
    // Scroll spying uses actual section geometry, independently of clicks.
    await page.locator('#blueprint-proposed-solution').evaluate(el => {
      const offset = document.querySelector('header')!.getBoundingClientRect().height + document.querySelector('.studio-mobile-nav')!.getBoundingClientRect().height + 24;
      window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - offset, behavior: 'instant' });
    });
    if (isMobile) await expect(page.getByLabel('In this blueprint', { exact: true })).toHaveValue('proposed-solution');
    else await expect(page.locator('#blueprint-navigation a[href="#blueprint-proposed-solution"]')).toHaveAttribute('aria-current', 'location');
    await page.screenshot({ path: test.info().outputPath(`studio-${theme}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (isMobile) {
      await page.setViewportSize({ width: 320, height: 740 });
      await navigate(page, 'overview', true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('.studio-mobile-nav').evaluate(el => el.getBoundingClientRect().top >= document.querySelector('header')!.getBoundingClientRect().bottom - 1)).toBe(true);
    }
    expect(await page.evaluate(() => localStorage.getItem('cynbit.discovery.v3'))).toBe(unchanged);
    expect(calls()).toBe(0);
  });
}

test('Studio preserves exact KPI data in cards/table, expandable roadmap/technology, and cached exports', async ({ page, context, baseURL, isMobile }) => {
  const calls = await seed(page, 'light');
  await navigate(page, 'business-outcomes', isMobile);
  for (const kpi of savedResult.blueprint.kpis) {
    const card = page.locator('.studio-kpi').filter({ has: page.getByRole('heading', { name: kpi.metric, exact: true }) });
    await expect(card).toContainText(kpi.target);
    await expect(card).toContainText(kpi.baseline ?? 'Not provided');
    await expect(card).toContainText(kpi.measurement);
  }
  await expect(page.getByRole('article', { name: 'User-stated success criteria' })).toContainText(answers.success);
  await expect(page.locator('.studio-kpi[data-source="user-provided"]').first()).toContainText('User-provided goal');
  await expect(page.locator('.studio-kpi[data-source="AI-proposed"]')).toContainText('AI recommendation');
  await page.getByRole('button', { name: 'Table view', exact: true }).click();
  await expect(page.getByRole('table')).toContainText(answers.success);
  await expect(page.getByRole('table')).toContainText('Not provided');
  await page.getByRole('button', { name: 'Card view', exact: true }).click();
  await expect(page.getByRole('table')).toBeHidden();
  await navigate(page, 'implementation-plan', isMobile);
  const phase = page.locator('.studio-phase details').first();
  await expect(phase).not.toHaveAttribute('open', '');
  await phase.locator('summary').click(); await expect(phase).toHaveAttribute('open', '');
  await phase.locator('summary').click(); await expect(phase).not.toHaveAttribute('open', '');
  await phase.locator('summary').click();
  await expect(phase).toContainText(savedResult.blueprint.roadmap[0].exitCriteria);
  await navigate(page, 'technical-architecture', isMobile);
  const details = page.locator('#blueprint-technology details').first();
  await details.locator('summary').click();
  await expect(details.getByText(savedResult.blueprint.techStack[0].rationale, { exact: true })).toBeVisible();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL });
  await page.getByRole('button', { name: 'Copy blueprint' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Blueprint copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(blueprintText(savedResult));
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('cynbit-blueprint.json');
  const stream = await download.createReadStream();
  const chunks = []; for await (const chunk of stream!) chunks.push(chunk);
  expect(JSON.parse(Buffer.concat(chunks).toString())).toEqual(savedResult);
  await page.reload();
  await expect(page.locator('[data-studio-section]')).toHaveCount(5);
  expect(calls()).toBe(0);
});

test('legacy Studio omits absent phase fields and respects reduced motion in both themes', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const calls = await seed(page, 'light', true);
  await navigate(page, 'implementation-plan', isMobile);
  await expect(page.locator('#blueprint-roadmap').getByRole('heading', { name: 'Activities', exact: true })).toHaveCount(0);
  await expect(page.locator('#blueprint-roadmap')).not.toContainText('Dependencies');
  await expect(page.locator('#blueprint-roadmap')).toContainText(legacyResult.blueprint.roadmap[0].deliverables[0]);
  expect(await page.locator('.studio-timeline-rail').evaluate(el => getComputedStyle(el).transform)).toBe('none');
  await navigate(page, 'business-outcomes', isMobile);
  await expect(page.locator('.studio-kpi')).toContainText('Not provided');
  await expect(page.locator('.studio-kpi')).toContainText('Source not recorded');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await navigate(page, 'overview', isMobile);
  expect(await page.locator('.studio-section').first().evaluate(el => parseFloat(getComputedStyle(el).transitionDuration))).toBeLessThan(0.001);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(calls()).toBe(0);
});

test('executive overview disclosures support keyboard use and KPI columns stay readable at tablet width', async ({ page }) => {
  const calls = await seed(page, 'light');
  await page.setViewportSize({ width: 820, height: 1000 });
  await expect(page.getByLabel('In this blueprint', { exact: true })).toBeVisible();
  await expect(page.getByLabel('In this blueprint', { exact: true }).locator('option')).toHaveCount(5);
  const overview = page.locator('#blueprint-overview');
  const problem = overview.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'Problem and requirements' }) });
  await expect(problem).not.toHaveAttribute('open', '');
  await problem.locator('summary').focus(); await page.keyboard.press('Enter');
  await expect(problem).toHaveAttribute('open', '');
  await expect(problem).toContainText(savedResult.blueprint.analysis.problem);
  for (const text of savedResult.blueprint.analysis.requirements) await expect(problem).toContainText(text);
  await navigate(page, 'business-outcomes', true);
  await page.getByRole('button', { name: 'Table view', exact: true }).click();
  const widths = await page.getByRole('table').locator('thead th').evaluateAll(cells => cells.map(cell => cell.getBoundingClientRect().width));
  const total = widths.reduce((a, b) => a + b, 0);
  for (const [index, ratio] of [0.25, 0.15, 0.25, 0.35].entries()) expect(widths[index] / total).toBeCloseTo(ratio, 2);
  await expect(page.getByRole('table')).toContainText('Not provided');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(calls()).toBe(0);
});
