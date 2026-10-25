import type { CityInput, MonthInput } from "@/core/model";
import { normalizeOwner } from "./normalize";
import {
  ACTIVITY_YEARS_QUERY,
  type ActivityYearResponse,
  type ActivityYearsResponse,
  GITHUB_GRAPHQL_URL,
  OWNER_REPOSITORIES_QUERY,
  type OwnerPage,
  type OwnerResponse,
  PAGE_SIZE,
  type RepoNode,
  activityYearQuery,
} from "./query";

/** Why a lookup produced no city. Every failure is one of these; nothing throws. */
export type GitHubError =
  | { kind: "invalid-login" }
  | { kind: "not-found" }
  /** `resetAt` is when GitHub accepts requests again, if it said. */
  | { kind: "rate-limited"; resetAt: string | null }
  /** The token is missing, wrong or expired: a configuration problem. */
  | { kind: "unauthorized" }
  /** Network failure, server error or an unexpected response. */
  | { kind: "unavailable"; detail: string };

export type GitHubResult = { ok: true; input: CityInput } | { ok: false; error: GitHubError };

export interface FetchOptions {
  token: string | undefined;
  fetch?: typeof fetch;
  endpoint?: string;
  /** Clock for `snapshotAt` and rate-limit resets; injectable for tests. */
  now?: () => Date;
  /**
   * Stop after this many repositories. Generation handles large accounts
   * (ARCHITECTURE.md §6.7); this only bounds the API cost of one lookup.
   */
  maxRepos?: number;
  /**
   * Also fetch the monthly contribution calendar (one request per year, plus
   * one), so every month with contributions becomes a house. Off by default.
   */
  activity?: boolean;
}

/** Contribution years fetched at most, the most recent ones. */
export const MAX_ACTIVITY_YEARS = 10;

export const MAX_REPOS = 1000;

// GitHub logins: letters, digits and single inner hyphens, at most 39 characters.
const LOGIN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export function isValidLogin(login: string): boolean {
  return LOGIN.test(login);
}

/**
 * Fetches the public repositories owned by `login` and normalizes them into a
 * `CityInput`. Pages through the GraphQL API 100 repositories at a time.
 */
