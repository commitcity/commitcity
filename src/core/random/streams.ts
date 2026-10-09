import { createRandom, type Random } from "./prng";

/**
 * Seed for everything that belongs to one repository (ARCHITECTURE.md §5).
 * Built from the owner and the repository's stable id, never from its position,
 * so adding a repository never changes the random choices of another.
 */
export function repoSeed(owner: string, repoId: string): string {
  return `${owner}:${repoId}`;
}

/**
 * The random stream of one repository. `purpose` gives separate, independent
 * streams for different decisions (for example "building" and "decoration"), so
 * drawing one more number for one of them never shifts the other.
 */
export function repoStream(owner: string, repoId: string, purpose: string): Random {
  return createRandom(`${repoSeed(owner, repoId)}/${purpose}`);
}
