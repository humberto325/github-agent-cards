import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchCalendar } from '../src/github.mjs';

// Minimal fetch stand-in: no network is used by the test suite.
const fakeFetch = (status, body) => async () => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
});

test('returns the contribution calendar on success', async () => {
  const calendar = { totalContributions: 3, weeks: [] };
  const got = await fetchCalendar('octocat', 't', fakeFetch(200, { data: { user: { contributionsCollection: { contributionCalendar: calendar } } } }));
  assert.deepEqual(got, calendar);
});

test('fails clearly on missing token and invalid username', async () => {
  await assert.rejects(fetchCalendar('octocat', '', fakeFetch(200, {})), /Missing GitHub token/);
  await assert.rejects(fetchCalendar('bad user!', 't', fakeFetch(200, {})), /Invalid GitHub username/);
});

test('fails clearly on API errors', async () => {
  await assert.rejects(fetchCalendar('octocat', 't', fakeFetch(401, { message: 'Bad credentials' })), /rejected the token \(HTTP 401\)/);
  await assert.rejects(fetchCalendar('octocat', 't', fakeFetch(502, { message: 'Bad gateway' })), /HTTP 502\): Bad gateway/);
  await assert.rejects(fetchCalendar('ghost-x', 't', fakeFetch(200, { data: { user: null }, errors: [{ type: 'NOT_FOUND', message: 'nope' }] })), /"ghost-x" was not found/);
  await assert.rejects(fetchCalendar('octocat', 't', fakeFetch(200, { errors: [{ message: 'rate limited' }] })), /GitHub API error: rate limited/);
  await assert.rejects(fetchCalendar('octocat', 't', fakeFetch(500, '<html>')), /non-JSON body/);
  await assert.rejects(fetchCalendar('octocat', 't', async () => { throw new Error('ECONNRESET'); }), /Could not reach the GitHub API: ECONNRESET/);
});
