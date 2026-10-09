import type { AssetCatalog } from "@/core/assets";
import type { CityInput, CityModel } from "@/core/model";
import { repoStream } from "@/core/random";
import { GENERATOR_VERSION } from "@/core/version";
import { createBuilding } from "./buildings";
import { sortRepos } from "./order";
import { lotAt } from "./spiral";
import { GROUND_MARGIN, decorateLot, fillGround, roadsAround } from "./surroundings";

/**
 * CityInput + AssetCatalog → CityModel (ARCHITECTURE.md §6.1). Pure and
 * deterministic: the same input and catalog always give a deep-equal model.
 *
 * Every repository becomes an individual building for now; aggregation above 300
 * repositories comes in Phase 6, so `aggregates` is always empty.
 */
export function generateCity(input: CityInput, catalog: AssetCatalog): CityModel {
  const repos = sortRepos(input.repos);
  const lots = repos.map((_, index) => lotAt(index));

  const buildings = repos.map((repo, i) =>
    createBuilding(
      input.owner,
      repo,
      lots[i]!,
      catalog,
      repoStream(input.owner, repo.id, "building"),
    ),
  );
  const decorations = repos.flatMap((repo, i) =>
    decorateLot(lots[i]!, buildings[i]!, repoStream(input.owner, repo.id, "decoration")),
  );

  const blocks = new Map(lots.map((lot) => [`${lot.block.x},${lot.block.y}`, lot.block]));
  const roads = roadsAround([...blocks.values()]);

  const bounds =
    roads.length === 0
      ? {
          minX: -GROUND_MARGIN,
          minY: -GROUND_MARGIN,
          maxX: GROUND_MARGIN - 1,
          maxY: GROUND_MARGIN - 1,
        }
      : {
          minX: Math.min(...roads.map((r) => r.x)) - GROUND_MARGIN,
          minY: Math.min(...roads.map((r) => r.y)) - GROUND_MARGIN,
          maxX: Math.max(...roads.map((r) => r.x)) + GROUND_MARGIN,
          maxY: Math.max(...roads.map((r) => r.y)) + GROUND_MARGIN,
        };
  const ground = fillGround(
    input.owner,
    bounds,
    lots.filter((_, i) => repos[i]!.isArchived),
  );

  return {
    generatorVersion: GENERATOR_VERSION,
    catalogVersion: catalog.version,
    bounds,
    ground,
    roads,
    buildings,
    decorations,
    aggregates: [],
  };
}
