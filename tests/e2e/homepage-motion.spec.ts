import { test, expect, type Page, type Locator } from "@playwright/test";

test('homepage motion advances with visible asymmetric rings, ambient glow and floating preview', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const ring = page.locator('.orbit-one');
  const marker = await ring.evaluate(el => ({ dot: getComputedStyle(el, '::before').backgroundColor, arc: getComputedStyle(el, '::after').borderTopColor, content: getComputedStyle(el, '::before').content }));
  expect(marker.content).toBe('""');
  expect(marker.dot).not.toBe('rgba(0, 0, 0, 0)'); expect(marker.arc).not.toBe('rgba(0, 0, 0, 0)');
  const ringStart = await ring.evaluate(el => getComputedStyle(el).transform);
  await expect.poll(() => ring.evaluate(el => getComputedStyle(el).transform)).not.toBe(ringStart);
  const particle = page.locator('.particle-one');
  const particleStart = await particle.evaluate(el => getComputedStyle(el).transform);
  await expect.poll(() => particle.evaluate(el => getComputedStyle(el).transform)).not.toBe(particleStart);
  await page.locator('.architecture-scene').scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath('hero.png'), fullPage: false });
  const preview = page.locator('.preview-scene');
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toContainText('We want to make customer support faster, without losing the human touch.');
  await expect(preview.locator('.preview-example-row')).toHaveCount(3);
  const ambient = preview.locator('.architecture-ambient');
  const glowStart = await ambient.evaluate(el => getComputedStyle(el).transform);
  await expect.poll(() => ambient.evaluate(el => getComputedStyle(el).transform)).not.toBe(glowStart);
  const card = preview.locator('.preview-card');
  const floatStart = await card.evaluate(el => getComputedStyle(el).transform);
  await expect.poll(() => card.evaluate(el => getComputedStyle(el).transform)).not.toBe(floatStart);
  await expect(preview.locator('.preview-decor')).toHaveAttribute('aria-hidden', 'true');
  expect(await preview.locator('.preview-row-highlight').evaluateAll(elements => elements.every(el => getComputedStyle(el).animationName === 'preview-highlight' && getComputedStyle(el).pointerEvents === 'none'))).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: test.info().outputPath('preview.png'), fullPage: false });
  await page.getByRole('link', { name: 'Start guided discovery' }).click();
  await expect(page).toHaveURL(/\/workspace$/);
});

test('homepage CTA spotlight follows mouse, fades on leave, and remains clickable on desktop and touch', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const card = page.locator('.cta-spotlight-card');
  const overlay = card.locator('.cta-spotlight');
  await card.scrollIntoViewIfNeeded();
  await expect(overlay).toHaveAttribute('aria-hidden', 'true');
  expect(await overlay.evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  if (isMobile) {
    expect(await overlay.evaluate(el => getComputedStyle(el).opacity)).toBe('0.5');
    expect(await card.evaluate(el => el.style.getPropertyValue('--mouse-x'))).toBe('');
  } else {
    // Hover waits for the existing reveal transform to settle before sampling coordinates.
    await expect.poll(() => card.evaluate(el => el.getBoundingClientRect().top >= 0)).toBeTruthy();
    const bounds = (await card.boundingBox())!;
    await card.hover({ position: { x: bounds.width * 0.2, y: bounds.height * 0.3 } });
    await expect(card).toHaveAttribute('data-spotlight-active', 'true');
    expect(await card.evaluate(el => parseFloat(el.style.getPropertyValue('--mouse-x')))).toBeCloseTo(20, 0);
    expect(await card.evaluate(el => parseFloat(el.style.getPropertyValue('--mouse-y')))).toBeCloseTo(30, 0);
    await expect.poll(() => overlay.evaluate(el => Number(getComputedStyle(el).opacity))).toBe(1);
    await card.hover({ position: { x: bounds.width * 0.8, y: bounds.height * 0.7 } });
    expect(await card.evaluate(el => parseFloat(el.style.getPropertyValue('--mouse-x')))).toBeCloseTo(80, 0);
    await page.mouse.move(0, 0);
    await expect(card).toHaveAttribute('data-spotlight-active', 'false');
    await expect.poll(() => overlay.evaluate(el => Number(getComputedStyle(el).opacity))).toBe(0);
  }
  await page.screenshot({ path: test.info().outputPath('cta.png'), fullPage: false });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await card.getByRole('link', { name: 'Start AI Discovery' }).click();
  await expect(page).toHaveURL(/\/workspace$/);
});

