// Systems panel card: a terminal-style panel listing what you run in production.
import { esc, textWidth } from './xml.mjs';

export const PANEL_FONTS = { body: 12.5, title: 13.5 };
const PAD = 16;
const GAP = 12;
const CARD_H = 84;
const GRID_TOP = 58;
const FOOTER_SPACE = 56;
const LOOP = 10; // seconds for the rise / typing cycle

/** Two-column grid geometry for `count` cards in a panel `width` px wide. */
export function panelLayout(count, width) {
  const cw = (width - PAD * 2 - GAP) / 2;
  const rows = Math.ceil(count / 2);
  const height = GRID_TOP + rows * (CARD_H + GAP) - GAP + FOOTER_SPACE;
  const positions = Array.from({ length: count }, (_, i) => ({
    x: PAD + (i % 2) * (cw + GAP),
    y: GRID_TOP + Math.floor(i / 2) * (CARD_H + GAP),
  }));
  return { cw, ch: CARD_H, rows, height, positions };
}

/** Horizontal room (px) for a card title (left of the status dot) and for a description line. */
export function cardTextRoom(width) {
  const { cw } = panelLayout(2, width);
  return { title: cw - 16 - 30, line: cw - 26 };
}

export const footerText = (footer) => footer.map((f) => (f.label ? `${f.value} ${f.label}` : f.value)).join('   ·   ');

/**
 * Renders the systems panel.
 * @param {{ user: string, width: number, content: object }} opts
 *   `content` is one resolved language variant from config.resolveLanguages().
 */
