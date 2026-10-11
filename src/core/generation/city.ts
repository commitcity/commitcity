import type { AssetCatalog } from "@/core/assets";
import type { CityInput, CityModel } from "@/core/model";
import { repoStream } from "@/core/random";
import { GENERATOR_VERSION } from "@/core/version";
import { createBuilding } from "./buildings";
import { sortRepos } from "./order";
import { cornerPond, parkLot } from "./parks";
import { lotAt } from "./spiral";
import { LOTS_PER_BLOCK } from "./layout";
import { GROUND_MARGIN, decorateLot, fillGround, roadsAround } from "./surroundings";

/**
 * CityInput + AssetCatalog → CityModel (ARCHITECTURE.md §6.1). Pure and
 * deterministic: the same input and catalog always give a deep-equal model.
 *
 * Every repository becomes an individual building for now, and parks fill the
 * space left over; aggregation above 300
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
  // Parks: the unused lots of the last block, and ponds beside small buildings.
  const lotsInUse = Math.ceil(repos.length / LOTS_PER_BLOCK) * LOTS_PER_BLOCK;
  const parks = [
    ...repos.map((_, i) => cornerPond(input.owner, lots[i]!, buildings[i]!)),
    ...Array.from({ length: lotsInUse - repos.length }, (_, k) =>
      parkLot(input.owner, lotAt(repos.length + k)),
    ),
  ];
  const water = new Set(parks.flatMap((park) => park.water.map(({ x, y }) => `${x},${y}`)));
  const decorations = [
    ...repos.flatMap((repo, i) =>
      decorateLot(lots[i]!, buildings[i]!, repoStream(input.owner, repo.id, "decoration")),
    ),
    ...parks.flatMap((park) => park.decorations),
  ].filter((d) => !water.has(`${d.x},${d.y}`));

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
    water,
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
