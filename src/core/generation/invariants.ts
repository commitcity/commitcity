import type { CityModel } from "@/core/model";

export interface Collision {
  x: number;
  y: number;
  occupants: string[];
}

/**
 * Tiles claimed by more than one occupant (building, road, or decoration). Must
 * always be empty (ARCHITECTURE.md §6.8); tests check every fixture.
 */
export function findCollisions(model: CityModel): Collision[] {
  const owners = new Map<string, string[]>();
  const claim = (x: number, y: number, occupant: string) => {
    const key = `${x},${y}`;
    const list = owners.get(key);
    if (list) list.push(occupant);
    else owners.set(key, [occupant]);
  };

  for (const b of model.buildings) {
    for (let dx = 0; dx < b.footprint; dx++) {
      for (let dy = 0; dy < b.footprint; dy++)
        claim(b.origin.x + dx, b.origin.y + dy, `building ${b.repoId}`);
    }
  }
  for (const r of model.roads) claim(r.x, r.y, "road");
  for (const d of model.decorations) claim(d.x, d.y, `${d.kind} of ${d.repoId}`);

  const collisions: Collision[] = [];
  for (const [key, occupants] of owners) {
    if (occupants.length < 2) continue;
    const [x, y] = key.split(",").map(Number) as [number, number];
    collisions.push({ x, y, occupants });
  }
  return collisions;
}
