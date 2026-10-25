import {
  type AssetCatalog,
  type BuildingManifest,
  FAMILIES,
  type Family,
  type Variant,
} from "@/core/assets";
import type { Building, Facing, Footprint, MonthInput, RepoInput } from "@/core/model";
import { type Random, hash53, repoSeed } from "@/core/random";

// Repository-to-building mapping (ARCHITECTURE.md §6.5). Thresholds are proposals
// to tune with real data; changing any of them changes generated cities, so bump
// GENERATOR_VERSION when you do.

/** 0–9 stars → 1, 10–99 → 2, 100–999 → 3, ≥ 1000 → 4. */
export function footprintFromStars(stars: number): Footprint {
  if (stars >= 1000) return 4;
  if (stars >= 100) return 3;
  if (stars >= 10) return 2;
  return 1;
}

/**
 * < 100 commits → 1, < 400 → 2, < 3000 → 3, otherwise 4. Few repositories have
 * ten stars, so without this an everyday developer's city is all 1 × 1 houses;
 * a project with a few hundred commits is a big building whatever its stars.
 */
export function footprintFromCommits(commitCount: number | null): Footprint {
  if (commitCount === null || commitCount < 100) return 1;
  if (commitCount < 400) return 2;
  if (commitCount < 3000) return 3;
  return 4;
}

/** Commits per extra wing, and the most wings one repository grows. */
export const COMMITS_PER_WING = 300;
export const MAX_WINGS = 3;

/**
 * Extra wings beside a repository's main building: one per 300 commits, at most
 * three. A fork has none, since its commits are mostly its upstream's.
 */
export function wingsFromCommits(commitCount: number | null, isFork: boolean): number {
  if (isFork || commitCount === null) return 0;
  return Math.min(MAX_WINGS, Math.floor(commitCount / COMMITS_PER_WING));
}

/** < 50 commits → 1, < 500 → 2, otherwise 3. Unknown commit counts are level 1. */
export function levelFromCommits(commitCount: number | null): number {
  if (commitCount === null || commitCount < 50) return 1;
  if (commitCount < 500) return 2;
  return 3;
}

const LANGUAGE_FAMILIES: Readonly<Record<string, Family>> = {
  // Web and app languages
  TypeScript: "modern",
  JavaScript: "modern",
  HTML: "modern",
  CSS: "modern",
  SCSS: "modern",
  Vue: "modern",
  Svelte: "modern",
  Dart: "modern",
  Kotlin: "modern",
  Swift: "modern",
  // Systems and compiled languages
  C: "industrial",
  "C++": "industrial",
  "C#": "industrial",
  Rust: "industrial",
  Go: "industrial",
  Zig: "industrial",
  Java: "industrial",
  Scala: "industrial",
  Assembly: "industrial",
  // Scripting languages
  Python: "brick",
  Ruby: "brick",
  PHP: "brick",
  Perl: "brick",
  Shell: "brick",
  PowerShell: "brick",
  Lua: "brick",
  R: "brick",
  Elixir: "brick",
  Haskell: "brick",
  Clojure: "brick",
  Julia: "brick",
  // Documentation, notebooks, and configuration
  Markdown: "residential",
  MDX: "residential",
  TeX: "residential",
  "Jupyter Notebook": "residential",
  Dockerfile: "residential",
  Nix: "residential",
  HCL: "residential",
  Makefile: "residential",
  YAML: "residential",
};

/** Families a language can map to; the village family is for small towns only. */
const CITY_FAMILIES = FAMILIES.filter((f) => f !== "village");

/** Family from the language table; unknown or missing languages draw from the repo's stream. */
export function familyFromLanguage(language: string | null, random: Random): Family {
  const known = language === null ? undefined : LANGUAGE_FAMILIES[language];
  return known ?? random.pick(CITY_FAMILIES);
}

/**
 * Accounts with this many public repositories or fewer are a village: every
 * building is drawn from the village family (wooden houses, a barn, a chapel),
 * whatever its language. The next repository turns the village into a town.
 */
export const VILLAGE_MAX_REPOS = 8;

/** A drawing without its level suffix: "brick-store-plum-brown-l2" → "brick-store-plum-brown". */
export const designOf = (manifestId: string) => manifestId.replace(/-l\d+$/, "");
/** The model a drawing belongs to, whatever its colours: "brick-store-plum-brown-l2" → "brick-store". */
export const modelOf = (manifestId: string) => manifestId.split("-").slice(0, 2).join("-");

