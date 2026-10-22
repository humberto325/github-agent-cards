import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateConfig, resolveLanguages, ConfigError, DEFAULT_THEME } from '../src/config.mjs';
import { renderAll } from '../src/render.mjs';
import { esc } from '../src/xml.mjs';

const card = (title = 'Title') => ({ title, lines: ['line one', 'line two'] });
const errorsOf = (raw) => {
  try {
    validateConfig(raw);
  } catch (err) {
    assert.ok(err instanceof ConfigError);
    return err.errors;
  }
  assert.fail('expected a ConfigError');
};

test('esc escapes XML special characters and strips illegal control characters', () => {
  assert.equal(esc(`<a href="x">Tom & Jerry's</a>`), '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;');
  assert.equal(esc('ok\u0000\u0007done'), 'okdone');
  assert.equal(esc(42), '42');
});

test('an empty config is valid: defaults applied, no panel cards', () => {
  const { config, warnings } = validateConfig({});
  assert.deepEqual(config.cards, []);
  assert.deepEqual(config.theme, DEFAULT_THEME);
  assert.deepEqual(warnings, []);
});

test('the example config is valid without warnings', () => {
  const raw = JSON.parse(readFileSync(new URL('../examples/agent-cards.config.json', import.meta.url), 'utf8'));
  const { warnings } = validateConfig(raw);
  assert.deepEqual(warnings, []);
});

test('rejects wrong types with a path to the problem', () => {
  const errors = errorsOf({ command: 3, cards: 'nope', footer: [{ label: 'x' }], subtitle: '' });
  assert.deepEqual(errors, [
    'command must be a non-empty string',
    'subtitle must be a non-empty string',
    'cards must be an array',
    'footer[0].value must be a non-empty string',
  ]);
});

test('rejects fewer than 2 or more than 6 cards', () => {
  assert.deepEqual(errorsOf({ cards: [card()] }), ['cards must have between 2 and 6 items (got 1)']);
  assert.deepEqual(errorsOf({ cards: Array.from({ length: 7 }, () => card()) }), ['cards must have between 2 and 6 items (got 7)']);
});

test('rejects malformed cards and unknown keys', () => {
  const errors = errorsOf({ colour: 'red', cards: [{ title: '', lines: ['a', 'b', 'c'] }, { title: 'ok', lines: [1], extra: true }] });
  assert.deepEqual(errors, [
    '"colour" is not a known config key',
    'cards[0].title must be a non-empty string',
    'cards[0].lines must be an array of 1 or 2 strings',
    'cards[1].extra is not a known card key',
    'cards[1].lines must be an array of 1 or 2 strings',
  ]);
});

test('rejects invalid theme colors (they are injected into CSS)', () => {
  const errors = errorsOf({ theme: { light: { accent: 'red;}' }, dark: { levels: ['#000'] }, sepia: {} } });
  assert.deepEqual(errors, [
    'theme.light.accent must be a hex color like "#0e7490"',
    'theme.dark.levels must be an array of 5 hex colors (no contributions first, most contributions last)',
    'theme.sepia is not supported (use "light" or "dark")',
  ]);
});

test('rejects bad language codes and non-localizable keys', () => {
  const errors = errorsOf({ languages: { '../x': {}, es: { theme: {} }, fr: { cards: [card()] } } });
  assert.deepEqual(errors, [
    'languages.../x: "../x" is not a valid language code (e.g. "es", "pt-BR")',
    'languages.es.theme cannot be localized (allowed: command, subtitle, contributions, cards, footer)',
    'languages.fr.cards must have between 2 and 6 items (got 1)',
  ]);
});

test('warns (but does not fail) when text would overflow the card', () => {
  const long = 'x'.repeat(60);
  const { warnings } = validateConfig({ cards: [{ title: long, lines: [long, 'short'] }, card()] });
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /^cards\[0\]\.title is ~\d+px wide and may overflow the card/);
  assert.match(warnings[1], /^cards\[0\]\.lines\[0\] .* about 45 characters/);
});

test('resolveLanguages: default keeps plain names, overrides get a suffix and inherit the rest', () => {
  const { config } = validateConfig({ cards: [card('A'), card('B')], footer: [{ value: '1' }], languages: { es: { cards: [card('Uno'), card('Dos')] } } });
  const variants = resolveLanguages(config);
  assert.deepEqual(variants.map((v) => v.suffix), ['', '.es']);
  assert.equal(variants[1].content.cards[0].title, 'Uno');
  assert.deepEqual(variants[1].content.footer, [{ value: '1' }]);
  assert.deepEqual(variants[1].content.theme, variants[0].content.theme);
});

test('renderAll: contribution card only without config, localized copies with languages', () => {
  const calendar = JSON.parse(readFileSync(new URL('./fixtures/calendar.json', import.meta.url), 'utf8'));
  const bare = renderAll({ user: 'octocat', calendar, config: validateConfig({}).config });
  assert.deepEqual(bare.map((f) => f.file), ['agent-contrib.svg']);
  assert.ok(bare[0].svg.includes(`${calendar.totalContributions} contributions in the last year`));

  const { config } = validateConfig({ cards: [card(), card()], languages: { es: { contributions: '{count} contribuciones' } } });
  const files = renderAll({ user: 'octocat', calendar, config });
  assert.deepEqual(files.map((f) => f.file), ['agent-contrib.svg', 'agent-panel.svg', 'agent-contrib.es.svg', 'agent-panel.es.svg']);
  assert.ok(files[2].svg.includes(`${calendar.totalContributions} contribuciones`));
});
