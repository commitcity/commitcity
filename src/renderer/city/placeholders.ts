import type { Texture } from "pixi.js";
import type { AssetCatalog, Family } from "@/core/assets";
import { type HitMask, type TileSize, parseBuildingKey } from "@/core/view";
import { Pixels, type Rgb, diamondTop } from "../pixels";

// Code-drawn placeholders for a generated city (ART_DIRECTION.md §13): 2:1 edges,
// light from the upper left (roof lightest, left wall medium, right wall darkest),
// one color scheme per building family, and bottom-center anchors. Every texture
// key from the render list resolves to a texture, so nothing ever disappears.

/** Storey height at the 32 × 16 tile size (ART_DIRECTION.md §3). */
const STOREY = 8;

interface Scheme {
  roof: Rgb;
  left: Rgb;
  right: Rgb;
  window: Rgb;
}

const FAMILY_SCHEMES: Record<Family, Scheme> = {
  residential: {
    roof: [176, 82, 62],
    left: [222, 198, 160],
    right: [178, 154, 120],
    window: [90, 120, 150],
  },
  brick: {
    roof: [128, 118, 108],
    left: [168, 84, 58],
    right: [122, 58, 42],
    window: [240, 214, 140],
  },
  modern: {
    roof: [210, 220, 228],
    left: [96, 150, 196],
    right: [62, 104, 146],
    window: [200, 232, 250],
  },
  industrial: {
    roof: [118, 122, 126],
    left: [150, 152, 150],
    right: [104, 106, 106],
    window: [70, 76, 82],
  },
  civic: {
    roof: [92, 152, 136],
    left: [236, 232, 220],
    right: [190, 184, 170],
    window: [120, 150, 170],
  },
};

const GROUND: Record<string, Rgb> = {
  grass: [86, 140, 72],
  dirt: [140, 110, 74],
  pavement: [150, 150, 146],
};

const ASPHALT: Rgb = [84, 86, 96];
const CURB: Rgb = [172, 172, 164];
const LANE: Rgb = [226, 200, 96];

interface Entry {
  texture: Texture;
  mask: HitMask;
}

export class CityPlaceholders {
  private readonly entries = new Map<string, Entry>();
  private readonly families = new Map<string, { family: Family; footprint: number }>();

  constructor(
    catalog: AssetCatalog,
    private readonly tile: TileSize,
  ) {
    for (const m of catalog.buildings)
      this.families.set(m.id, { family: m.family, footprint: m.footprint });
  }

  texture(textureKey: string): Texture {
    return this.entry(textureKey).texture;
  }

  /** Opaque pixels of the texture, for hit testing. */
  mask(textureKey: string): HitMask {
    return this.entry(textureKey).mask;
  }

  destroy() {
    for (const { texture } of this.entries.values()) texture.destroy(true);
    this.entries.clear();
  }

  private entry(textureKey: string): Entry {
    let entry = this.entries.get(textureKey);
    if (!entry) {
      const pixels = this.draw(textureKey);
      entry = { texture: pixels.toTexture(), mask: pixels.mask() };
      this.entries.set(textureKey, entry);
    }
    return entry;
  }

  private get unit(): number {
    return this.tile.width / 32;
  }

  private draw(key: string): Pixels {
    const [kind, a, b] = key.split("/");
    if (kind === "ground") return this.ground(a ?? "grass", Number(b));
    if (kind === "road") return this.road(Number(a));
    if (kind === "decoration") return this.decoration(a ?? "tree", Number(b));
    const building = parseBuildingKey(key);
    const manifest = building && this.families.get(building.manifestId);
    if (building && manifest) {
      return this.building(
        manifest.family,
        manifest.footprint,
        building.level,
        building.variant === "abandoned",
      );
    }
    // Unknown key: a magenta box makes the bug visible without breaking the scene.
    return this.box(1, 2 * STOREY * this.unit, {
      roof: [255, 0, 255],
      left: [200, 0, 200],
      right: [140, 0, 140],
      window: [0, 0, 0],
    });
  }

  private building(family: Family, footprint: number, level: number, abandoned: boolean): Pixels {
    let scheme = FAMILY_SCHEMES[family];
    if (abandoned) {
      const fade = (c: Rgb): Rgb => [
        Math.round(c[0] * 0.45 + 70),
        Math.round(c[1] * 0.45 + 66),
        Math.round(c[2] * 0.45 + 60),
      ];
      scheme = {
        roof: fade(scheme.roof),
        left: fade(scheme.left),
        right: fade(scheme.right),
        window: [36, 36, 40],
      };
    }
    const storeys = Math.max(1, level * footprint);
    return this.box(footprint, storeys * STOREY * this.unit, scheme);
  }

  /** A 2:1 box with a roof, two shaded walls, and rows of windows per storey. */
  private box(footprint: number, heightPx: number, scheme: Scheme): Pixels {
    const u = this.unit;
    const width = footprint * this.tile.width;
    const depth = footprint * this.tile.height;
    const pixels = new Pixels(width, depth + heightPx);
    const roofEdge: Rgb = [scheme.roof[0] * 0.8, scheme.roof[1] * 0.8, scheme.roof[2] * 0.8].map(
      Math.round,
    ) as unknown as Rgb;
    for (let x = 0; x < width; x++) {
      const top = diamondTop(x, width);
      const bottom = depth - top;
      for (let y = top; y < bottom; y++)
        pixels.set(x, y, y === top || y === bottom - 1 ? roofEdge : scheme.roof);

      const isLeft = x < width / 2;
      const wall = isLeft ? scheme.left : scheme.right;
      const fromEdge = isLeft ? x : width - 1 - x;
      for (let row = 0; row < heightPx; row++) {
        const inStorey = Math.floor(row / u) % STOREY;
        const window =
          inStorey >= 2 &&
          inStorey <= 4 &&
          [1, 2].includes(Math.floor(fromEdge / u) % 4) &&
          fromEdge >= u;
        pixels.set(x, bottom + row, window ? scheme.window : wall);
      }
    }
    return pixels;
  }

