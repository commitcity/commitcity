import type { AssetCatalog } from "@/core/assets";
import type { Building, CityInput, CityModel, Decoration, GroundKind } from "@/core/model";
import { hash53, repoStream } from "@/core/random";
import { GENERATOR_VERSION } from "@/core/version";
import { VILLAGE_MAX_REPOS, buildingTraits, createBuilding, designOf, modelOf } from "./buildings";
import { StreetGrid } from "./grid";
import { sortRepos } from "./order";
import { MAIN_STREET_BLOCK, packBuildings } from "./packing";
import { isParkBlock, parkBlock } from "./parks";
import {
  GROUND_MARGIN,
  connectRoads,
  decorateFree,
  dirtAround,
  distanceFrom,
  downtownRadius,
  fillGround,
  inGrove,
  inMeadow,
  ringOf,
  roadAlong,
  uniqueRoads,
  wildness,
} from "./surroundings";

/** About one building in eight keeps a one-tile garden beside it. */
const GAP_CHANCE = 8;
/** Drawings are not repeated within this many tiles, models not right next door. */
const DESIGN_RADIUS = 8;
const MODEL_RADIUS = 3;
/** Downtown pavement reaches this many tiles from a building, within its block. */
const PAVED_REACH = 2;

/**
 * CityInput + AssetCatalog → CityModel (ARCHITECTURE.md §6.1). Pure and
 * deterministic: the same input and catalog always give a deep-equal model.
 *
 * Buildings stand side by side along the streets of blocks of varied sizes; now
 * and then a block is a park. `aggregates` is always empty for now.
 */
