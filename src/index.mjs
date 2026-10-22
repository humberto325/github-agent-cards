// Action / CLI entry point.
// As a GitHub Action, inputs arrive as INPUT_* environment variables.
// Locally: GH_TOKEN=... node src/index.mjs <username> [config.json] [output_dir]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateConfig } from './config.mjs';
import { fetchCalendar } from './github.mjs';
import { renderAll, PANEL_FILE } from './render.mjs';

const inActions = process.env.GITHUB_ACTIONS === 'true';
const input = (name) => process.env[`INPUT_${name.toUpperCase()}`]?.trim() || undefined;
const warn = (msg) => console.log(inActions ? `::warning::${msg}` : `warning: ${msg}`);
// Throw instead of process.exit(): exiting while a fetch socket is still closing
// can crash libuv on Windows. main() reports the error and sets the exit code.
class Fatal extends Error {}
const fail = (msg) => {
  throw new Fatal(msg);
};
const report = (msg) => {
  // Annotations are single-line; keep the full multi-line text in the log too.
  if (inActions) console.log(`::error::${msg.replaceAll('\n', '%0A')}`);
  console.error(msg);
  process.exitCode = 1;
};

function loadConfig(path) {
  if (!path) return {};
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (err) {
    fail(`Cannot read config file "${path}": ${err.code === 'ENOENT' ? 'file not found' : err.message}`);
  }
  try {
    return JSON.parse(text.replace(/^﻿/, ''));
  } catch (err) {
    fail(`Config file "${path}" is not valid JSON: ${err.message}`);
  }
}

async function main() {
  const [argUser, argConfig, argOut] = process.argv.slice(2);
  const token = input('github_token') || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const user = input('username') || argUser || process.env.GITHUB_REPOSITORY_OWNER;
  const configPath = input('config') || argConfig;
  const outDir = input('output_dir') || argOut || 'assets';

  if (!token) fail('Missing GitHub token: set the "github_token" input (or GH_TOKEN locally).');
  if (!user) fail('Missing username: set the "username" input (or pass it as the first argument).');

  let config, warnings;
  try {
    ({ config, warnings } = validateConfig(loadConfig(configPath)));
  } catch (err) {
    fail(err.message);
  }
  warnings.forEach(warn);

  let calendar;
  try {
    calendar = await fetchCalendar(user, token);
  } catch (err) {
    fail(err.message);
  }

  const files = renderAll({ user, calendar, config });
  mkdirSync(outDir, { recursive: true });
  for (const { file, svg } of files) writeFileSync(join(outDir, file), svg);
  if (!files.some((f) => f.file.startsWith(PANEL_FILE))) console.log('No "cards" in config: systems panel skipped.');
  console.log(`Wrote ${files.map((f) => join(outDir, f.file)).join(', ')} (${calendar.totalContributions} contributions).`);
}

main().catch((err) => report(err instanceof Fatal ? err.message : `Unexpected error: ${err.stack ?? err}`));
