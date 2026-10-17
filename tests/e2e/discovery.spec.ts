import { test, expect, type Page } from "@playwright/test";
import { groundKpis } from "../../src/lib/blueprint/grounding";
import { answers, result, generatedResult } from "../fixtures";

async function business(page: Page) {
  await page.locator('#field-industry').selectOption(answers.industry);
  await page.locator('#field-description').fill(answers.description);
}
async function challenge(page: Page) {
  await page.locator('#field-focus').selectOption("Customer support");
  await page.locator('#field-problem').fill(answers.problem);
  await page.locator('#field-workflow').fill(answers.workflow);
  await page.getByLabel("Repetitive manual work", { exact: true }).check();
  await page.getByLabel("Support agents", { exact: true }).check();
}
async function requirements(page: Page) {
  await page.getByLabel("Improve quality", { exact: true }).check();
  await page.locator('#field-success').fill(answers.success);
}
async function review(page: Page) {
  await page.goto('/workspace'); await business(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await challenge(page); await page.getByRole('button', { name: 'Next', exact: true }).click();
  await requirements(page); await page.getByRole('button', { name: 'Review answers' }).click();
  await expect(page.getByRole('heading', { name: 'A moment to review.' })).toBeVisible();
}

test('wizard validates, navigates, persists, and generates once; cached results support viewing/copy/export', async ({ page, context, baseURL }) => {
  let calls = 0;
  await page.route('**/api/blueprint', async route => {
    calls++; expect(route.request().postDataJSON()).not.toHaveProperty('model');
    await new Promise(resolve => setTimeout(resolve, 350));
    await route.fulfill({ status: 200, json: result });
  });
  await page.goto('/workspace');
  await expect(page.getByRole('link', { name: 'Skip to content' })).not.toBeInViewport();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Please complete' })).toBeVisible();
  await business(page); await page.reload();
  await expect(page.locator('#field-description')).toHaveValue(answers.description);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.locator('#field-focus').selectOption('Recruitment');
  await expect(page.locator('#field-monthlyApplications')).toBeVisible();
  await page.locator('#field-focus').selectOption('Business automation');
  await expect(page.locator('#field-manualHours')).toBeVisible();
  await page.locator('#field-focus').selectOption('SaaS development');
  await expect(page.locator('#field-productStatus')).toBeVisible();
  await challenge(page);
  await expect(page.locator('#field-supportVolume')).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('#field-description')).toHaveValue(answers.description);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('#field-timeline')).toHaveValue('Flexible');
  await requirements(page);
  await page.getByRole('button', { name: 'Review answers' }).click();
  expect(calls).toBe(0);
  await page.getByRole('button', { name: 'Generate Blueprint', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Generating blueprint…' })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Your solution blueprint.' })).toBeVisible();
  expect(calls).toBe(1);
  await expect(page.getByText('11 of 12 attempts remaining today')).toBeVisible();
  await expect(page.getByText('openai/gpt-oss-120b', { exact: true })).toBeVisible();
  await page.getByRole('heading', { name: 'Risks, assumptions & limitations', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByText('Helpdesk integration details are unspecified.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Questionnaire' }).click();
  await page.getByRole('button', { name: 'View saved blueprint', exact: true }).first().click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your solution blueprint.' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('blueprint.png'), fullPage: true });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL });
  await page.getByRole('button', { name: 'Copy blueprint' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Blueprint copied' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  expect((await download).suggestedFilename()).toBe('cynbit-blueprint.json');
  expect(calls).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByRole('button', { name: 'New Discovery' }).click();
  await expect(page.locator('#field-description')).toHaveValue('');
  await expect(page.getByText('11 of 12 attempts remaining today')).toBeVisible();
});

test('429 preserves reviewed answers and charges one attempt without automatic retry', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/blueprint', async route => { calls++; await route.fulfill({ status: 429, json: { error: 'Provider quota reached. Your answers are preserved.', generationDetails: { provider: 'groq', model: 'openai/gpt-oss-120b', usage: { inputTokens: null, outputTokens: null, totalTokens: null, durationMs: 200, requestedAt: '2026-10-17T12:00:00.000Z', status: 'failure' } } } }); });
  await review(page);
  await page.getByRole('button', { name: 'Generate Blueprint', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Provider quota reached' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Generation Details' })).toContainText('Failure');
  await expect(page.getByText('11 of 12 attempts remaining today')).toBeVisible();
  await page.reload();
  await expect(page.getByText(answers.description, { exact: true })).toBeVisible();
  expect(calls).toBe(1);
});

