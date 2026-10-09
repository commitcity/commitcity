import type { CityInput } from "@/core/model";
import { sortRepos } from "./order";
import { type Lot, lotAt } from "./spiral";

export interface LotAssignment {
  repoId: string;
  lot: Lot;
}

/**
 * Gives every repository one lot in the chronological spiral (ARCHITECTURE.md
 * §6.3). Positions depend only on creation order: stars, commits, archiving, and
 * newer repositories never move an existing lot.
 */
export function placeRepos(input: CityInput): LotAssignment[] {
  return sortRepos(input.repos).map((repo, index) => ({ repoId: repo.id, lot: lotAt(index) }));
}
