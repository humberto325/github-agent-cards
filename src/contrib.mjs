// Contribution agent card: a small robot walks the contribution calendar in
// chronological order and "processes" each active day, lighting it up.
import { esc } from './xml.mjs';

export const LEVELS = ['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'];
export const CELL = 11;
export const GAP = 3;
export const STEP = CELL + GAP;
export const PAD = 16;
export const TOP = 44;

/** Card size for a calendar with `weekCount` weeks. */
export function contribSize(weekCount) {
  return { width: PAD * 2 + weekCount * STEP - GAP, height: TOP + 7 * STEP + 10 };
}

/** Maps the GraphQL calendar to positioned cells ({ x, y, lvl, date }). */
export function buildCells(calendar) {
  const cells = [];
  calendar.weeks.forEach((week, col) => {
    for (const day of week.contributionDays) {
      const row = new Date(`${day.date}T00:00:00Z`).getUTCDay();
      let lvl = LEVELS.indexOf(day.contributionLevel);
      if (lvl < 0) lvl = day.contributionCount > 0 ? 1 : 0; // unknown level: fall back to the count
      cells.push({ x: PAD + col * STEP, y: TOP + row * STEP, lvl, date: day.date });
    }
  });
  return cells;
}

/** Active days in the order the agent visits them: oldest first. */
export function visitOrder(cells) {
  return cells.filter((c) => c.lvl > 0).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Loop length in seconds: ~0.12s per active day, clamped to 12–40s. */
export function loopDuration(visitCount) {
  return Math.min(Math.max(visitCount * 0.12, 12), 40);
}

/** Keyframe percentage at which visit `i` of `n` happens. The last 5% resets the board. */
export function visitPercent(i, n) {
  return (i / Math.max(n, 1)) * 95;
}

const palette = (levels) => levels.map((c, i) => `.l${i}{fill:${c}}`).join('');

/**
 * Renders the contribution card.
 * @param {{ user: string, calendar: object, theme: object, label: string }} opts
 *   `label` is the already-formatted "N contributions in the last year" text.
 */
export function renderContrib({ user, calendar, theme, label }) {
  const { width, height } = contribSize(calendar.weeks.length);
  const cells = buildCells(calendar);
  const visits = visitOrder(cells);
  const n = visits.length;
  const dur = loopDuration(n).toFixed(1);
  const pct = (i) => visitPercent(i, n).toFixed(2);
  const index = new Map(visits.map((c, i) => [c, i]));
  const glow = theme.dark.accent;

  let css = '';
  let rects = '';
  for (const c of cells) {
    const i = index.get(c);
    const attrs = `x="${c.x}" y="${c.y}" width="${CELL}" height="${CELL}" rx="2"`;
    if (i === undefined) {
      rects += `<rect class="l${c.lvl}" ${attrs}/>`;
      continue;
    }
    // step-end: the cell stays dim until the agent reaches it, then stays lit until the reset.
    css += `@keyframes k${i}{0%{fill-opacity:.12}${pct(i)}%{fill-opacity:1}95%{fill-opacity:1}100%{fill-opacity:.12}}`;
    css += `.v${i}{animation:k${i} ${dur}s step-end infinite}`;
    rects += `<rect class="l${c.lvl} v v${i}" ${attrs}/>`;
  }

  // The agent sits on top of the cell it is processing.
  const at = (c) => `transform:translate(${c.x - 2}px,${c.y - 14}px)`;
  const start = visits[0] ?? { x: PAD, y: TOP };
  css += `@keyframes walk{0%{${at(start)}}${visits.map((c, i) => `${pct(i)}%{${at(c)}}`).join('')}100%{${at(start)}}}`;

  const who = esc(user);
  const text = esc(label);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${who}: ${text}">
<title>${who}: ${text}</title>
<style>
text{font:600 12px 'JetBrains Mono',ui-monospace,Consolas,monospace}
.bg{fill:#ffffff}.t{fill:#24292f}.a{fill:${theme.light.accent}}.dim{fill:#57606a}
${palette(theme.light.levels)}
.agent{animation:walk ${dur}s linear infinite}
.eye{fill:${glow};animation:blink 1.6s steps(1) infinite}
.led{fill:${glow};animation:blink .8s steps(1) infinite}
@keyframes blink{0%{opacity:1}50%{opacity:.25}}
${css}
@media (prefers-color-scheme:dark){.bg{fill:#0d1117}.t{fill:#e6edf3}.a{fill:${theme.dark.accent}}.dim{fill:#8b98a6}${palette(theme.dark.levels)}}
@media (prefers-reduced-motion:reduce){.agent{display:none}rect.v,.eye,.led{animation:none}}
</style>
<rect class="bg" width="100%" height="100%" rx="6"/>
<text x="${PAD}" y="22"><tspan class="a">agent@${who}</tspan><tspan class="dim"> ~ $ </tspan><tspan class="t">process --contributions</tspan><tspan class="dim">  · ${text}</tspan></text>
${rects}
<g class="agent">
  <rect x="7" y="0" width="1.5" height="3" class="dim"/><circle cx="7.75" cy="0" r="1.5" class="led"/>
  <rect x="1" y="3" width="13.5" height="10" rx="3" class="t"/>
  <rect x="3" y="5.5" width="3" height="3" rx="1" class="eye"/><rect x="9.5" y="5.5" width="3" height="3" rx="1" class="eye"/>
</g>
</svg>
`;
}
