import type { RepoInput } from "@/core/model";

/**
 * Placement order: oldest first, ties broken by id (ARCHITECTURE.md §6.3).
 * Dates are compared as instants, ids by UTF-16 code units, so the order never
 * depends on locale or on the input order.
 */
export function compareRepos(a: RepoInput, b: RepoInput): number {
  const byDate = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  if (byDate !== 0) return byDate;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortRepos(repos: readonly RepoInput[]): RepoInput[] {
  return [...repos].sort(compareRepos);
}