export function renderPanel({ user, width, content }) {
  const { cards, footer, command, theme } = content;
  const subtitle = content.subtitle.replaceAll('{count}', String(cards.length));
  const { cw, ch, height: H, positions } = panelLayout(cards.length, width);
  const perim = Math.round(2 * (cw + ch));
  const glow = theme.dark.accent;
  // Typing steps follow the longest line so each step reveals about one character.
  const steps = Math.max(8, ...cards.flatMap((c) => c.lines.map((l) => [...l].length)));
  const delay = (s) => `animation-delay:${s.toFixed(2)}s`;

  let tiles = '';
  cards.forEach((card, i) => {
    const { x, y } = positions[i];
    const t0 = 0.2 + i * 0.3;
    const lines = card.lines.map((l, j) => `<text class="t" x="${x + 16}" y="${y + 51 + j * 18}">${esc(l)}</text>`).join('\n');
    const covers = card.lines
      .map((_, j) => `<rect class="cover cvp" x="${x + 14}" y="${y + 38 + j * 18}" width="${cw - 24}" height="17" style="${delay(t0 + 0.3 * (j + 1))}"/>`)
      .join('\n');
    tiles += `<g class="tile" style="${delay(t0)}">
<rect class="panel" x="${x}" y="${y}" width="${cw}" height="${ch}" rx="6"/>
<rect class="beam" x="${x}" y="${y}" width="${cw}" height="${ch}" rx="6" style="${delay(i * 1.1)}"/>
<rect class="edge" x="${x}" y="${y + 12}" width="3" height="${ch - 24}" rx="1.5" style="${delay(t0)}"/>
<circle class="ring" cx="${x + cw - 16}" cy="${y + 20}" r="3.5" style="${delay(i * 0.4)}"/>
<circle class="live" cx="${x + cw - 16}" cy="${y + 20}" r="3.5" style="${delay(i * 0.4)}"/>
<text class="a h" x="${x + 16}" y="${y + 25}">${esc(card.title)}</text>
${lines}
${covers}</g>
`;
  });

  const sep = '<tspan class="dim">   ·   </tspan>';
  const footerSvg = footer.length
    ? `<text x="${PAD}" y="${H - 30}">${footer.map((f) => `<tspan class="a">${esc(f.value)}</tspan>${f.label ? `<tspan class="dim"> ${esc(f.label)}</tspan>` : ''}`).join(sep)}</text>`
    : '';

  const prompt = `agent@${user} ~ $ ${command}`;
  const coverW = Math.ceil(textWidth(prompt, PANEL_FONTS.body)) + 4;
  const label = `${subtitle}. ${cards.map((c) => `${c.title}: ${c.lines.join(' ')}`).join('. ')}`;
  const travel = width - PAD * 2 - 40;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${H}" viewBox="0 0 ${width} ${H}" role="img" aria-label="${esc(label)}">
<title>${esc(label)}</title>
<defs><linearGradient id="scan" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${glow}" stop-opacity="0"/><stop offset="1" stop-color="${glow}" stop-opacity=".3"/></linearGradient>
<linearGradient id="pk" x1="0" x2="1"><stop offset="0" stop-color="${glow}" stop-opacity="0"/><stop offset="1" stop-color="${glow}"/></linearGradient>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<style>
text{font:500 ${PANEL_FONTS.body}px 'JetBrains Mono',ui-monospace,Consolas,monospace}.h{font-weight:700;font-size:${PANEL_FONTS.title}px}
.bg{fill:#ffffff}.t{fill:#24292f}.a{fill:${theme.light.accent}}.dim{fill:#57606a}.panel{fill:#f6f8fa;stroke:#d0d7de}.edge{fill:${theme.light.accent}}
.tile{animation:rise ${LOOP}s ease-out infinite}
.edge{transform-box:fill-box;transform-origin:top;animation:edge ${LOOP}s ease-out infinite}
.live{fill:#22c55e;animation:pulse 1.6s ease-in-out infinite}
.ring{fill:none;stroke:#22c55e;stroke-width:1.5;transform-box:fill-box;transform-origin:center;animation:ring 1.6s ease-out infinite}
.beam{fill:none;stroke:${glow};stroke-width:1.5;stroke-linecap:round;stroke-dasharray:70 ${perim - 70};filter:url(#glow);animation:beam 4.4s linear infinite}
.cover{transform-box:fill-box;transform-origin:right;animation:type ${LOOP}s steps(${steps}) infinite}.cv{fill:#ffffff}.cvp{fill:#f6f8fa}
.tile,.edge,.cover{animation-fill-mode:backwards}
.track{stroke:#d0d7de;stroke-width:1}
.packet{filter:url(#glow);animation:flow 3s cubic-bezier(.6,0,.4,1) infinite}
.scan{animation:scan 4s linear infinite}
.cur{fill:${glow};animation:blink 1s steps(1) infinite}
@keyframes ring{0%{transform:scale(1);opacity:.8}100%{transform:scale(3.2);opacity:0}}
@keyframes beam{to{stroke-dashoffset:-${perim}}}
@keyframes type{0%{transform:scaleX(1)}14%,90%{transform:scaleX(0)}99%,100%{transform:scaleX(1)}}
@keyframes flow{0%{transform:translateX(0);opacity:0}10%,90%{opacity:1}100%{transform:translateX(${travel}px);opacity:0}}
@keyframes rise{0%{opacity:0;transform:translateY(10px)}10%,88%{opacity:1;transform:translateY(0)}98%,100%{opacity:0;transform:translateY(10px)}}
@keyframes edge{0%,6%{transform:scaleY(0)}20%,88%{transform:scaleY(1)}98%,100%{transform:scaleY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.2}}
@keyframes scan{0%{transform:translateY(-40px)}100%{transform:translateY(${H}px)}}
@keyframes blink{0%{opacity:1}50%{opacity:0}}
@media (prefers-color-scheme:dark){.bg{fill:#0d1117}.t{fill:#c9d1d9}.a{fill:${theme.dark.accent}}.dim{fill:#8b98a6}.panel{fill:#161b22;stroke:#30363d}.edge{fill:${theme.dark.accent}}.track{stroke:#30363d}.cv{fill:#0d1117}.cvp{fill:#161b22}}
@media (prefers-reduced-motion:reduce){.tile,.edge,.live,.cur{animation:none}.scan,.beam,.ring,.packet,.cover{display:none}}
</style>
<rect class="bg" width="100%" height="100%" rx="6"/>
<text x="${PAD}" y="24"><tspan class="a" font-weight="700">agent@${esc(user)}</tspan><tspan class="dim"> ~ $ </tspan><tspan class="t">${esc(command)}</tspan></text><rect class="cover cv" x="${PAD}" y="9" width="${coverW}" height="20"/><rect class="cur" x="${PAD + coverW + 2}" y="13" width="7" height="14"/>
<text class="dim" x="${PAD}" y="46">${esc(subtitle)}</text>
${tiles}${footerSvg}
<line class="track" x1="${PAD}" y1="${H - 13}" x2="${width - PAD}" y2="${H - 13}"/>
<rect class="packet" x="${PAD}" y="${H - 14.5}" width="40" height="3" rx="1.5" fill="url(#pk)"/>
<rect class="packet" x="${PAD}" y="${H - 14.5}" width="40" height="3" rx="1.5" fill="url(#pk)" style="animation-delay:1.5s"/>
<rect class="scan" x="0" y="0" width="${width}" height="40" fill="url(#scan)" pointer-events="none"/>
</svg>
`;
}
