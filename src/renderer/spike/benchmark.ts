import type { SpikeBuilding, SpikeScene } from "./scene";

const BLOCK = 9; // 2 × 2 lots of 4 × 4 tiles plus a 1-tile road (ARCHITECTURE.md §6.2)
const LOT = 4;

/**
 * About 90 × 90 tiles with `count` placeholder buildings on the lot grid.
 * Deterministic, so screenshots and measurements are comparable between runs.
 */
export function createBenchmarkScene(count = 300, blocks = 10): SpikeScene {
  const size = blocks * BLOCK;
  const roads: [number, number][] = [];
  for (let a = 0; a < size; a++) {
    for (let b = 0; b < size; b++) {
      if (a % BLOCK === BLOCK - 1 || b % BLOCK === BLOCK - 1) roads.push([a, b]);
    }
  }

  const buildings: SpikeBuilding[] = [];
  let lot = 0;
  outer: for (let bx = 0; bx < blocks; bx++) {
    for (let by = 0; by < blocks; by++) {
      for (let lx = 0; lx < 2; lx++) {
        for (let ly = 0; ly < 2; ly++) {
          if (buildings.length >= count) break outer;
          const h = hash(lot++);
          const size = 1 + (h % 4);
          const offset = (h >>> 2) % (LOT - size + 1);
          buildings.push({
            id: `b${lot}`,
            x: bx * BLOCK + lx * LOT + offset,
            y: by * BLOCK + ly * LOT + ((h >>> 4) % (LOT - size + 1)),
            size,
            storeys: 1 + ((h >>> 6) % (size * 3)),
          });
        }
      }
    }
  }
  return { name: "benchmark", size, roads, buildings };
}

function hash(n: number): number {
  let h = (n + 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