test('homepage reduced motion stops continuous effects and disables cursor following', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const decorations = page.locator('.architecture-decor > *, .preview-decor .architecture-ambient, .preview-card, .preview-row-highlight');
  expect(await decorations.evaluateAll(elements => elements.every(el => getComputedStyle(el).animationName === 'none'))).toBeTruthy();
  const card = page.locator('.cta-spotlight-card');
  await card.scrollIntoViewIfNeeded();
  await card.dispatchEvent('pointermove', { pointerType: 'mouse', clientX: 180, clientY: 200 });
  expect(await card.evaluate(el => el.style.getPropertyValue('--mouse-x'))).toBe('');
  expect(await card.evaluate(el => el.dataset.spotlightActive)).toBeUndefined();
  expect(await card.locator('.cta-spotlight').evaluate(el => getComputedStyle(el).opacity)).toBe('0.35');
  await card.getByRole('link', { name: 'Start AI Discovery' }).click();
  await expect(page).toHaveURL(/\/workspace$/);
});

test('homepage closer-look navigation works repeatedly from the absolute bottom with sticky offset', async ({ page, isMobile }) => {
  await page.goto('/');
  await expect(page.locator('[id="preview"]')).toHaveCount(1);
  for (const motion of ['no-preference', 'reduce'] as const) {
    await page.emulateMedia({ reducedMotion: motion });
    for (let repeat = 0; repeat < 2; repeat++) {
      if (isMobile) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await expect.poll(() => page.evaluate(() => Math.abs(scrollY + innerHeight - document.documentElement.scrollHeight))).toBeLessThan(2);
      const nav = page.getByRole('navigation', { name: isMobile ? 'Mobile navigation' : 'Main navigation', exact: true });
      await nav.getByRole('link', { name: 'A closer look', exact: true }).click();
      await expect.poll(() => page.locator('#preview').evaluate(el => Math.abs(el.getBoundingClientRect().top - parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)))).toBeLessThan(3);
      const bounds = await page.evaluate(() => ({ sectionTop: document.getElementById('preview')!.getBoundingClientRect().top, navBottom: document.querySelector('header')!.getBoundingClientRect().bottom }));
      expect(bounds.sectionTop).toBeGreaterThanOrEqual(bounds.navBottom);
      await expect(page).toHaveURL(/#preview$/);
    }
  }
});

