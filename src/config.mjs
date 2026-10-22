// Config validation and per-language resolution. Pure: no file system access.
import { textWidth } from './xml.mjs';
import { cardTextRoom, PANEL_FONTS, footerText } from './panel.mjs';

export const DEFAULT_WIDTH = 771; // width of a 53-week calendar card

export const DEFAULT_THEME = {
  light: { accent: '#0e7490', levels: ['#ebedf0', '#a5f3fc', '#22d3ee', '#0891b2', '#0e7490'] },
  dark: { accent: '#22d3ee', levels: ['#161b22', '#0e4f5c', '#0e7490', '#06b6d4', '#22d3ee'] },
};

// Keys that may also appear inside `languages.<code>` as localized overrides.
export const DEFAULTS = {
  command: 'systems --status production',
  subtitle: '{count} systems running right now',
  contributions: '{count} contributions in the last year',
  cards: [],
  footer: [],
};

export const MIN_CARDS = 2;
export const MAX_CARDS = 6;

const LOCALIZABLE = Object.keys(DEFAULTS);
const TOP_KEYS = new Set(['theme', 'languages', ...LOCALIZABLE]);
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const LANG_CODE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/;

export class ConfigError extends Error {
  constructor(errors) {
    super(`Invalid config:\n  - ${errors.join('\n  - ')}`);
    this.name = 'ConfigError';
    this.errors = errors;
  }
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';

function overflow(path, text, fontPx, room, what) {
  const w = textWidth(text, fontPx);
  if (w <= room) return null;
  const chars = Math.floor(room / (fontPx * 0.6));
  return `${path} is ~${Math.round(w)}px wide and may overflow the ${what} (~${Math.floor(room)}px, about ${chars} characters, available)`;
}

function checkCards(cards, path, width, errors, warnings) {
  if (!Array.isArray(cards)) return errors.push(`${path} must be an array`);
  if (cards.length === 0) return; // no cards: the systems panel is skipped
  if (cards.length < MIN_CARDS || cards.length > MAX_CARDS) {
    return errors.push(`${path} must have between ${MIN_CARDS} and ${MAX_CARDS} items (got ${cards.length})`);
  }
  const room = cardTextRoom(width);
  cards.forEach((card, i) => {
    const cp = `${path}[${i}]`;
    if (!isObj(card)) return errors.push(`${cp} must be an object with "title" and "lines"`);
    for (const k of Object.keys(card)) if (k !== 'title' && k !== 'lines') errors.push(`${cp}.${k} is not a known card key`);
    if (!isText(card.title)) errors.push(`${cp}.title must be a non-empty string`);
    else warnings.push(overflow(`${cp}.title`, card.title, PANEL_FONTS.title, room.title, 'card'));
    const { lines } = card;
    if (!Array.isArray(lines) || lines.length < 1 || lines.length > 2 || !lines.every((l) => typeof l === 'string')) {
      errors.push(`${cp}.lines must be an array of 1 or 2 strings`);
    } else {
      lines.forEach((l, j) => warnings.push(overflow(`${cp}.lines[${j}]`, l, PANEL_FONTS.body, room.line, 'card')));
    }
  });
}

function checkFooter(footer, path, width, errors, warnings) {
  if (!Array.isArray(footer)) return errors.push(`${path} must be an array`);
  let ok = true;
  footer.forEach((f, i) => {
    const fp = `${path}[${i}]`;
    if (!isObj(f) || !isText(f.value)) { ok = false; return errors.push(`${fp}.value must be a non-empty string`); }
    if ('label' in f && typeof f.label !== 'string') { ok = false; errors.push(`${fp}.label must be a string`); }
  });
  if (ok && footer.length) warnings.push(overflow(path, footerText(footer), PANEL_FONTS.body, width - 32, 'panel'));
}

function checkContent(src, prefix, width, errors, warnings) {
  const p = (k) => `${prefix}${k}`;
  for (const k of ['command', 'subtitle', 'contributions']) {
    if (k in src && !isText(src[k])) errors.push(`${p(k)} must be a non-empty string`);
  }
  if ('cards' in src) checkCards(src.cards, p('cards'), width, errors, warnings);
  if ('footer' in src) checkFooter(src.footer, p('footer'), width, errors, warnings);
}

function checkTheme(theme, errors) {
  if (!isObj(theme)) return errors.push('theme must be an object with "light" and/or "dark"');
  for (const [mode, t] of Object.entries(theme)) {
    if (mode !== 'light' && mode !== 'dark') { errors.push(`theme.${mode} is not supported (use "light" or "dark")`); continue; }
    if (!isObj(t)) { errors.push(`theme.${mode} must be an object`); continue; }
    for (const k of Object.keys(t)) if (k !== 'accent' && k !== 'levels') errors.push(`theme.${mode}.${k} is not a known key (use "accent" or "levels")`);
    if ('accent' in t && !(typeof t.accent === 'string' && HEX.test(t.accent))) {
      errors.push(`theme.${mode}.accent must be a hex color like "#0e7490"`);
    }
    if ('levels' in t && !(Array.isArray(t.levels) && t.levels.length === 5 && t.levels.every((c) => typeof c === 'string' && HEX.test(c)))) {
      errors.push(`theme.${mode}.levels must be an array of 5 hex colors (no contributions first, most contributions last)`);
    }
  }
}

/**
 * Validates a raw config object and applies defaults.
 * Returns { config, warnings }; throws ConfigError listing every problem found.
 */
export function validateConfig(raw = {}, { width = DEFAULT_WIDTH } = {}) {
  if (!isObj(raw)) throw new ConfigError(['config must be a JSON object']);
  const errors = [];
  const warnings = [];
  for (const k of Object.keys(raw)) if (!TOP_KEYS.has(k)) errors.push(`"${k}" is not a known config key`);
  if ('theme' in raw) checkTheme(raw.theme, errors);
  checkContent(raw, '', width, errors, warnings);
  if ('languages' in raw) {
    if (!isObj(raw.languages)) {
      errors.push('languages must be an object like { "es": { ... } }');
    } else {
      for (const [code, over] of Object.entries(raw.languages)) {
        const lp = `languages.${code}`;
        if (!LANG_CODE.test(code)) { errors.push(`${lp}: "${code}" is not a valid language code (e.g. "es", "pt-BR")`); continue; }
        if (!isObj(over)) { errors.push(`${lp} must be an object`); continue; }
        for (const k of Object.keys(over)) if (!LOCALIZABLE.includes(k)) errors.push(`${lp}.${k} cannot be localized (allowed: ${LOCALIZABLE.join(', ')})`);
        checkContent(over, `${lp}.`, width, errors, warnings);
      }
    }
  }
  if (errors.length) throw new ConfigError(errors);

  const config = {
    theme: {
      light: { ...DEFAULT_THEME.light, ...raw.theme?.light },
      dark: { ...DEFAULT_THEME.dark, ...raw.theme?.dark },
    },
    languages: raw.languages ?? {},
  };
  for (const k of LOCALIZABLE) config[k] = raw[k] ?? DEFAULTS[k];
  return { config, warnings: warnings.filter(Boolean) };
}

/** One variant per output language: the default (plain file names) plus one per `languages` entry. */
export function resolveLanguages(config) {
  const { languages, ...base } = config;
  return [
    { lang: null, suffix: '', content: base },
    ...Object.entries(languages).map(([code, over]) => ({ lang: code, suffix: `.${code}`, content: { ...base, ...over } })),
  ];
}
