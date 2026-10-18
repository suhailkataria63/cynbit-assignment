import { test, expect, type Page } from "@playwright/test";
import type { Blueprint } from "../../src/lib/blueprint/schema";
import { answers, generatedResult } from "../fixtures";

async function seed(page: Page, theme = "light", dataFlow = generatedResult.blueprint.architecture.dataFlow, stepDetails?: Blueprint["architecture"]["stepDetails"]) {
  let calls = 0;
  await page.route('**/api/blueprint', async route => { calls++; await route.abort(); });
  const result = { ...generatedResult, blueprint: { ...generatedResult.blueprint, architecture: { overview: generatedResult.blueprint.architecture.overview, dataFlow, ...(stepDetails ? { stepDetails } : {}) } } };
  await page.addInitScript(({ result, answers, theme }) => {
    localStorage.setItem('cynbit.theme', theme);
    if (!localStorage.getItem('cynbit.discovery.v3')) localStorage.setItem('cynbit.discovery.v3', JSON.stringify({ version: 3, id: crypto.randomUUID(), answers, step: 3, result, view: 'results' }));
  }, { result, answers, theme });
  await page.goto('/workspace');
  const section = page.locator('#blueprint-architecture');
  await expect(section).toBeVisible();
  await section.scrollIntoViewIfNeeded();
  return { section, calls: () => calls };
}