test('homepage process steps respond as a whole without implying clickability or moving on touch', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const steps = page.locator('#process .process-step');
  await expect(steps).toHaveCount(3);
  for (const step of await steps.all()) {
    await step.scrollIntoViewIfNeeded();
    const number = step.locator('.process-step-number');
    const originalBackground = await number.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(await step.evaluate(el => getComputedStyle(el).cursor)).toBe('default');
    if (isMobile) {
      await step.tap();
      expect(await step.evaluate(el => getComputedStyle(el).transform)).toBe('none');
      expect(await number.evaluate(el => getComputedStyle(el).transform)).toBe('none');
    } else {
      await step.locator('p').hover();
      await expect.poll(() => step.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42)).toBeCloseTo(-4, 1);
      await expect.poll(() => number.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m11)).toBeCloseTo(1.06, 2);
      await expect.poll(() => step.evaluate(el => getComputedStyle(el, '::before').opacity)).toBe('1');
      expect(await number.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(originalBackground);
      await page.mouse.move(0, 0);
      await expect.poll(() => step.evaluate(el => getComputedStyle(el, '::before').opacity)).toBe('0');
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const step of await steps.all()) {
    if (!isMobile) await step.hover();
    expect(await step.evaluate(el => getComputedStyle(el).transform)).toBe('none');
    expect(await step.locator('.process-step-number').evaluate(el => getComputedStyle(el).transform)).toBe('none');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('homepage preview retains readable content with a decorative extended glow and teal shadow', async ({ page }) => {
  await page.goto('/');
  const scene = page.locator('.preview-scene');
  await scene.scrollIntoViewIfNeeded();
  const card = scene.locator('.preview-card');
  await expect(card).toContainText('Discovery workspace');
  await expect(card).toContainText('Suggested replies for agents to review');
  await expect(card.locator('.preview-example-row')).toHaveCount(3);
  const depth = await scene.evaluate(el => {
    const card = el.querySelector('.preview-card')!;
    const decor = el.querySelector('.preview-decor')!;
    return { cardWidth: card.clientWidth, sceneWidth: el.clientWidth, decorWidth: decor.getBoundingClientRect().width, background: getComputedStyle(card).backgroundColor, cardLayer: getComputedStyle(card).zIndex, decorLayer: getComputedStyle(decor).zIndex, shadow: getComputedStyle(card).boxShadow, events: getComputedStyle(decor).pointerEvents };
  });
  expect(depth.decorWidth).toBeGreaterThan(depth.cardWidth);
  expect(Math.abs(depth.cardWidth - depth.sceneWidth)).toBeLessThanOrEqual(2);
  expect(depth.shadow).toContain('33, 102, 92'); expect(depth.shadow).toContain('28px 64px');
  expect(depth.background).toBe('rgb(255, 255, 255)');
  expect(Number(depth.decorLayer)).toBeLessThan(Number(depth.cardLayer));
  expect(depth.events).toBe('none');
  await expect(scene.locator('.preview-decor')).toHaveAttribute('aria-hidden', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: test.info().outputPath('preview-depth.png'), fullPage: false });
});

for (const motion of ['no-preference', 'reduce'] as const) {
  test(`homepage section navigation is bidirectional and repeatable (${motion})`, async ({ page, isMobile }) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ reducedMotion: motion });
    await page.goto('/');
    const sections = { capabilities: 'Capabilities', process: 'How it works', preview: 'A closer look' };
    for (const id of Object.keys(sections)) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
    async function navigate(id: keyof typeof sections) {
      if (isMobile) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
      const nav = page.getByRole('navigation', { name: isMobile ? 'Mobile navigation' : 'Main navigation', exact: true });
      await nav.getByRole('link', { name: sections[id], exact: true }).click();
      await expect.poll(() => page.evaluate(id => {
        const section = document.getElementById(id)!.getBoundingClientRect();
        const header = document.querySelector('header')!.getBoundingClientRect();
        const offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
        return Math.abs(section.top - offset) < 3 && section.top >= header.bottom && section.top < innerHeight && section.bottom > header.bottom;
      }, id), { message: `${sections[id]} must actually appear beneath the sticky navbar` }).toBeTruthy();
    }
    const sequences = [
      ['capabilities', 'preview', 'capabilities'],
      ['process', 'preview', 'process'],
      ['preview', 'capabilities', 'process'],
      ['capabilities', 'process', 'preview'],
    ] as const;
    for (const sequence of sequences) for (const id of sequence) await navigate(id);
    for (const id of ['capabilities', 'process', 'preview'] as const) {
      await navigate(id); await navigate(id);
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await expect.poll(() => page.evaluate(() => Math.abs(scrollY + innerHeight - document.documentElement.scrollHeight))).toBeLessThan(2);
      await navigate(id);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });
}

