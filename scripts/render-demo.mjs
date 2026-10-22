// Renders the README previews in docs/ from the test fixture and the example config (no network).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { validateConfig, resolveLanguages } from '../src/config.mjs';
import { renderContrib, contribSize } from '../src/contrib.mjs';
import { renderPanel } from '../src/panel.mjs';

const root = new URL('../', import.meta.url);
const calendar = JSON.parse(readFileSync(new URL('test/fixtures/calendar.json', root), 'utf8'));
const raw = JSON.parse(readFileSync(new URL('examples/agent-cards.config.json', root), 'utf8'));
const { config, warnings } = validateConfig(raw);
warnings.forEach((w) => console.warn(`warning: ${w}`));

const user = 'octocat';
const [{ content }] = resolveLanguages(config);
const label = content.contributions.replaceAll('{count}', String(calendar.totalContributions));
mkdirSync(new URL('docs/', root), { recursive: true });
writeFileSync(new URL('docs/demo-contrib.svg', root), renderContrib({ user, calendar, theme: content.theme, label }));
writeFileSync(new URL('docs/demo-panel.svg', root), renderPanel({ user, width: contribSize(calendar.weeks.length).width, content }));
console.log('Wrote docs/demo-contrib.svg and docs/demo-panel.svg');
