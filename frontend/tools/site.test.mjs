import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../libs/site/src/main.ts', import.meta.url));
const initSource = await readFile(new URL('../libs/site/src/theme-init.js', import.meta.url), 'utf8');
const { outputFiles } = await build({
  entryPoints: [source], bundle: true, write: false, format: 'iife',
  loader: { '.css': 'empty' }, logLevel: 'silent',
});

function themeHarness({ cookie = '', preference, hour = 12, cookiesBlocked = false, mediaUnavailable = false, clockUnavailable = false, protocol = 'https:' } = {}) {
  const buttonEvents = {}, windowEvents = {}, writes = [];
  let cookieJar = cookie;
  const control = {
    hidden: true, attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener: (event, listener) => { buttonEvents[event] = listener; },
  };
  const document = {
    documentElement: { dataset: { theme: 'day' } },
    querySelector: selector => selector === '#theme-cycle' ? control : null,
    querySelectorAll: () => [],
    get cookie() {
      if (cookiesBlocked) throw new Error('Cookies blocked');
      return cookieJar;
    },
    set cookie(value) {
      if (cookiesBlocked) throw new Error('Cookies blocked');
      writes.push(value);
      cookieJar = value.split(';')[0];
    },
  };
  const window = {
    location: { protocol },
    matchMedia: query => {
      if (mediaUnavailable && query.includes('color-scheme')) throw new Error('Unavailable');
      return { matches: query === `(prefers-color-scheme: ${preference})` };
    },
    addEventListener: (event, listener) => { windowEvents[event] = listener; },
  };
  class LocalDate extends Date {
    getHours() { if (clockUnavailable) throw new Error('Clock unavailable'); return hour; }
    getUTCHours() { throw new Error('Theme must use the local timezone, not UTC'); }
  }
  const context = vm.createContext({ document, window, Date: LocalDate, console });
  vm.runInContext(initSource, context);
  const initialTheme = document.documentElement.dataset.theme;
  vm.runInContext(outputFiles[0].text, context);
  return { control, document, window, buttonEvents, windowEvents, writes, initialTheme,
    setCookie(value) { cookieJar = value; } };
}

test('theme button cycles Light → R → G → B → Dark, wraps, and writes a preference cookie', () => {
  const harness = themeHarness();
  assert.equal(harness.control.hidden, false);
  assert.match(harness.control.attributes['aria-label'], /Day theme \(1 of 5\). Switch to Evening sunset/);
  for (const [theme, label, position] of [
    ['sunset', 'Evening sunset', 2], ['forest', 'Foggy forest', 3], ['rain', 'Rain', 4], ['night', 'Night', 5], ['day', 'Day', 1],
  ]) {
    harness.buttonEvents.click();
    assert.equal(harness.document.documentElement.dataset.theme, theme);
    assert.equal(harness.document.cookie, `brand-theme=${theme}`);
    assert.ok(harness.control.attributes['aria-label'].includes(`${label} theme (${position} of 5)`));
    assert.equal(harness.control.attributes.title, harness.control.attributes['aria-label']);
  }
  assert.equal(harness.writes.at(-1), 'brand-theme=day; Path=/; Max-Age=31536000; SameSite=Lax; Secure');
});

test('a valid cookie overrides dark preference and local time before the main script runs', () => {
  for (const theme of ['day', 'sunset', 'forest', 'rain', 'night']) {
    const harness = themeHarness({ cookie: `unrelated=1; brand-theme=${theme}`, preference: 'dark', hour: 23 });
    assert.equal(harness.initialTheme, theme);
    assert.equal(harness.document.documentElement.dataset.theme, theme);
    assert.deepEqual(harness.writes, [], 'Reading a preference must not write a new cookie');
  }
});

test('explicit dark wins over the clock, but reported light falls through to the clock', () => {
  assert.equal(themeHarness({ preference: 'dark', hour: 12 }).initialTheme, 'night');
  assert.equal(themeHarness({ preference: 'light', hour: 23 }).initialTheme, 'night');
  assert.equal(themeHarness({ preference: 'light', hour: 12 }).initialTheme, 'day');
});

test('local clock chooses Day from 07:00 to 19:00 and Night otherwise', () => {
  for (const [hour, theme] of [[0, 'night'], [6, 'night'], [7, 'day'], [12, 'day'], [18, 'day'], [19, 'night'], [23, 'night']]) {
    const harness = themeHarness({ hour });
    assert.equal(harness.initialTheme, theme, `At local hour ${hour}`);
    assert.deepEqual(harness.writes, [], 'Automatic defaults must not become explicit preferences');
  }
  assert.equal(themeHarness({ mediaUnavailable: true, hour: 22 }).initialTheme, 'night');
});

test('invalid cookies fall through; missing or invalid clocks ultimately default to Day', () => {
  for (const cookie of ['brand-theme=invalid', 'brand-theme=%broken', 'brand-theme=', 'not-brand-theme=rain']) {
    assert.equal(themeHarness({ cookie, preference: 'dark', hour: 12 }).initialTheme, 'night');
  }
  for (const hour of [NaN, -1, 24]) {
    assert.equal(themeHarness({ hour }).initialTheme, 'day');
  }
  assert.equal(themeHarness({ mediaUnavailable: true, clockUnavailable: true }).initialTheme, 'day');
});

test('picker works with blocked cookies, and returning to a tab reads its shared cookie', () => {
  const blocked = themeHarness({ cookiesBlocked: true });
  assert.doesNotThrow(() => blocked.buttonEvents.click());
  assert.equal(blocked.document.documentElement.dataset.theme, 'sunset');
  const harness = themeHarness();
  harness.setCookie('brand-theme=rain');
  harness.windowEvents.focus();
  assert.equal(harness.document.documentElement.dataset.theme, 'rain');
  assert.match(harness.control.attributes['aria-label'], /Rain theme \(4 of 5\). Switch to Night/);
  harness.buttonEvents.click();
  assert.equal(harness.document.documentElement.dataset.theme, 'night');
});

test('localhost HTTP previews save a cookie without the HTTPS-only flag', () => {
  const harness = themeHarness({ protocol: 'http:' });
  harness.buttonEvents.click();
  assert.equal(harness.writes[0], 'brand-theme=sunset; Path=/; Max-Age=31536000; SameSite=Lax');
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

test('all five palettes meet text, icon, and focus contrast', async () => {
  const css = await readFile(new URL('../libs/site/src/site.css', import.meta.url), 'utf8');
  for (const theme of ['day', 'sunset', 'forest', 'rain', 'night']) {
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
