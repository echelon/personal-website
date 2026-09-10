import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../libs/site/src/main.ts', import.meta.url));
const { outputFiles } = await build({
  entryPoints: [source], bundle: true, write: false, format: 'iife',
  loader: { '.css': 'empty' }, logLevel: 'silent',
});

function themeHarness(storageThrows = false) {
  const buttonEvents = {}, windowEvents = {}, saved = {};
  const control = {
    hidden: true, attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener: (event, listener) => { buttonEvents[event] = listener; },
  };
  const document = {
    documentElement: { dataset: { theme: 'forest' } },
    querySelector: selector => selector === '#theme-cycle' ? control : null,
    querySelectorAll: () => [],
  };
  const window = {
    matchMedia: () => ({ matches: false }),
    addEventListener: (event, listener) => { windowEvents[event] = listener; },
  };
  const localStorage = { setItem: (key, value) => {
    if (storageThrows) throw new Error('Storage blocked');
    saved[key] = value;
  } };
  vm.runInNewContext(outputFiles[0].text, { document, window, localStorage, console });
  return { control, document, buttonEvents, windowEvents, saved };
}

test('theme button cycles all four states, wraps, and persists each choice', () => {
  const harness = themeHarness();
  assert.equal(harness.control.hidden, false);
  assert.match(harness.control.attributes['aria-label'], /Foggy forest theme \(3 of 4\). Switch to Evening sunset/);
  for (const [theme, label, position] of [
    ['sunset', 'Evening sunset', 4], ['day', 'Day', 1], ['night', 'Night', 2], ['forest', 'Foggy forest', 3],
  ]) {
    harness.buttonEvents.click();
    assert.equal(harness.document.documentElement.dataset.theme, theme);
    assert.equal(harness.saved['brand-theme'], theme);
    assert.ok(harness.control.attributes['aria-label'].includes(`${label} theme (${position} of 4)`));
    assert.equal(harness.control.attributes.title, harness.control.attributes['aria-label']);
  }
});

test('theme works when storage is unavailable, and cross-tab changes are validated', () => {
  const harness = themeHarness(true);
  assert.doesNotThrow(() => harness.buttonEvents.click());
  assert.equal(harness.document.documentElement.dataset.theme, 'sunset');
  harness.windowEvents.storage({ key: 'brand-theme', newValue: 'day' });
  assert.match(harness.control.attributes['aria-label'], /Day theme \(1 of 4\)/);
  harness.windowEvents.storage({ key: 'brand-theme', newValue: 'invalid' });
  assert.equal(harness.document.documentElement.dataset.theme, 'day');
  harness.buttonEvents.click();
  assert.equal(harness.document.documentElement.dataset.theme, 'night');
});

function luminance(hex) {
  const components = hex.match(/[a-f\d]{2}/gi).map(v => parseInt(v, 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return components[0] * .2126 + components[1] * .7152 + components[2] * .0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}

test('all four palettes meet text and focus contrast on both backgrounds', async () => {
  const css = await readFile(new URL('../libs/site/src/site.css', import.meta.url), 'utf8');
  for (const theme of ['day', 'night', 'forest', 'sunset']) {
    const body = css.match(new RegExp(`\\[data-theme="${theme}"\\] \\{([^}]+)\\}`))[1];
    const colors = Object.fromEntries([...body.matchAll(/--([a-z-]+):\s*(#[a-f\d]{6})/gi)].map(m => [m[1], m[2]]));
    for (const foreground of ['ink', 'muted', 'accent']) {
      for (const background of ['paper', 'surface']) {
        const ratio = contrast(colors[foreground], colors[background]);
        assert.ok(ratio >= 4.5, `${theme} ${foreground}/${background}: ${ratio.toFixed(2)} must be ≥ 4.5`);
      }
    }
    assert.ok(contrast(colors.focus, colors.paper) >= 3, `${theme} focus contrast`);
    for (const background of ['paper', 'surface', 'selection']) {
      assert.ok(contrast(colors['theme-icon'], colors[background]) >= 3, `${theme} icon contrast on ${background}`);
    }
  }
});
