// Pure entry point: data in, list of { file, svg } out. No network or file system.
import { resolveLanguages } from './config.mjs';
import { renderContrib, contribSize } from './contrib.mjs';
import { renderPanel } from './panel.mjs';

export const CONTRIB_FILE = 'agent-contrib';
export const PANEL_FILE = 'agent-panel';

/**
 * @param {{ user: string, calendar: object, config: object }} opts  `config` comes from validateConfig().
 * @returns {{ file: string, svg: string }[]}
 */
export function renderAll({ user, calendar, config }) {
  const { width } = contribSize(calendar.weeks.length);
  const files = [];
  for (const { suffix, content } of resolveLanguages(config)) {
    const label = content.contributions.replaceAll('{count}', String(calendar.totalContributions));
    files.push({ file: `${CONTRIB_FILE}${suffix}.svg`, svg: renderContrib({ user, calendar, theme: content.theme, label }) });
    if (content.cards.length) {
      files.push({ file: `${PANEL_FILE}${suffix}.svg`, svg: renderPanel({ user, width, content }) });
    }
  }
  return files;
}