export async function fetchCityInput(login: string, options: FetchOptions): Promise<GitHubResult> {
  if (!isValidLogin(login)) return failure({ kind: "invalid-login" });
  if (!options.token) return failure({ kind: "unauthorized" });
  const now = options.now ?? (() => new Date());
  const maxRepos = options.maxRepos ?? MAX_REPOS;

  const nodes: RepoNode[] = [];
  let owner: string | null = null;
  let after: string | null = null;
  do {
    const page = await fetchPage(login, after, options, now);
    if (!page.ok) return page;
    if (page.owner === null) return failure({ kind: "not-found" });
    owner ??= page.owner.login;
    const { nodes: pageNodes, pageInfo } = page.owner.repositories;
    for (const node of pageNodes) if (node) nodes.push(node);
    after = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (after !== null && nodes.length < maxRepos);

  // The calendar is a bonus: if it cannot be read, the city is built from
  // repositories alone.
  const activity = options.activity ? await fetchActivity(login, options, now()) : null;

  try {
    const input = normalizeOwner(owner ?? login, nodes.slice(0, maxRepos), now(), activity);
    return { ok: true, input };
  } catch (error) {
    return failure({ kind: "unavailable", detail: `unexpected data: ${message(error)}` });
  }
}

/**
 * Contributions per month for a user, oldest first, or null when they are not
 * available (an organization, an error, a rate limit). Never fails the lookup.
 */
async function fetchActivity(
  login: string,
  options: FetchOptions,
  until: Date,
): Promise<MonthInput[] | null> {
  const years = await graphql<ActivityYearsResponse>(ACTIVITY_YEARS_QUERY, login, options);
  const list = years?.data?.user?.contributionsCollection.contributionYears;
  if (!list) return null;
  const recent = [...list].sort((a, b) => b - a).slice(0, MAX_ACTIVITY_YEARS);
  const months: MonthInput[] = [];
  for (const year of recent.reverse()) {
    const body = await graphql<ActivityYearResponse>(
      activityYearQuery(year, until),
      login,
      options,
    );
    const user = body?.data?.user;
    if (!user) return null;
    for (let m = 1; m <= 12; m++) {
      const node = user[`m${String(m).padStart(2, "0")}`];
      if (!node) continue;
      const total = node.contributionCalendar.totalContributions;
      months.push({
        month: `${year}-${String(m).padStart(2, "0")}`,
        contributions: total,
        privateContributions: Math.min(total, node.restrictedContributionsCount),
      });
    }
  }
  return months;
}

/** One GraphQL request; null on any failure. */
async function graphql<T>(query: string, login: string, options: FetchOptions): Promise<T | null> {
  try {
    const response = await (options.fetch ?? fetch)(options.endpoint ?? GITHUB_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.token}`,
        "Content-Type": "application/json",
        "User-Agent": "commitcity",
      },
      body: JSON.stringify({ query, variables: { login } }),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

type PageResult = { ok: true; owner: OwnerPage | null } | { ok: false; error: GitHubError };

async function fetchPage(
  login: string,
  after: string | null,
  options: FetchOptions,
  now: () => Date,
): Promise<PageResult> {
  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(options.endpoint ?? GITHUB_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.token}`,
        "Content-Type": "application/json",
        "User-Agent": "commitcity",
      },
      body: JSON.stringify({
        query: OWNER_REPOSITORIES_QUERY,
        variables: { login, first: PAGE_SIZE, after },
      }),
    });
  } catch (error) {
    return failure({ kind: "unavailable", detail: `request failed: ${message(error)}` });
  }

  if (response.status === 401) return failure({ kind: "unauthorized" });
  const limited = rateLimit(response, now);
  if (limited) return failure(limited);
  if (!response.ok) return failure({ kind: "unavailable", detail: `HTTP ${response.status}` });

  let body: OwnerResponse;
  try {
    body = (await response.json()) as OwnerResponse;
  } catch {
    return failure({ kind: "unavailable", detail: "response is not JSON" });
  }

  const errors = body.errors ?? [];
  if (errors.some((e) => e.type === "RATE_LIMITED"))
    return failure({ kind: "rate-limited", resetAt: resetTime(response, now) });
  const owner = body.data?.repositoryOwner;
  if (owner === null || errors.some((e) => e.type === "NOT_FOUND" && e.path?.length === 1))
    return { ok: true, owner: null };
  // Errors deeper in the tree (a commit count that timed out) leave nulls in the
  // data, which normalization tolerates; anything else without data is fatal.
  if (owner === undefined)
    return failure({
      kind: "unavailable",
      detail: errors.map((e) => e.message).join("; ") || "response has no data",
    });
  return { ok: true, owner };
}

/** Primary limit: remaining 0. Secondary limit: 403 or 429 with `retry-after`. */
function rateLimit(response: Response, now: () => Date): GitHubError | null {
  if (response.status !== 403 && response.status !== 429) return null;
  const exhausted = response.headers.get("x-ratelimit-remaining") === "0";
  if (!exhausted && !response.headers.has("retry-after") && response.status !== 429) return null;
  return { kind: "rate-limited", resetAt: resetTime(response, now) };
}

function resetTime(response: Response, now: () => Date): string | null {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (retryAfter > 0) return new Date(now().getTime() + retryAfter * 1000).toISOString();
  const reset = Number(response.headers.get("x-ratelimit-reset"));
  if (reset > 0) return new Date(reset * 1000).toISOString();
  return null;
}

function failure(error: GitHubError): { ok: false; error: GitHubError } {
  return { ok: false, error };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