// Sample rendered screenshot pixels rather than treating CSS variables as proof of visibility.
async function spotlightPixels(page: Page, card: Locator) {
  const screenshot = await card.screenshot();
  return page.evaluate(async png => {
    const bytes = Uint8Array.from(atob(png), char => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    // Blank areas above the heading, well away from text and rounded corners.
    const pixel = (x: number) => [...context.getImageData(Math.round(bitmap.width * x), 80, 1, 1).data].slice(0, 3);
    const pixels = { left: pixel(0.15), right: pixel(0.85) };
    bitmap.close();
    return pixels;
  }, screenshot.toString("base64"));
}

test('CTA spotlight paints above its background and follows the cursor through Light Dark Light switches', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const card = page.locator('.cta-spotlight-card');
  const overlay = card.locator('.cta-spotlight');
  for (const [index, theme] of ['light', 'dark', 'light'].entries()) {
    if (index > 0) {
      await page.getByRole('button', { name: `Switch to ${theme} theme` }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      // Theme interpolation must never slow the independent cursor interpolation.
      const timings = await card.evaluate(el => {
        const css = getComputedStyle(el);
        return Object.fromEntries(css.transitionProperty.split(',').map((property, i) => [property.trim(), parseFloat(css.transitionDuration.split(',')[i])]));
      });
      expect(timings['--mouse-x']).toBe(0.16);
      expect(timings['--mouse-y']).toBe(0.16);
      expect(timings['--cta-start']).toBe(0.42);
    }
    const expectedGradient = theme === 'dark'
      ? 'linear-gradient(125deg, rgb(23, 46, 50), rgb(28, 65, 64) 52%, rgb(21, 48, 54))'
      : 'linear-gradient(125deg, rgb(33, 102, 92), rgb(33, 102, 92) 52%, rgb(33, 102, 92))';
    await expect(card).toHaveCSS('background-image', expectedGradient);
    await card.scrollIntoViewIfNeeded();
    await expect(overlay).toHaveCSS('pointer-events', 'none');
    await expect(overlay).toHaveCSS('z-index', '0');
    expect(await card.locator(':scope > .relative').evaluate(el => Number(getComputedStyle(el).zIndex))).toBeGreaterThan(0);
    if (isMobile) {
      await expect(overlay).toHaveCSS('opacity', '0.5');
      expect(await card.evaluate(el => el.style.getPropertyValue('--mouse-x'))).toBe('');
    } else {
      await page.mouse.move(0, 0);
      await expect(overlay).toHaveCSS('opacity', '0');
      const baseline = await spotlightPixels(page, card);
      const bounds = (await card.boundingBox())!;
      await page.mouse.move(bounds.x + bounds.width * 0.15, bounds.y + 80);
      await expect(overlay).toHaveCSS('opacity', '1');
      await expect.poll(() => overlay.evaluate(el => parseFloat(getComputedStyle(el).getPropertyValue('--mouse-x')))).toBeCloseTo(15, 0);
      const left = await spotlightPixels(page, card);
      await page.mouse.move(bounds.x + bounds.width * 0.85, bounds.y + 80, { steps: 8 });
      await expect.poll(() => overlay.evaluate(el => parseFloat(getComputedStyle(el).getPropertyValue('--mouse-x')))).toBeCloseTo(85, 0);
      const right = await spotlightPixels(page, card);
      const brightness = (pixel: number[]) => pixel.reduce((sum, value) => sum + value, 0);
      // Pixels near the pointer brighten over the actual background, then dim as it moves away.
      expect(brightness(left.left) - brightness(baseline.left)).toBeGreaterThan(25);
      expect(brightness(right.right) - brightness(baseline.right)).toBeGreaterThan(25);
      expect(brightness(left.left) - brightness(right.left)).toBeGreaterThan(25);
      expect(brightness(right.right) - brightness(left.right)).toBeGreaterThan(25);
      await page.mouse.move(0, 0);
      await expect(overlay).toHaveCSS('opacity', '0');
      const faded = await spotlightPixels(page, card);
      expect(faded).toEqual(baseline);
    }
    await card.screenshot({ path: test.info().outputPath(`cta-${index}-${theme}.png`) });
    // Exercise the real link in each theme, then return without resetting the preference.
    await card.getByRole('link', { name: 'Start AI Discovery' }).click();
    await expect(page).toHaveURL(/\/workspace$/);
    await expect(page.getByRole('button', { name: 'Switch to ' + (theme === 'light' ? 'dark' : 'light') + ' theme' })).toBeVisible();
    if (index < 2) {
      await page.getByRole('link', { name: 'Back to home' }).click();
      await expect(page).toHaveURL('/');
    }
  }
});