for (const theme of ['light', 'dark']) {
  test(`architecture views, selection and complete description work in ${theme}`, async ({ page }) => {
    // Reuse saved prose at varied lengths to stress layout without new AI content.
    const step = generatedResult.blueprint.architecture.dataFlow[0];
    const steps = [step, step.repeat(8), step, step, step, step, step];
    const { section, calls } = await seed(page, theme, steps);
    const unchanged = await page.evaluate(() => localStorage.getItem('cynbit.discovery.v3'));
    const nodes = section.locator('.studio-architecture-node');
    await expect(nodes).toHaveCount(steps.length);
    await expect(section.getByRole('button', { name: 'Business View', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(nodes.first()).toHaveAttribute('aria-pressed', 'true');
    await nodes.nth(1).focus(); await page.keyboard.press('Enter');
    await expect(nodes.nth(1)).toHaveAttribute('aria-pressed', 'true');
    expect(await section.locator('.studio-architecture-node-details').evaluate(el => el.clientHeight >= el.scrollHeight)).toBe(true);
    await expect(section.getByRole('region', { name: 'Selected flow step', exact: true })).toContainText(steps[1]);
    await section.getByRole('button', { name: 'Technical View', exact: true }).click();
    await expect(nodes.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(section.locator('.studio-architecture-diagram')).toHaveAttribute('data-view', 'technical');
    await expect(section.getByRole('region', { name: 'Selected flow step', exact: true }).locator('dl')).toHaveCount(1);
    await section.getByRole('button', { name: 'Business View', exact: true }).click();
    const disclosure = section.getByRole('button', { name: 'Show full architecture description', exact: true });
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    const description = section.locator('.studio-architecture-description-content');
    await expect(description).toBeHidden();
    await disclosure.focus(); await page.keyboard.press('Space');
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    await expect(description).toBeVisible();
    await expect(description).toContainText(generatedResult.blueprint.architecture.overview);
    expect(await description.locator('ol > li').allTextContents()).toEqual(steps);
    await expect(section.getByRole('button', { name: 'Complete flow description' })).toHaveCount(0);
    await disclosure.click(); await expect(description).toBeHidden();
    await expect(nodes).toHaveCount(steps.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('cynbit.discovery.v3'))).toBe(unchanged);
    await section.screenshot({ path: test.info().outputPath(`architecture-${theme}.png`) });
    expect(calls()).toBe(0);
  });
}

test('diagram connectors follow saved order without overlap across desktop, sidebar collapse, tablet and mobile', async ({ page }) => {
  const step = generatedResult.blueprint.architecture.dataFlow[0];
  const { section, calls } = await seed(page, 'light', Array(7).fill(step));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect.poll(() => section.locator('.studio-architecture-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(3);
  async function geometry(horizontal: boolean) {
    const bounds = await section.locator('.studio-architecture-grid > li').evaluateAll(elements => elements.map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
    for (let i = 1; i < bounds.length; i++) {
      const previous = bounds[i - 1], current = bounds[i];
      if (horizontal && i % 3 !== 0) { expect(Math.abs(current.y - previous.y)).toBeLessThan(1); expect(Math.abs(current.x - previous.x)).toBeGreaterThan(previous.w); }
      else { expect(current.y).toBeGreaterThanOrEqual(previous.y + previous.h); if (horizontal) expect(Math.abs(current.x - previous.x)).toBeLessThan(1); }
    }
    expect(await section.locator('.studio-architecture-connector').count()).toBe(6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await geometry(true);
  await page.getByRole('button', { name: 'Collapse blueprint navigation' }).click();
  await expect(page.getByRole('button', { name: 'Expand blueprint navigation' })).toBeVisible();
  await expect.poll(() => section.locator('.studio-architecture-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(3);
  await expect.poll(() => page.locator('.studio-layout').evaluate(el => el.getAnimations().length)).toBe(0);
  await geometry(true);
  for (const width of [820, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => section.locator('.studio-architecture-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(1);
    await geometry(false);
  }
  expect(calls()).toBe(0);
});

test('ambiguous saved flow preserves its original description without fabricated components', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { section, calls } = await seed(page, 'dark');
  await expect(section.locator('.studio-architecture-node')).toHaveCount(1);
  await expect(section.locator('.studio-architecture-node')).toContainText('Workflow');
  await section.getByRole('button', { name: 'Show full architecture description', exact: true }).click();
  await expect(section.locator('.studio-architecture-description-content')).toContainText(generatedResult.blueprint.architecture.overview);
  await expect(section.getByRole('region', { name: 'Selected flow step', exact: true })).toContainText(generatedResult.blueprint.architecture.dataFlow[0]);
  expect(calls()).toBe(0);
});

test('technical details use explicit saved technologies and reduced motion leaves connectors static', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const technology = generatedResult.blueprint.techStack[0];
  const { section, calls } = await seed(page, 'dark', [technology.technology, ...generatedResult.blueprint.architecture.dataFlow]);
  await section.getByRole('button', { name: 'Technical View', exact: true }).click();
  const details = section.getByRole('region', { name: 'Selected flow step', exact: true });
  await expect(details).toContainText(technology.technology);
  await expect(details).toContainText(technology.component);
  await expect(details).toContainText(technology.rationale);
  expect(await section.locator('.studio-architecture-connector path').evaluateAll(elements => elements.every(el => el.getAnimations().length === 0))).toBe(true);
  await section.locator('.studio-architecture-node').nth(1).focus(); await page.keyboard.press('Space');
  await expect(details.locator('dl')).toHaveCount(0);
  expect((await details.boundingBox())!.height).toBeLessThan(150);
  expect(await section.locator('.studio-architecture-node-details').evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(calls()).toBe(0);
});

for (const theme of ['light', 'dark']) {
  test(`structured step details show available explanations in a compact responsive grid in ${theme}`, async ({ page }) => {
    const architecture = generatedResult.blueprint.architecture;
    const step = architecture.stepDetails![0];
    const supplied = [step, { ...step, title: 'Agent review', input: null, output: null, technology: [generatedResult.blueprint.techStack[0].technology] }];
    const { section, calls } = await seed(page, theme, [...architecture.dataFlow, ...architecture.dataFlow], supplied);
    const unchanged = await page.evaluate(() => localStorage.getItem('cynbit.discovery.v3'));
    const panel = section.getByRole('region', { name: 'Selected flow step', exact: true });
    await expect(panel.getByRole('heading')).toContainText(step.title);
    await expect(panel.locator('dt').filter({ hasText: /^Purpose$/ })).toBeVisible();
    for (const label of ['Input', 'Process', 'Output', 'Technology']) await expect(panel.locator('dt').filter({ hasText: new RegExp(`^${label}$`) })).toHaveCount(0);
    await expect(section.locator('.studio-architecture-node-title').first()).toContainText(step.purpose);
    await section.getByRole('button', { name: 'Technical View', exact: true }).click();
    for (const label of ['Purpose', 'Input', 'Process', 'Output']) await expect(panel.locator('dt').filter({ hasText: new RegExp(`^${label}$`) })).toBeVisible();
    for (const text of [step.purpose, step.input!, step.process, step.output!]) await expect(panel).toContainText(text);
    const technicalText = await panel.innerText();
    const technicalLabels = await section.locator('.studio-architecture-node-title').allTextContents();
    await section.getByRole('button', { name: 'Business View', exact: true }).click();
    await expect(panel).toContainText(step.purpose);
    for (const label of ['Input', 'Process', 'Output', 'Technology']) await expect(panel.locator('dt').filter({ hasText: new RegExp(`^${label}$`) })).toHaveCount(0);
    await expect(section.locator('.studio-architecture-node-title').first()).toContainText(step.purpose);
    await section.getByRole('button', { name: 'Technical View', exact: true }).click();
    expect(await panel.innerText()).toBe(technicalText);
    expect(await section.locator('.studio-architecture-node-title').allTextContents()).toEqual(technicalLabels);
    await expect(panel.locator('dt').filter({ hasText: /^Technology$/ })).toHaveCount(0);
    await panel.screenshot({ path: test.info().outputPath(`step-details-${theme}.png`) });
    await section.locator('.studio-architecture-node').nth(1).focus(); await page.keyboard.press('Enter');
    await expect(panel.getByRole('heading')).toContainText(supplied[1].title);
    for (const label of ['Input', 'Output']) await expect(panel.locator('dt').filter({ hasText: new RegExp(`^${label}$`) })).toHaveCount(0);
    await expect(panel.locator('dt').filter({ hasText: /^Technology$/ })).toBeVisible();
    await section.getByRole('button', { name: 'Technical View', exact: true }).click();
    await expect(panel).toContainText(generatedResult.blueprint.techStack[0].rationale);
    for (const width of [1280, 820, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => panel.locator('.studio-architecture-step-fields').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(width >= 640 ? 2 : 1);
      expect(await panel.evaluate(el => el.clientHeight >= el.scrollHeight)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.reload();
    await expect(panel).toContainText(step.purpose);
    expect(await page.evaluate(() => localStorage.getItem('cynbit.discovery.v3'))).toBe(unchanged);
    expect(calls()).toBe(0);
  });
}

test('different architecture granularities preserve all structured nodes and original summaries without regeneration', async ({ page }) => {
  const architecture = generatedResult.blueprint.architecture;
  const step = architecture.stepDetails![0];
  const records = [step, { ...step, title: 'Review' }, { ...step, title: 'Details'.repeat(30), purpose: 'Check.', process: 'Review.' }];
  const { section, calls } = await seed(page, 'dark', architecture.dataFlow, records);
  const nodes = section.locator('.studio-architecture-node');
  await expect(nodes).toHaveCount(records.length);
  await nodes.nth(2).focus(); await page.keyboard.press('Enter');
  const panel = section.getByRole('region', { name: 'Selected flow step', exact: true });
  await expect(panel).toContainText(records[2].title);
  await expect(panel).toContainText(records[2].purpose);
  await expect(panel.locator('dt').filter({ hasText: /^Process$/ })).toHaveCount(0);
  await section.getByRole('button', { name: 'Technical View', exact: true }).click();
  await expect(panel).toContainText(records[2].process);
  await section.getByRole('button', { name: 'Show full architecture description', exact: true }).click();
  expect(await section.locator('.studio-architecture-description-content ol > li').allTextContents()).toEqual(architecture.dataFlow);
  for (const width of [1280, 820, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(calls()).toBe(0);
});
