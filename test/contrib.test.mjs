import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCells, visitOrder, loopDuration, visitPercent, contribSize, renderContrib, PAD, TOP, STEP } from '../src/contrib.mjs';
import { DEFAULT_THEME } from '../src/config.mjs';

const calendar = JSON.parse(readFileSync(new URL('./fixtures/calendar.json', import.meta.url), 'utf8'));
const theme = DEFAULT_THEME;

test('buildCells positions every day by week column and weekday row', () => {
  const cells = buildCells(calendar);
  const days = calendar.weeks.flatMap((w) => w.contributionDays);
  assert.equal(cells.length, days.length);
  // 2025-10-19 is a Sunday: first column, first row.
  assert.deepEqual([cells[0].x, cells[0].y, cells[0].date], [PAD, TOP, '2025-10-19']);
  const wed = cells.find((c) => c.date === '2025-10-22');
  assert.equal(wed.x, PAD);
  assert.equal(wed.y, TOP + 3 * STEP);
});

test('buildCells falls back to the count when the level is unknown', () => {
  const cells = buildCells({ weeks: [{ contributionDays: [
    { date: '2026-01-04', contributionCount: 3, contributionLevel: 'SOMETHING_NEW' },
    { date: '2026-01-05', contributionCount: 0, contributionLevel: 'SOMETHING_NEW' },
  ] }] });
  assert.deepEqual(cells.map((c) => c.lvl), [1, 0]);
});

test('visitOrder returns only active days, oldest first, even if input is shuffled', () => {
  const cells = buildCells(calendar);
  const shuffled = [...cells].reverse();
  const visits = visitOrder(shuffled);
  assert.ok(visits.length > 0);
  assert.ok(visits.every((c) => c.lvl > 0));
  assert.equal(visits.length, cells.filter((c) => c.lvl > 0).length);
  for (let i = 1; i < visits.length; i++) assert.ok(visits[i - 1].date < visits[i].date, `${visits[i - 1].date} < ${visits[i].date}`);
});

test('loopDuration is clamped between 12 and 40 seconds', () => {
  assert.equal(loopDuration(0), 12);
  assert.equal(loopDuration(200), 24);
  assert.equal(loopDuration(10_000), 40);
});

test('visitPercent spreads visits over the first 95% of the loop', () => {
  assert.equal(visitPercent(0, 10), 0);
  assert.equal(visitPercent(5, 10), 47.5);
  assert.ok(visitPercent(9, 10) < 95);
  assert.equal(visitPercent(0, 0), 0); // no division by zero
});

test('contribSize matches a 53-week calendar', () => {
  assert.deepEqual(contribSize(53), { width: 771, height: 152 });
});

test('renderContrib outputs one animation per active day plus the reduced-motion branch', () => {
  const svg = renderContrib({ user: 'octocat', calendar, theme, label: '990 contributions in the last year' });
  const active = visitOrder(buildCells(calendar)).length;
  assert.equal((svg.match(/@keyframes k\d+/g) ?? []).length, active);
  assert.match(svg, /@media \(prefers-color-scheme:dark\)/);
  assert.match(svg, /@media \(prefers-reduced-motion:reduce\)\{\.agent\{display:none\}rect\.v/);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
});

test('renderContrib escapes the label and username', () => {
  const svg = renderContrib({ user: 'a&b', calendar, theme, label: '<script>"x"</script>' });
  assert.ok(!svg.includes('<script>'));
  assert.ok(svg.includes('&lt;script&gt;&quot;x&quot;&lt;/script&gt;'));
  assert.ok(svg.includes('agent@a&amp;b'));
});

test('renderContrib handles an empty calendar', () => {
  const empty = { totalContributions: 0, weeks: [{ contributionDays: [{ date: '2026-01-04', contributionCount: 0, contributionLevel: 'NONE' }] }] };
  const svg = renderContrib({ user: 'x', calendar: empty, theme, label: '0' });
  assert.match(svg, /@keyframes walk\{0%\{transform:translate\(14px,30px\)\}100%/);
});
