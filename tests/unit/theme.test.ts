import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTheme, themeInitScript, THEME_KEY } from "../../src/lib/theme/preference";

test('theme preferences default to light and accept only an explicit dark preference', () => {
  for (const value of [null, '', 'light', 'system', 'invalid']) assert.equal(normalizeTheme(value), 'light');
  assert.equal(normalizeTheme('dark'), 'dark');
});

test('pre-paint theme initialization restores preference and handles unavailable storage', () => {
  for (const stored of ['light', 'dark', 'invalid']) {
    const document = { documentElement: { dataset: {} as Record<string, string> } };
    new Function('document', 'localStorage', themeInitScript)(document, { getItem: (key: string) => { assert.equal(key, THEME_KEY); return stored; } });
    assert.equal(document.documentElement.dataset.theme, normalizeTheme(stored));
  }
  const document = { documentElement: { dataset: {} as Record<string, string> } };
  new Function('document', 'localStorage', themeInitScript)(document, { getItem: () => { throw new Error('Blocked storage'); } });
  assert.equal(document.documentElement.dataset.theme, 'light');
});
