import { type CityInput, type RepoInput, parseCityInput } from "@/core/model";
import type { RepoNode } from "./query";

/** One API repository as a `RepoInput`. Missing commit counts become null. */
export function normalizeRepo(node: RepoNode): RepoInput {
  return {
    id: node.id,
    name: node.name,
    description: node.description || null,
    createdAt: node.createdAt,
    pushedAt: node.pushedAt,
    primaryLanguage: node.primaryLanguage?.name || null,
    stars: node.stargazerCount,
    commitCount: node.defaultBranchRef?.target?.history?.totalCount ?? null,
    isFork: node.isFork,
    isArchived: node.isArchived,
  };
}

/**
 * Builds the `CityInput` for an owner. `owner` is the login as GitHub spells it,
 * so every spelling of a login gives the same city seed. Validated with
 * `parseCityInput`, so a surprise in the API fails here and not in generation.
 */
export function normalizeOwner(
  owner: string,
  nodes: readonly RepoNode[],
  snapshotAt: Date,
): CityInput {
  return parseCityInput({
    owner,
    snapshotAt: snapshotAt.toISOString(),
    repos: nodes.map(normalizeRepo),
  });
}
