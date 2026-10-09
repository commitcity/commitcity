import { cacheLife, cacheTag } from "next/cache";
import { type GitHubResult, fetchCityInput, isValidLogin } from "./fetchCityInput";

// Server only: reads GITHUB_TOKEN, which must never reach the client
// (ARCHITECTURE.md §10). Not prefixed with NEXT_PUBLIC_, so Next.js never inlines it.

/**
 * The `CityInput` for a login, cached across requests and server instances:
 * a city is refreshed in the background after a day, and a missing user is
 * looked up again after an hour. Rate limits and outages are kept for a few
 * seconds only, so a burst of requests makes one API call and the next ones
 * try again.
 */
export async function getCityInput(login: string): Promise<GitHubResult> {
  if (!isValidLogin(login)) return { ok: false, error: { kind: "invalid-login" } };
  // Logins are case-insensitive; one cache entry per account.
  return lookup(login.toLowerCase());
}

/** Tag of a login's cached city, for `revalidateTag`. */
export function cityTag(login: string): string {
  return `github:${login.toLowerCase()}`;
}

async function lookup(login: string): Promise<GitHubResult> {
  "use cache: remote";
  cacheTag(cityTag(login));
  const result = await fetchCityInput(login, {
    token: process.env.GITHUB_TOKEN,
    endpoint: process.env.GITHUB_GRAPHQL_URL || undefined,
  });
  // Errors are returned, not thrown: production builds hide thrown messages.
  if (result.ok) cacheLife("days");
  else if (result.error.kind === "not-found") cacheLife("hours");
  else cacheLife("seconds");
  return result;
}
