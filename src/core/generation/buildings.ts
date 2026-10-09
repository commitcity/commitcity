import {
  type AssetCatalog,
  type BuildingManifest,
  FAMILIES,
  type Family,
  type Variant,
} from "@/core/assets";
import type { Building, Facing, Footprint, RepoInput } from "@/core/model";
import { type Random, hash53, repoSeed } from "@/core/random";
import { LOT_SIZE } from "./layout";
import type { Lot } from "./spiral";

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

/** Family from the language table; unknown or missing languages draw from the repo's stream. */
export function familyFromLanguage(language: string | null, random: Random): Family {
  const known = language === null ? undefined : LANGUAGE_FAMILIES[language];
  return known ?? random.pick(FAMILIES);
}

/**
 * Picks the manifest for a building with rendezvous hashing: every candidate gets
 * the score `hash(repoSeed + manifest.id)` and the highest wins. Adding a manifest
 * only takes over the buildings where it scores highest. If nothing matches, the
 * family requirement is relaxed first, then the level. The footprint is never
 * relaxed.
 */
export function chooseManifest(
  catalog: AssetCatalog,
  seed: string,
  wanted: { family: Family; footprint: Footprint; level: number; variant: Variant },
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
    if (candidates.length > 0) return highestScore(candidates, seed);
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

/**
 * Builds the building for one repository on its lot. The building stands in the
 * lot's outer corner, against both roads that border the lot, and faces one of
 * them. The rest of the lot is left for decoration.
 */
export function createBuilding(
  owner: string,
  repo: RepoInput,
  lot: Lot,
  catalog: AssetCatalog,
  random: Random,
): Building {
  const family = familyFromLanguage(repo.primaryLanguage, random);
  const isAnnex = repo.isFork;
  const base = footprintFromStars(repo.stars);
  const footprint = (isAnnex ? Math.max(1, base - 1) : base) as Footprint;
  const level = levelFromCommits(repo.commitCount);
  const variant: Variant = repo.isArchived ? "abandoned" : "default";

  // Cell x 1 borders the +x road, cell x 0 the -x road; the same for y.
  const sideX: Facing = lot.cell.x === 1 ? 0 : 2;
  const sideY: Facing = lot.cell.y === 1 ? 1 : 3;
  const facing = random.chance(0.5) ? sideX : sideY;

  const manifest = chooseManifest(catalog, repoSeed(owner, repo.id), {
    family,
    footprint,
    level,
    variant,
  });
  return {
    repoId: repo.id,
    manifestId: manifest.id,
    origin: {
      x: lot.cell.x === 1 ? lot.origin.x + LOT_SIZE - footprint : lot.origin.x,
      y: lot.cell.y === 1 ? lot.origin.y + LOT_SIZE - footprint : lot.origin.y,
    },
    footprint,
    family,
    facing,
    level,
    variant,
    isAnnex,
  };
}
