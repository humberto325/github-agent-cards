import { test } from 'node:test';
import assert from 'node:assert/strict';
import { panelLayout, renderPanel, cardTextRoom } from '../src/panel.mjs';
import { validateConfig, resolveLanguages } from '../src/config.mjs';

const cards = (n) => Array.from({ length: n }, (_, i) => ({ title: `System ${i + 1}`, lines: ['first line', 'second line'] }));
const contentFor = (raw) => resolveLanguages(validateConfig(raw).config)[0].content;

test('panelLayout places cards in a 2-column grid', () => {
  const l = panelLayout(4, 771);
  assert.equal(l.cw, 363.5);
  assert.equal(l.rows, 2);
  assert.equal(l.height, 294); // same height as the original 4-card panel
  assert.deepEqual(l.positions, [
    { x: 16, y: 58 }, { x: 391.5, y: 58 },
    { x: 16, y: 154 }, { x: 391.5, y: 154 },
  ]);
});

test('panelLayout grows by one row per two cards and leaves an odd card in the left column', () => {
  assert.equal(panelLayout(2, 771).height, 198);
  const three = panelLayout(3, 771);
  assert.equal(three.rows, 2);
  assert.deepEqual(three.positions[2], { x: 16, y: 154 });
  assert.equal(panelLayout(6, 771).height, 390);
});

test('cardTextRoom leaves space for the status dot next to the title', () => {
  const room = cardTextRoom(771);
  assert.ok(room.title < room.line);
  assert.equal(room.line, 337.5);
});

test('renderPanel renders every card, fills {count} and keeps the animation contract', () => {
  const svg = renderPanel({ user: 'octocat', width: 771, content: contentFor({ cards: cards(5) }) });
  assert.equal((svg.match(/<g class="tile"/g) ?? []).length, 5);
  assert.ok(svg.includes('5 systems running right now'));
  assert.match(svg, /\.tile,\.edge,\.cover\{animation-fill-mode:backwards\}/);
  assert.match(svg, /@media \(prefers-reduced-motion:reduce\)/);
  assert.ok(!svg.includes('clip-path'), 'typing uses cover rects, not clip-path');
  assert.equal((svg.match(/class="cover cvp"/g) ?? []).length, 10);
});

test('renderPanel uses theme colors and escapes user text', () => {
  const content = contentFor({
    theme: { light: { accent: '#112233' }, dark: { accent: '#abcdef' } },
    command: 'run <all> & "more"',
    cards: [{ title: 'A & B', lines: ['<b>bold</b>'] }, { title: 'C', lines: ['x', 'y'] }],
    footer: [{ value: '1<2', label: 'a"b' }],
  });
  const svg = renderPanel({ user: 'octocat', width: 771, content });
  assert.ok(svg.includes('.a{fill:#112233}'));
  assert.ok(svg.includes('stop-color="#abcdef"'));
  assert.ok(svg.includes('run &lt;all&gt; &amp; &quot;more&quot;'));
  assert.ok(svg.includes('A &amp; B'));
  assert.ok(svg.includes('&lt;b&gt;bold&lt;/b&gt;'));
  assert.ok(svg.includes('1&lt;2'));
  assert.ok(!svg.includes('<b>'));
  // A one-line card gets exactly one typing cover.
  assert.equal((svg.match(/class="cover cvp"/g) ?? []).length, 3);
});

test('renderPanel omits the footer text when the footer is empty', () => {
  const svg = renderPanel({ user: 'octocat', width: 771, content: contentFor({ cards: cards(2) }) });
  assert.ok(!svg.includes('   ·   '));
  assert.ok(svg.includes('class="packet"'));
});