  private ground(kind: string, variant: number): Pixels {
    const base = GROUND[kind] ?? GROUND.grass!;
    const shift = (variant % 4) * 3 - 4;
    const fill: Rgb = [base[0] + shift, base[1] + shift, base[2] + shift];
    const speck: Rgb = [base[0] + 14, base[1] + 14, base[2] + 10];
    const edge: Rgb = [base[0] - 14, base[1] - 14, base[2] - 12];
    const { width, height } = this.tile;
    const pixels = new Pixels(width, height);
    for (let x = 0; x < width; x++) {
      const top = diamondTop(x, width);
      const bottom = height - top;
      for (let y = top; y < bottom; y++) {
        const speckled = (x * 7 + y * 13 + variant * 5) % 23 === 0;
        pixels.set(x, y, y === bottom - 1 ? edge : speckled ? speck : fill);
      }
    }
    return pixels;
  }

  /**
   * Asphalt with a curb on every side that has no road neighbor and a dashed lane
   * line toward every side that has one. Mask bits: 1 = +x, 2 = +y, 4 = -x, 8 = -y.
   */
  private road(mask: number): Pixels {
    const { width, height } = this.tile;
    const u = this.unit;
    const pixels = new Pixels(width, height);
    const has = (side: number) => (mask & (1 << side)) !== 0;
    for (let x = 0; x < width; x++) {
      const top = diamondTop(x, width);
      const bottom = height - top;
      const right = x >= width / 2;
      for (let y = top; y < bottom; y++) {
        // Top edges face -x (left half) and -y (right half); bottom edges face +y and +x.
        const curb =
          (y === top && !has(right ? 3 : 2)) || (y === bottom - 1 && !has(right ? 0 : 1));
        pixels.set(x, y, curb ? CURB : ASPHALT);
      }
    }
    const cx = width / 2;
    const cy = height / 2;
    const reach = width / 4;
    const directions: [number, number, number][] = [
      [0, 1, 1],
      [1, -1, 1],
      [2, -1, -1],
      [3, 1, -1],
    ];
    for (const [side, dx, dy] of directions) {
      if (!has(side)) continue;
      for (let t = 0; t < reach; t++) {
        if (Math.floor(t / (2 * u)) % 2 === 1) continue;
        const x = dx > 0 ? cx + t : cx - 1 - t;
        const y = dy > 0 ? cy + Math.floor(t / 2) : cy - 1 - Math.floor(t / 2);
        pixels.set(x, y, LANE);
      }
    }
    return pixels;
  }

  /** Small props on one tile, anchored like buildings: bottom-center at the front vertex. */
  private decoration(kind: string, variant: number): Pixels {
    const u = this.unit;
    const { width, height } = this.tile;
    const extra = 22 * u;
    const pixels = new Pixels(width, height + extra);
    const cx = width / 2;
    const groundY = extra + height / 2;

    const disc = (ox: number, oy: number, r: number, dark: Rgb, light: Rgb) => {
      for (let y = Math.floor(oy - r); y <= oy + r; y++) {
        for (let x = Math.floor(ox - r); x <= ox + r; x++) {
          const dx = x - ox;
          const dy = y - oy;
          if (dx * dx + dy * dy <= r * r) pixels.set(x, y, dx + dy < -r / 2 ? light : dark);
        }
      }
    };
    const trunk = (h: number, color: Rgb) => {
      for (let y = groundY - h; y < groundY; y++)
        for (let x = cx - u; x < cx + u; x++) pixels.set(x, y, color);
    };

    switch (kind) {
      case "tree": {
        const r = (4 + (variant % 3)) * u;
        trunk(6 * u, [96, 66, 44]);
        disc(cx, groundY - 6 * u - r + u, r, [56, 118, 58], [86, 150, 70]);
        break;
      }
      case "bush":
        disc(cx, groundY - 2 * u, (2 + (variant % 2)) * u, [62, 124, 60], [92, 156, 78]);
        break;
      case "flowers": {
        const colors: Rgb[] = [
          [220, 90, 110],
          [240, 210, 90],
          [210, 150, 220],
        ];
        for (let i = 0; i < 5; i++) {
          const x = cx + ((i * 5 + variant * 3) % 11) * u - 5 * u;
          const y = groundY + ((i * 3) % 5) * u - 2 * u;
          pixels.set(x, y, colors[(i + variant) % 3]!);
          pixels.set(x, y + u, [62, 118, 56]);
        }
        break;
      }
      case "weeds":
        for (let i = 0; i < 4; i++) {
          const x = cx + ((i * 4 + variant * 2) % 9) * u - 4 * u;
          for (let h = 0; h < 2 + (i % 2); h++) pixels.set(x, groundY - h * u, [120, 118, 70]);
        }
        break;
      case "dead-tree":
        trunk(10 * u, [104, 92, 80]);
        for (let i = 1; i <= 3 * u; i++) {
          pixels.set(cx - u - i, groundY - 8 * u - i, [104, 92, 80]);
          pixels.set(cx + i, groundY - 6 * u - i, [104, 92, 80]);
        }
        break;
      default:
        disc(cx, groundY - 2 * u, 2 * u, [200, 0, 200], [255, 0, 255]);
    }
    return pixels;
  }
}