export function generateCity(input: CityInput, catalog: AssetCatalog): CityModel {
  const owner = input.owner;
  const repos = sortRepos(input.repos);
  const grid = new StreetGrid(owner);
  const village = repos.length <= VILLAGE_MAX_REPOS;
  const traits = repos.map((repo) =>
    buildingTraits(repo, repoStream(owner, repo.id, "building"), village),
  );
  const { placements, blocks } = packBuildings(
    grid,
    traits.map((t, i) => ({
      footprint: t.footprint,
      gap: hash53(`${owner}:gap:${repos[i]!.id}`) % GAP_CHANCE === 0,
    })),
    (k) => isParkBlock(owner, k),
  );

  // Buildings in placement order, each steering away from its neighbours' drawings.
  const buildings: Building[] = [];
  const looks: { design: string; model: string }[] = [];
  repos.forEach((repo, i) => {
    const p = placements[i]!;
    const f = traits[i]!.footprint;
    // Tiles between two footprints: 0 when they touch.
    const gap = (b: Building) =>
      Math.max(
        0,
        b.origin.x - (p.origin.x + f),
        p.origin.x - (b.origin.x + b.footprint),
        b.origin.y - (p.origin.y + f),
        p.origin.y - (b.origin.y + b.footprint),
      );
    const designs = new Map<string, number>();
    const models = new Map<string, number>();
    for (const [j, b] of buildings.entries()) {
      const g = gap(b);
      if (g >= DESIGN_RADIUS) continue;
      const { design, model } = looks[j]!;
      if (g < DESIGN_RADIUS) designs.set(design, Math.min(g, designs.get(design) ?? g));
      if (g < MODEL_RADIUS) models.set(model, Math.min(g, models.get(model) ?? g));
    }
    // The closer a repeat, the worse: the same drawing counts double the same model.
    const penalty = (id: string) => {
      const d = designs.get(designOf(id));
      const m = models.get(modelOf(id));
      return (
        (d === undefined ? 0 : 2 * (DESIGN_RADIUS - d)) + (m === undefined ? 0 : MODEL_RADIUS - m)
      );
    };
    const building = createBuilding(owner, repo, traits[i]!, p, catalog, (m) => penalty(m.id));
    buildings.push(building);
    looks.push({ design: designOf(building.manifestId), model: modelOf(building.manifestId) });
  });

  // A full block is closed by roads all round. A block still filling up only has
  // road along the sides where it has buildings, so a small town is a street and
  // not a ring of asphalt. Then the pieces are joined into one network along the
  // block edges, so no street is left hanging on its own.
  const used = blocks.filter((b) => b.buildings > 0);
  // A park shows once the spiral has grown past it. The main street block fills
  // early, out of spiral order, so it does not count.
  const last = Math.max(
    -1,
    ...used.filter((b) => b.index !== MAIN_STREET_BLOCK).map((b) => b.index),
  );
  const parks = blocks
    .filter((b) => b.index < last && isParkBlock(owner, b.index))
    .map((b) => ({ rect: b.rect, layout: parkBlock(owner, b.rect, b.index) }));
  const sides = [0, 1, 2, 3] as const;
  const pieces = [
    ...used.flatMap((b) => {
      const full = !b.hasRoom();
      return sides.filter((s) => full || b.usedSides.has(s)).flatMap((s) => roadAlong(b.rect, s));
    }),
    ...parks.flatMap((p) => sides.flatMap((s) => roadAlong(p.rect, s))),
  ];
  const edges = [...used.map((b) => b.rect), ...parks.map((p) => p.rect)].flatMap((r) =>
    sides.flatMap((s) => roadAlong(r, s)),
  );
  const roads = uniqueRoads(connectRoads(pieces, edges));

  // Bounds: everything built, plus a margin of countryside.
  const xs: number[] = [];
  const ys: number[] = [];
  for (const r of roads) {
    xs.push(r.x);
    ys.push(r.y);
  }
  for (const b of buildings) {
    xs.push(b.origin.x, b.origin.x + b.footprint - 1);
    ys.push(b.origin.y, b.origin.y + b.footprint - 1);
  }
  const margin = village ? GROUND_MARGIN + 1 : GROUND_MARGIN;
  const bounds =
    xs.length === 0
      ? { minX: -margin, minY: -margin, maxX: margin - 1, maxY: margin - 1 }
      : {
          minX: Math.min(...xs) - margin,
          minY: Math.min(...ys) - margin,
          maxX: Math.max(...xs) + margin,
          maxY: Math.max(...ys) + margin,
        };

  // Ground kinds and the tiles nothing stands on.
  const kinds = new Map<string, GroundKind>();
  const blocked = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;
  for (const r of roads) blocked.add(key(r.x, r.y));
  for (const b of buildings)
    for (let dx = 0; dx < b.footprint; dx++)
      for (let dy = 0; dy < b.footprint; dy++) blocked.add(key(b.origin.x + dx, b.origin.y + dy));
  for (const p of parks) {
    for (const t of p.layout.water) kinds.set(key(t.x, t.y), "water");
    for (const t of p.layout.pavement) kinds.set(key(t.x, t.y), "pavement");
  }
  for (const b of buildings)
    for (const t of dirtAround(b)) if (!kinds.has(key(t.x, t.y))) kinds.set(key(t.x, t.y), "dirt");

  const parkDecorations: Decoration[] = parks.flatMap((p) => p.layout.decorations);
  for (const d of parkDecorations) blocked.add(key(d.x, d.y));
  const inPark = new Set<string>();
  for (const p of parks)
    for (let dx = 0; dx < p.rect.w; dx++)
      for (let dy = 0; dy < p.rect.h; dy++) inPark.add(key(p.rect.x + dx, p.rect.y + dy));
  const gardens = new Set(used.flatMap((b) => b.gardens.map((t) => key(t.x, t.y))));
  const inBlock = new Set<string>();
  for (const b of used)
    for (let dx = 0; dx < b.rect.w; dx++)
      for (let dy = 0; dy < b.rect.h; dy++) inBlock.add(key(b.rect.x + dx, b.rect.y + dy));
  // Downtown: around the buildings of the blocks nearest the center the ground is
  // paved, like the dense core of a city builder, while the suburbs keep their
  // gardens and groves. A block still filling up keeps its empty part green.
  const radius = downtownRadius(repos.length, village);
  const downtown = new Set<string>();
  const byIndex = new Map(blocks.map((b) => [b.index, b]));
  buildings.forEach((b, i) => {
    const space = byIndex.get(placements[i]!.blockIndex)!;
    // Both sides of the main street belong to downtown.
    const ring = space.index === MAIN_STREET_BLOCK ? 0 : ringOf(space.rect.block);
    if (ring > radius) return;
    for (let dx = -PAVED_REACH; dx < b.footprint + PAVED_REACH; dx++)
      for (let dy = -PAVED_REACH; dy < b.footprint + PAVED_REACH; dy++) {
        const x = b.origin.x + dx;
        const y = b.origin.y + dy;
        if (space.inside(x, y)) downtown.add(key(x, y));
      }
  });

  // The countryside grows wilder away from anything built: woods close in at the
  // edge, with a shaded floor under them, and lighter meadows in the open grass.
  const built = new Set([...blocked, ...inPark]);
  const distance = distanceFrom(built, bounds);
  const groves: NonNullable<Parameters<typeof inGrove>[4]> = new Map();
  const meadows: NonNullable<Parameters<typeof inMeadow>[3]> = new Map();
  const free: Parameters<typeof decorateFree>[1][number][] = [];
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const k = key(x, y);
      if (blocked.has(k) || inPark.has(k) || kinds.get(k) === "water") continue;
      const garden = gardens.has(k);
      if (downtown.has(k) && kinds.get(k) !== "dirt") {
        if (!kinds.has(k)) kinds.set(k, "pavement");
        free.push({ x, y, garden, dirt: false, density: 0, wild: 0, downtown: true });
        continue;
      }
      // Land nothing is built on yet, in a block or out of town, goes back to the woods.
      const wild = garden ? 0 : wildness(owner, x, y, distance.get(k) ?? 0);
      // Fewer groves inside blocks (backyards) than in the countryside.
      const density = inBlock.has(k) ? 8 : village ? 24 : 14;
      if (!kinds.has(k)) {
        if (wild >= 50 || (!garden && inGrove(owner, x, y, density, groves)))
          kinds.set(k, "forest");
        else if (!garden && inMeadow(owner, x, y, meadows)) kinds.set(k, "meadow");
      }
      free.push({ x, y, garden, dirt: kinds.get(k) === "dirt", density, wild });
    }
  }
  const decorations = [...parkDecorations, ...decorateFree(owner, free)];
  const ground = fillGround(owner, bounds, kinds);

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