test('daily budget exhaustion blocks generation; navigation and page loads never call API', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/blueprint', async route => { calls++; await route.abort(); });
  await page.goto('/workspace');
  await page.evaluate(() => { const d = new Date(); localStorage.setItem('cynbit.attempts.v3', JSON.stringify({ date: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`, count: 12 })); });
  await review(page);
  await expect(page.getByText('0 of 12 attempts remaining today')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate Blueprint', exact: true })).toBeDisabled();
  expect(calls).toBe(0);
});

test('duplicate clicks and parallel tabs cannot create additional requests or spend extra attempts', async ({ page, context }) => {
  let calls = 0; let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await context.route('**/api/blueprint', async route => { calls++; await gate; await route.fulfill({ status: 200, json: result }); });
  await review(page);
  const other = await context.newPage(); await other.goto('/workspace');
  await expect(other.getByRole('heading', { name: 'A moment to review.' })).toBeVisible();
  await page.getByRole('button', { name: 'Generate Blueprint', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Generating blueprint…' })).toBeDisabled();
  await other.getByRole('button', { name: 'Generate Blueprint', exact: true }).click();
  await expect(other.getByRole('alert').filter({ hasText: 'Another tab is generating' })).toBeVisible();
  expect(calls).toBe(1);
  release();
  await expect(page.getByRole('heading', { name: 'Your solution blueprint.' })).toBeVisible();
  await other.getByRole('button', { name: 'Generate Blueprint', exact: true }).click();
  await expect(other.getByRole('heading', { name: 'Your solution blueprint.' })).toBeVisible();
  await expect(other.getByText('11 of 12 attempts remaining today')).toBeVisible();
  expect(calls).toBe(1);
});

test('structured sections and actual response metrics survive reload with no extra request', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/blueprint', async route => { calls++; await route.fulfill({ status: 200, json: generatedResult }); });
  await review(page);
  await page.getByRole('button', { name: 'Generate Blueprint', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your solution blueprint.' })).toBeVisible();
  const details = page.getByRole('region', { name: 'Generation Details' });
  await expect(details).toContainText('1,234'); await expect(details).toContainText('567');
  await expect(details).toContainText('1,801'); await expect(details).toContainText('8.2 seconds');
  await expect(details).toContainText('Success');
  await page.getByRole('heading', { name: 'Risks, assumptions & limitations', exact: true }).scrollIntoViewIfNeeded();
  for (const name of ['Risks', 'Assumptions', 'Missing Information', 'Limitations']) {
    const group = page.getByRole('region', { name, exact: true });
    await expect(group.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(group.getByRole('list')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Table view', exact: true }).click();
  const table = page.getByRole('table');
  for (const name of ['KPI', 'Current Baseline', 'Proposed Target', 'Measurement Method']) await expect(table.getByRole('columnheader', { name, exact: true })).toBeVisible();
  await expect(table).toContainText('Not provided'); await expect(table).toContainText('User-provided goal'); await expect(table).toContainText('AI recommendation');
  await page.getByRole('heading', { name: 'Technology stack', exact: true }).scrollIntoViewIfNeeded();
  const technology = page.locator('#blueprint-technology');
  await expect(technology).toContainText('Next.js'); await expect(technology).toContainText('Justification');
  await page.getByRole('heading', { name: 'Phased implementation roadmap', exact: true }).scrollIntoViewIfNeeded();
  await page.locator('.studio-phase summary').first().click();
  await expect(page.getByRole('heading', { name: 'Activities', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.reload(); await expect(details).toContainText('1,234');
  expect(calls).toBe(1);
});

test('legacy cached blueprints render missing metadata without regeneration or discarded answers', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/blueprint', async route => { calls++; await route.abort(); });
  await page.addInitScript(({ result, answers }) => {
    if (!localStorage.getItem('cynbit.discovery.v3')) localStorage.setItem('cynbit.discovery.v3', JSON.stringify({ version: 3, id: crypto.randomUUID(), answers, step: 3, result, view: 'results' }));
  }, { result, answers });
  await page.goto('/workspace');
  await expect(page.getByRole('heading', { name: 'Your solution blueprint.' })).toBeVisible();
  const details = page.getByRole('region', { name: 'Generation Details' });
  await expect(details).toContainText('Unavailable'); await expect(details).toContainText('no recorded usage metadata');
  await page.getByRole('button', { name: 'Table view', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('Not provided');
  await expect(page.getByRole('table')).toContainText('Source not recorded');
  await page.getByRole('button', { name: 'Back to Questionnaire' }).click();
  await expect(page.getByText(answers.description, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View saved blueprint' }).first().click();
  await page.reload();
  expect(calls).toBe(0);
});


test('hero decoration stays responsive, ignores pointer input, and stops in reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const scene = page.locator('.architecture-scene');
  await expect(scene).toContainText('Your business vision');
  await expect(scene).toContainText('Cynbit discovery');
  await expect(scene).toContainText('Architecture');
  const decor = scene.locator('.architecture-decor');
  await expect(decor).toHaveAttribute('aria-hidden', 'true');
  expect(await decor.evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  expect(await scene.locator('.architecture-particle').count()).toBe(4);
  const animation = await scene.locator('.architecture-orbit').evaluateAll(elements => elements.map(el => ({ name: getComputedStyle(el).animationName, duration: parseFloat(getComputedStyle(el).animationDuration), direction: getComputedStyle(el).animationDirection })));
  expect(animation.every(value => value.name === 'architecture-turn' && value.duration >= 25 && value.duration <= 55)).toBeTruthy();
  expect(animation[1].direction).toBe('reverse');
  const size = await scene.evaluate(el => ({ width: el.clientWidth, height: el.clientHeight }));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await decor.locator(':scope > *').evaluateAll(elements => elements.every(el => getComputedStyle(el).animationName === 'none'))).toBeTruthy();
  expect(await scene.evaluate(el => ({ width: el.clientWidth, height: el.clientHeight }))).toEqual(size);
  await page.getByRole('link', { name: 'Start AI Discovery' }).first().click();
  await expect(page).toHaveURL(/\/workspace$/);
});

test('timeline and currency budget align, persist, and serialize without changing explicit KPI goals', async ({ page }) => {
  let calls = 0;
  const userTarget = 'Reduce screening time by 60%.';
  await page.route('**/api/blueprint', async route => {
    calls++;
    const payload = route.request().postDataJSON();
    expect(payload.answers.budget).toBe('USD 300,000–500,000');
    const modelBlueprint = { ...generatedResult.blueprint, kpis: [
      { metric: 'Screening time reduction', target: '40% reduction', targetSource: 'user-provided' as const, baseline: '10 hours today', measurement: 'Measure screening time before and after the pilot.' },
      { metric: 'Pilot quality', target: 'Agree a quality threshold', targetSource: 'AI-proposed' as const, baseline: null, measurement: 'Review pilot samples.' },
    ] };
    await route.fulfill({ status: 200, json: { ...generatedResult, blueprint: groundKpis(modelBlueprint, payload.answers) } });
  });
  await review(page);
  await page.getByRole('button', { name: 'Edit requirements answers' }).click();
  const currency = page.getByRole('combobox', { name: 'Budget currency' });
  const amount = page.locator('#field-budget');
  await expect(currency).toHaveValue('INR'); await expect(amount).toHaveValue('');
  await expect(amount).toHaveAttribute('placeholder', 'e.g. 300,000–500,000');
  expect(await currency.locator('option').count()).toBe(9);
  // Read geometry atomically: focus-triggered smooth scrolling can otherwise
  // change viewport coordinates between separate automation round trips.
  const boxes = await page.evaluate(() => {
    const rect = (selector: string) => { const r = document.querySelector(selector)!.getBoundingClientRect(); return { y: r.y, height: r.height }; };
    return { timeline: rect('#field-timeline'), amount: rect('#field-budget'), currency: rect('#field-budgetCurrency'), timelineLabel: rect('label[for="field-timeline"]'), budgetLabel: rect('label[for="field-budget"]'), hint: rect('#hint-budget') };
  });
  const { timeline: t, amount: a, currency: c } = boxes;
  expect(t.height).toBe(a.height); expect(c.height).toBe(a.height);
  if (page.viewportSize()!.width >= 768) {
    expect(Math.abs(t.y - a.y)).toBeLessThan(1);
    expect(Math.abs(boxes.timelineLabel.y - boxes.budgetLabel.y)).toBeLessThan(1);
  } else expect(a.y).toBeGreaterThan(t.y + t.height);
  expect(boxes.hint.y).toBeGreaterThanOrEqual(a.y + a.height);
  await currency.selectOption('USD'); await amount.fill('300,000–500,000');
  await page.locator('#field-success').fill(userTarget);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(currency).toHaveValue('USD'); await expect(amount).toHaveValue('300,000–500,000');
  await page.reload(); await expect(currency).toHaveValue('USD'); await expect(amount).toHaveValue('300,000–500,000');
  await page.getByRole('button', { name: 'Review answers' }).click();
  await expect(page.getByText('USD 300,000–500,000', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Generate Blueprint', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your solution blueprint.' })).toBeVisible();
  await page.getByRole('button', { name: 'Table view', exact: true }).click();
  const table = page.getByRole('table');
  await expect(table.getByRole('row').filter({ hasText: 'User-stated success criteria' })).toContainText(userTarget);
  await expect(table.getByRole('row').filter({ hasText: '40% reduction' })).toContainText('Needs clarification');
  await expect(table).toContainText('AI recommendation'); await expect(table).toContainText('Not provided');
  await page.reload(); expect(calls).toBe(1);
});

test('legacy budget remains readable and an empty selected currency never supplies a budget', async ({ page }) => {
  const legacy = { ...answers, budget: 'Not sure' }; delete legacy.budgetCurrency;
  await page.addInitScript(({ answers }) => {
    if (!localStorage.getItem('cynbit.discovery.v3')) localStorage.setItem('cynbit.discovery.v3', JSON.stringify({ version: 3, id: crypto.randomUUID(), answers, step: 2, result: null, view: 'questionnaire' }));
  }, { answers: legacy });
  let calls = 0;
  await page.route('**/api/blueprint', async route => {
    calls++; expect(route.request().postDataJSON().answers.budget).toBe('');
    await route.fulfill({ status: 200, json: generatedResult });
  });
  await page.goto('/workspace');
  await expect(page.locator('#field-description')).toHaveCount(0);
  await expect(page.locator('#field-budget')).toHaveValue('');
  await page.getByRole('combobox', { name: 'Budget currency' }).selectOption('AED');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Budget currency' })).toHaveValue('AED');
  await expect(page.locator('#field-budget')).toHaveValue('');
  await page.getByRole('button', { name: 'Review answers' }).click();
  await expect(page.getByText(legacy.description, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Generate Blueprint', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your solution blueprint.' })).toBeVisible();
  expect(calls).toBe(1);
});

test('budget controls retain a usable 40/60 desktop layout and free-text amounts across steps', async ({ page }) => {
  // No generation action or intercepted AI response: this test only edits the existing form.
  await review(page);
  await page.getByRole('button', { name: 'Edit requirements answers' }).click();
  const currency = page.locator('#field-budgetCurrency');
  const amount = page.locator('#field-budget');
  await expect(amount).toHaveAttribute('type', 'text');
  await currency.selectOption('INR');
  const boxes = await page.evaluate(() => {
    const rect = (selector: string) => { const r = document.querySelector(selector)!.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    return { currency: rect('#field-budgetCurrency'), amount: rect('#field-budget') };
  });
  if (page.viewportSize()!.width >= 640) {
    expect(Math.abs(boxes.currency.y - boxes.amount.y)).toBeLessThan(1);
    expect(boxes.currency.width / boxes.amount.width).toBeCloseTo(2 / 3, 1);
    expect(boxes.amount.width).toBeGreaterThan(150);
  } else {
    expect(boxes.amount.y).toBeGreaterThanOrEqual(boxes.currency.y + boxes.currency.height);
    expect(boxes.amount.width).toBeGreaterThan(200);
  }
  for (const value of ['500000', '500000-800000', '5 lakh', '10-15 lakh']) {
    await amount.fill(value);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(amount).toHaveValue(value);
    await expect(currency).toHaveValue('INR');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cynbit.discovery.v3')!).answers.budget)).toBe(`INR ${value}`);
  }
  await page.reload(); await expect(amount).toHaveValue('10-15 lakh');
  await amount.fill('');
  await page.getByRole('button', { name: 'Review answers' }).click();
  await expect(page.getByText('INR 0', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cynbit.discovery.v3')!).answers.budget)).toBe('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
