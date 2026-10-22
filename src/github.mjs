// Fetches a user's contribution calendar from the GitHub GraphQL API.
const QUERY = `query($login:String!){user(login:$login){
  contributionsCollection{contributionCalendar{
    totalContributions weeks{contributionDays{date contributionCount contributionLevel}}}}}}`;

export const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

/**
 * @param {string} login GitHub username
 * @param {string} token token with read access to public profile data
 * @param {typeof fetch} [fetchImpl] injectable for tests
 * @returns {Promise<{ totalContributions: number, weeks: object[] }>}
 */
export async function fetchCalendar(login, token, fetchImpl = globalThis.fetch) {
  if (!token) throw new Error('Missing GitHub token: set the "github_token" input (or GH_TOKEN locally).');
  if (!LOGIN.test(login ?? '')) throw new Error(`Invalid GitHub username: "${login}".`);

  let res;
  try {
    res = await fetchImpl('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'github-agent-cards' },
      body: JSON.stringify({ query: QUERY, variables: { login } }),
    });
  } catch (err) {
    throw new Error(`Could not reach the GitHub API: ${err.message}`);
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`GitHub API returned HTTP ${res.status} with a non-JSON body.`);
  }
  if (res.status === 401) throw new Error('GitHub API rejected the token (HTTP 401). Check the "github_token" input.');
  if (!res.ok) throw new Error(`GitHub API error (HTTP ${res.status}): ${json?.message ?? JSON.stringify(json)}`);
  if (json.errors?.length) {
    const notFound = json.errors.find((e) => e.type === 'NOT_FOUND');
    if (notFound) throw new Error(`GitHub user "${login}" was not found.`);
    throw new Error(`GitHub API error: ${json.errors.map((e) => e.message).join('; ')}`);
  }
  const calendar = json.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) throw new Error(`GitHub user "${login}" was not found or has no contribution data.`);
  return calendar;
}