/**
 * Picks the manifest for a building with rendezvous hashing: every candidate gets
 * the score `hash(repoSeed + manifest.id)` and the highest wins. Adding a manifest
 * only takes over the buildings where it scores highest. If nothing matches, the
 * family requirement is relaxed first, then the level. The footprint is never
 * relaxed. `penalty` ranks candidates first (lowest wins), so a building can
 * steer away from its neighbours' drawings while any other candidate is left.
 */
export function chooseManifest(
  catalog: AssetCatalog,
  seed: string,
  wanted: { family: Family; footprint: Footprint; level: number; variant: Variant },
  penalty: (manifest: BuildingManifest) => number = () => 0,
): BuildingManifest {
  const fits = (m: BuildingManifest, family: boolean, level: boolean) =>
    m.footprint === wanted.footprint &&
    m.variants.includes(wanted.variant) &&
    (!family || m.family === wanted.family) &&
    (!level || m.levels.includes(wanted.level));

  for (const [family, level] of [
    [true, true],
    [false, true],
    [false, false],
  ] as const) {
    const candidates = catalog.buildings.filter((m) => fits(m, family, level));
    if (candidates.length === 0) continue;
    const scored = candidates.map((m) => ({ m, p: penalty(m) }));
    const least = Math.min(...scored.map((c) => c.p));
    return highestScore(
      scored.filter((c) => c.p === least).map((c) => c.m),
      seed,
    );
  }
  throw new Error(
    `No manifest in catalog ${catalog.version} has footprint ${wanted.footprint} and variant "${wanted.variant}"`,
  );
}

function highestScore(candidates: BuildingManifest[], seed: string): BuildingManifest {
  let best = candidates[0]!;
  let bestScore = hash53(`${seed}|${best.id}`);
  for (const candidate of candidates.slice(1)) {
    const score = hash53(`${seed}|${candidate.id}`);
    if (score > bestScore || (score === bestScore && candidate.id < best.id)) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/** What a repository looks like before it has a place: family, size, level, condition. */
export interface BuildingTraits {
  family: Family;
  footprint: Footprint;
  level: number;
  variant: Variant;
  isAnnex: boolean;
}

export function buildingTraits(repo: RepoInput, random: Random, village = false): BuildingTraits {
  const language = familyFromLanguage(repo.primaryLanguage, random);
  const family: Family = village ? "village" : language;
  const isAnnex = repo.isFork;
  // A fork's commits are mostly its upstream's, so only its stars count.
  const base = isAnnex
    ? footprintFromStars(repo.stars)
    : (Math.max(
        footprintFromStars(repo.stars),
        footprintFromCommits(repo.commitCount),
      ) as Footprint);
  return {
    family,
    footprint: (isAnnex ? Math.max(1, base - 1) : base) as Footprint,
    level: levelFromCommits(repo.commitCount),
    variant: repo.isArchived ? "abandoned" : "default",
    isAnnex,
  };
}

/**
 * A house of the contribution calendar: one per month with contributions,
 * private ones included. A busy month (150 or more) is a 2 × 2 house; the level
 * (storeys) grows at 20 and 80 contributions.
 */
export function houseTraits(month: MonthInput, village: boolean): BuildingTraits {
  const n = month.contributions;
  return {
    family: village ? "village" : "residential",
    footprint: n >= 150 ? 2 : 1,
    level: n < 20 ? 1 : n < 80 ? 2 : 3,
    variant: "default",
    isAnnex: false,
  };
}

/** A wing is one size smaller than its main building, and otherwise alike. */
export function wingTraits(main: BuildingTraits): BuildingTraits {
  return { ...main, footprint: Math.max(1, main.footprint - 1) as Footprint };
}

/** The building for one repository at its place along a street, facing that street. */
export function createBuilding(
  owner: string,
  repo: { id: string },
  traits: BuildingTraits,
  placement: { origin: { x: number; y: number }; facing: Facing },
  catalog: AssetCatalog,
  penalty?: (manifest: BuildingManifest) => number,
  wing = 0,
): Building {
  const seed = repoSeed(owner, repo.id) + (wing ? `:wing:${wing}` : "");
  const manifest = chooseManifest(catalog, seed, traits, penalty);
  return {
    repoId: repo.id,
    manifestId: manifest.id,
    origin: { ...placement.origin },
    footprint: traits.footprint,
    family: traits.family,
    facing: placement.facing,
    level: traits.level,
    variant: traits.variant,
    isAnnex: traits.isAnnex,
    ...(wing ? { wing } : {}),
  };
}
