// Ground, road and vegetation art (ART_DIRECTION.md §10). Run: pnpm art
import { join } from "node:path";
import { DECORATION_VARIANT_COUNT, GROUND_VARIANT_COUNT } from "../../src/core/assets";
import {
  COLORS,
  CREDITS,
  Canvas,
  type Hex,
  RAMPS,
  eachDiamondPixel,
  noise,
  writeFolder,
} from "./kit";
import { type Material, box, cylinder, dome, render } from "./solids";

const W = 32;
const H = 16;

type GroundArt = "grass" | "meadow" | "forest" | "dirt" | "pavement";

/** Every texture variant of a ground kind shares its base color, so tiles meet without seams. */
function ground(kind: GroundArt, variant: number): Canvas {
  const c = new Canvas(W, H);
  const n = (...p: (string | number)[]) => noise("ground", kind, variant, ...p);
  if (kind === "grass") {
    const [dark, base, mid, light] = RAMPS.foliage;
    eachDiamondPixel(W, (x, y) => c.set(x, y, base));
    // Tufts: a lighter blade with a dark root, a few per tile.
    for (let i = 0; i < 7; i++) {
      const x = 4 + Math.floor(n("tuft-x", i) * 24);
      const y = 3 + Math.floor(n("tuft-y", i) * 10);
      c.paint(x, y, mid);
      c.paint(x + 1, y - 1, mid);
      c.paint(x, y + 1, dark);
    }
    for (let i = 0; i < 3; i++)
      c.paint(4 + Math.floor(n("dot-x", i) * 24), 3 + Math.floor(n("dot-y", i) * 10), light);
  } else if (kind === "meadow" || kind === "forest") {
    // Lighter meadow or shaded forest floor: the grass's own base colour at the tile
    // edge, fading into the patch's tone toward the middle, so neighbouring grass
    // tiles blend in instead of meeting at a hard step.
    const [dark, base, mid, light, seed] = RAMPS.foliage;
    const tone = kind === "meadow" ? mid : dark;
    eachDiamondPixel(W, (x, y, { top, bottom }) => {
      const d = Math.min(y - top, bottom - y);
      const p = 0.75 * Math.min(1, d / 3);
      c.set(x, y, n("tone", x, y) < p ? tone : base);
    });
    for (let i = 0; i < 6; i++) {
      const x = 6 + Math.floor(n("tuft-x", i) * 20);
      const y = 4 + Math.floor(n("tuft-y", i) * 8);
      if (kind === "meadow") {
        c.paint(x, y, light);
        c.paint(x + 1, y - 1, light);
      } else {
        c.paint(x, y, i % 3 ? base : RAMPS.dirt[0]);
      }
    }
    if (kind === "meadow")
      for (let i = 0; i < 3; i++)
        c.paint(6 + Math.floor(n("dot-x", i) * 20), 4 + Math.floor(n("dot-y", i) * 8), seed);
  } else if (kind === "dirt") {
    const [dark, shadow, base, light] = RAMPS.dirt;
    eachDiamondPixel(W, (x, y) => c.set(x, y, base));
    for (let i = 0; i < 10; i++) {
      const x = 3 + Math.floor(n("speck-x", i) * 26);
      const y = 2 + Math.floor(n("speck-y", i) * 12);
      c.paint(x, y, shadow);
      c.paint(x + 1, y, shadow);
    }
    for (let i = 0; i < 3; i++) {
      const x = 5 + Math.floor(n("pebble-x", i) * 22);
      const y = 4 + Math.floor(n("pebble-y", i) * 8);
      c.paint(x, y, light);
      c.paint(x, y + 1, dark);
    }
  } else {
    // Paving slabs: joints on the 2:1 grid repeat every half tile, so they line up across tiles.
    eachDiamondPixel(W, (x, y) => {
      const joint = (x + 2 * y) % 16 === 0 || (((x - 2 * y) % 16) + 16) % 16 === 0;
      c.set(x, y, joint ? COLORS.sidewalkJoint : COLORS.sidewalk);
    });
    for (let i = 0; i < 4; i++)
      c.paint(4 + Math.floor(n("x", i) * 24), 3 + Math.floor(n("y", i) * 10), COLORS.curb);
  }
  return c;
}

/**
 * One road shape. Mask bits name the neighbors in view space: 1 = +x (lower right
 * edge), 2 = +y (lower left), 4 = -x (upper left), 8 = -y (upper right). Sides
 * without a neighbor get a sidewalk and a curb; lane dashes run toward the others
 * and line up across tiles (dashes sit at tile edges, gaps at tile centers).
 */
function road(mask: number): Canvas {
  const c = new Canvas(W, H);
  const has = (side: number) => (mask & (1 << side)) !== 0;
  const [, asphalt, speck] = RAMPS.asphalt;
  eachDiamondPixel(W, (x, y, { top, bottom }) => {
    const right = x >= W / 2;
    const fromTop = y - top;
    const fromBottom = bottom - y;
    const edge = (side: number, d: number) => !has(side) && d <= 2;
    const topSide = right ? 3 : 2;
    const bottomSide = right ? 0 : 1;
    const d = edge(topSide, fromTop) ? fromTop : edge(bottomSide, fromBottom) ? fromBottom : -1;
    if (d === -1) c.set(x, y, noise("road", x, y) < 0.08 ? speck : asphalt);
    else if (d === 2) c.set(x, y, COLORS.curb);
    else c.set(x, y, (x + y) % 6 === 0 ? COLORS.sidewalkJoint : COLORS.sidewalk);
  });
  const directions: [side: number, dx: number, dy: number][] = [
    [0, 1, 1],
    [1, -1, 1],
    [2, -1, -1],
    [3, 1, -1],
  ];
  for (const [side, dx, dy] of directions) {
    if (!has(side)) continue;
    for (let t = 4; t < 8; t++) {
      const x = dx > 0 ? W / 2 + t : W / 2 - 1 - t;
      const y = dy > 0 ? H / 2 + Math.floor(t / 2) : H / 2 - 1 - Math.floor(t / 2);
      c.set(x, y, COLORS.lane);
    }
  }
  return c;
}

/**
 * One water shape. Mask bits as for roads: sides without water get a shore that
 * fades from the grass at the tile edge through wet sand to deep water; the open
 * water carries a few ripples that never touch the edges, so tiles join cleanly.
 */
function water(mask: number): Canvas {
  const c = new Canvas(W, H);
  const has = (side: number) => (mask & (1 << side)) !== 0;
  const [deep, body, ripple, sparkle] = ["323353", "4d65b4", "4d9be6", "8fd3ff"];
  eachDiamondPixel(W, (x, y, { top, bottom }) => {
    const right = x >= W / 2;
    const fromTop = y - top;
    const fromBottom = bottom - y;
    const shore = (side: number, d: number) => (has(side) ? Infinity : d);
    const d = Math.min(shore(right ? 3 : 2, fromTop), shore(right ? 0 : 1, fromBottom));
    let color: Hex;
    if (d === 0) color = RAMPS.foliage[1];
    else if (d === 1) color = RAMPS.sand[3];
    else if (d === 2) color = RAMPS.sand[2];
    else if (d === 3) color = deep;
    else {
      const n = noise("water", mask, x, y);
      color = n < 0.05 && x % 2 === 0 ? ripple : n < 0.06 ? sparkle : body;
    }
    c.set(x, y, color);
  });
  // A ripple line or two, well inside the tile.
  for (let i = 0; i < 2; i++) {
    const x = 10 + Math.floor(noise("ripple-x", mask, i) * 10);
    const y = 6 + Math.floor(noise("ripple-y", mask, i) * 4);
    for (let k = 0; k < 3; k++) if (c.get(x + k, y) === body) c.set(x + k, y, ripple);
  }
  return c;
}

const STONE: Material = { ramp: ["625565", "7f708a", "9babb2", "c7dcd0"] };
const POOL: Material = { ramp: ["323353", "4d65b4", "4d9be6", "8fd3ff"] };
const WOOD: Material = { ramp: ["45293f", "6e2727", "9e4539", "cd683d"] };
const IRON: Material = { ramp: ["2e222f", "3e3546", "484a77", "625565"] };

/** Park props drawn as solids on one tile: fountains, benches and lamps. */
function prop(kind: string, variant: number): Canvas {
  const c = new Canvas(W, 80);
  if (kind === "fountain") {
    const r = 6 + variant;
    render(c, 1, [
      { solid: cylinder(8, 8, r, 0, 3), material: STONE },
      { solid: cylinder(8, 8, r - 1.2, 0, 3.01), material: POOL, flat: true },
      { solid: cylinder(8, 8, 1, 3, 9 + variant * 2), material: STONE },
      { solid: cylinder(8, 8, 2.5, 8 + variant * 2, 9 + variant * 2), material: STONE },
      ...(variant === 2 ? [{ solid: dome(8, 8, 11, 1.5), material: STONE }] : []),
    ]);
    // Spray falling from the top bowl, lit on the left.
    const top = c.height - 8 - 9 - variant * 2;
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      const x = W / 2 + i * 2 - (i > 0 ? 1 : 0);
      for (let k = 0; k < 3 + Math.abs(i); k++)
        c.set(x, top - 2 + k + Math.abs(i), i < 0 ? "8fd3ff" : "4d9be6");
    }
  } else if (kind === "bench") {
    // Variants: along the tile's u axis, along v, or a pair facing each other.
    const seats =
      variant === 0
        ? [[3, 9, 13, 11, "u"]]
        : variant === 1
          ? [[9, 3, 11, 13, "v"]]
          : [
              [3, 4, 13, 6, "u"],
              [3, 11, 13, 13, "u"],
            ];
    const parts = seats.flatMap(([u0, v0, u1, v1, axis]) => {
      const a = axis === "u";
      return [
        { solid: box(+u0!, +v0!, 2, +u1!, +v1!, 3), material: WOOD },
        {
          solid: a
            ? box(+u0!, +v0!, 3, +u1!, +v0! + 0.6, 6)
            : box(+u0!, +v0!, 3, +u0! + 0.6, +v1!, 6),
          material: WOOD,
        },
        { solid: box(+u0!, +v0!, 0, +u0! + 1, +v0! + 1, 2), material: IRON },
        { solid: box(+u1! - 1, +v1! - 1, 0, +u1!, +v1!, 2), material: IRON },
      ];
    });
    render(c, 1, parts);
  } else {
    // Lamp posts: one, two heads, or a short garden lamp.
    const h = variant === 2 ? 8 : 18;
    render(c, 1, [
      { solid: cylinder(8, 8, 1.6, 0, 2), material: IRON },
      { solid: cylinder(8, 8, 0.7, 2, h), material: IRON },
      ...(variant === 1
        ? [
            { solid: box(5, 7.5, h - 1, 11, 8.5, h), material: IRON },
            {
              solid: box(4.5, 7, h - 4, 6, 9, h - 1),
              material: { ramp: ["f79617", "f9c22b", "fbb954", "fbff86"] },
            },
            {
              solid: box(10, 7, h - 4, 11.5, 9, h - 1),
              material: { ramp: ["f79617", "f9c22b", "fbb954", "fbff86"] },
            },
          ]
        : [
            {
              solid: box(7, 7, h, 9, 9, h + 3),
              material: { ramp: ["f79617", "f9c22b", "fbb954", "fbff86"] },
            },
            { solid: box(6.5, 6.5, h + 3, 9.5, 9.5, h + 4), material: IRON },
          ]),
    ]);
  }
  return c.cropTop(H);
}

/** A shaded ellipse lit from the upper left, with a darkest-tone outline. */
function blob(
  c: Canvas,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  ramp: readonly Hex[],
  seed: string,
) {
  const [outline, shadow, base, light, highlight] = ramp;
  const inside = (x: number, y: number) =>
    ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      const lit = -(x + 0.5 - cx) / rx - (y + 0.5 - cy) / ry + (noise(seed, x, y) - 0.5) * 0.5;
      let color =
        lit > 0.7 && highlight ? highlight : lit > 0.25 ? light! : lit > -0.45 ? base! : shadow!;
      if (edge) color = lit > 0.6 ? shadow! : outline!;
      c.set(x, y, color);
    }
  }
}

/**
 * A crown made of overlapping ellipses, shaded as one shape lit from the upper
 * left, with the outline only on its outer edge so the lobes do not read as
 * stacked pieces.
 */
function crown(
  c: Canvas,
  lobes: readonly (readonly [number, number, number, number])[],
  ramp: readonly Hex[],
  seed: string,
) {
  const [outline, shadow, base, light, highlight] = ramp;
  const inside = (x: number, y: number) =>
    lobes.some(([cx, cy, rx, ry]) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1);
  const x0 = Math.min(...lobes.map(([cx, , rx]) => cx - rx));
  const x1 = Math.max(...lobes.map(([cx, , rx]) => cx + rx));
  const y0 = Math.min(...lobes.map(([, cy, , ry]) => cy - ry));
  const y1 = Math.max(...lobes.map(([, cy, , ry]) => cy + ry));
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  for (let y = Math.floor(y0); y <= y1; y++) {
    for (let x = Math.floor(x0); x <= x1; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      // Each lobe is lit on its own upper left, and the whole crown darkens to the lower right.
      const lobe = lobes.find(
        ([cx, cy, rx, ry]) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1,
      )!;
      const own = -(x + 0.5 - lobe[0]) / lobe[2] - (y + 0.5 - lobe[1]) / lobe[3];
      const whole = (-(x + 0.5 - mx) / (x1 - x0) - (y + 0.5 - my) / (y1 - y0)) * 2;
      const lit = own * 0.45 + whole * 0.75 + (noise(seed, x, y) - 0.5) * 0.5;
      let color =
        lit > 0.75 && highlight ? highlight : lit > 0.25 ? light! : lit > -0.4 ? base! : shadow!;
      if (edge) color = lit > 0.6 ? shadow! : outline!;
      c.set(x, y, color);
    }
  }
}

/** A small flat shadow on the ground under a plant, inside its tile. */
function groundShadow(c: Canvas, cx: number, groundY: number, rx: number) {
  for (let x = -rx; x < rx; x++) {
    const h = Math.abs(x + 0.5) < rx - 2 ? 1 : 0;
    for (let y = -h; y <= h; y++) c.set(cx + x, groundY + y, RAMPS.foliage[0]);
  }
}

function trunk(c: Canvas, cx: number, groundY: number, height: number, light: Hex, dark: Hex) {
  for (let y = groundY - height; y <= groundY; y++) {
    c.set(cx - 1, y, light);
    c.set(cx, y, dark);
  }
}

/** Blossom ramps, outline first: pink ipê, jacaranda, yellow ipê. */
const BLOSSOMS: readonly (readonly Hex[])[] = [
  ["753c54", "a24b6f", "cf657f", "ed8099", "eaaded"],
  ["45293f", "6b3e75", "905ea9", "a884f3", "eaaded"],
  ["9e4539", "f79617", "f9c22b", "fbff86"],
];

function vegetation(kind: string, variant: number): Canvas {
  const c = new Canvas(W, 80);
  const cx = W / 2;
  const groundY = c.height - H / 2;
  const seed = `${kind}:${variant}`;
  switch (kind) {
    case "tree":
      if (variant === 0) {
        // Round broadleaf.
        groundShadow(c, cx, groundY, 7);
        trunk(c, cx, groundY, 9, COLORS.barkLight, COLORS.bark);
        blob(c, cx, groundY - 15, 8, 8, RAMPS.foliage, seed);
        blob(c, cx - 3, groundY - 19, 5, 4, RAMPS.foliage.slice(1), seed + "top");
      } else if (variant === 1) {
        // Conifer: three tiers, lit side on the left.
        groundShadow(c, cx, groundY, 6);
        trunk(c, cx, groundY, 4, COLORS.barkLight, COLORS.bark);
        const tiers = [
          { y: groundY - 4, half: 7, h: 8 },
          { y: groundY - 10, half: 6, h: 8 },
          { y: groundY - 16, half: 4, h: 8 },
        ];
        for (const { y: base, half, h } of tiers) {
          for (let r = 0; r < h; r++) {
            const span = Math.round((half * (r + 1)) / h);
            for (let x = -span; x < span; x++) {
              const edge = x === -span || x === span - 1 || r === h - 1;
              const color = edge ? RAMPS.foliage[0] : x < 0 ? RAMPS.foliage[2] : RAMPS.foliage[1];
              c.set(cx + x, base - h + 1 + r, color);
            }
          }
        }
        c.set(cx - 1, groundY - 23, RAMPS.foliage[0]);
        c.set(cx, groundY - 23, RAMPS.foliage[0]);
      } else {
        // Slender poplar with a pale trunk.
        groundShadow(c, cx, groundY, 5);
        trunk(c, cx, groundY, 8, COLORS.birch, RAMPS.concrete[3]);
        c.set(cx - 1, groundY - 3, RAMPS.concrete[1]);
        c.set(cx, groundY - 6, RAMPS.concrete[1]);
        blob(c, cx, groundY - 17, 5, 11, RAMPS.foliage.slice(0, 4), seed);
      }
      break;
    case "blossom": {
      // A flowering tree (ipê, jacaranda, cherry): a wide, airy crown of
      // blossoms over a forked trunk, with a few leaves showing in the shade.
      const ramp = BLOSSOMS[variant]!;
      groundShadow(c, cx, groundY, 8);
      trunk(c, cx, groundY, 8, COLORS.barkLight, COLORS.bark);
      for (let t = 1; t <= 3; t++) {
        c.set(cx - 1 - t, groundY - 7 - t, COLORS.barkLight);
        c.set(cx + t, groundY - 7 - t, COLORS.bark);
      }
      crown(
        c,
        [
          [cx - 5, groundY - 13, 5, 4],
          [cx + 5, groundY - 13, 5, 4],
          [cx - 2, groundY - 18, 6, 4],
          [cx + 3, groundY - 19, 4, 3],
          [cx, groundY - 14, 6, 4],
        ],
        ramp,
        seed,
      );
      for (let i = 0; i < 6; i++) {
        const x = cx - 7 + Math.floor(noise(seed, "leaf-x", i) * 14);
        const y = groundY - 16 + Math.floor(noise(seed, "leaf-y", i) * 7);
        if (c.get(x, y) && x >= cx - 2) c.set(x, y, RAMPS.foliage[1]);
      }
      // Fallen petals around the trunk.
      for (let i = 0; i < 5; i++)
        c.set(
          cx - 6 + Math.floor(noise(seed, "petal-x", i) * 12),
          groundY - 1 + Math.floor(noise(seed, "petal-y", i) * 3),
          ramp[3]!,
        );
      break;
    }
    case "bush": {
      const r = 3 + variant;
      groundShadow(c, cx, groundY, r + 1);
      blob(c, cx, groundY - r + 1, r + 1, r, RAMPS.foliage.slice(0, 4), seed);
      break;
    }
    case "flowers": {
      const colors = [COLORS.flowerPink, COLORS.flowerYellow, COLORS.flowerViolet];
      for (let i = 0; i < 7; i++) {
        const x = cx - 7 + Math.floor(noise(seed, "x", i) * 14);
        const y = groundY - 2 + Math.floor(noise(seed, "y", i) * 5);
        c.set(x, y + 1, RAMPS.foliage[0]);
        c.set(x, y, RAMPS.foliage[2]);
        c.set(x, y - 1, i % 3 === 0 ? COLORS.flowerWhite : colors[variant]!);
      }
      break;
    }
    case "weeds":
      for (let i = 0; i < 5; i++) {
        const x = cx - 6 + Math.floor(noise(seed, "x", i) * 12);
        const y = groundY - 1 + Math.floor(noise(seed, "y", i) * 4);
        const h = 2 + Math.floor(noise(seed, "h", i) * 3);
        for (let j = 0; j < h; j++)
          c.set(
            x + (j === h - 1 ? (i % 2 ? 1 : -1) : 0),
            y - j,
            j === 0 ? RAMPS.dry[1] : RAMPS.dry[2],
          );
      }
      break;
    case "dead-tree": {
      trunk(c, cx, groundY, 14, COLORS.deadWood, COLORS.deadWoodDark);
      const branches = [
        [-1, 10, -1],
        [0, 7, 1],
        [-1, 13, 1],
      ];
      branches.forEach(([offset, at, dir], i) => {
        const length = 3 + ((variant + i) % 3);
        for (let t = 1; t <= length; t++)
          c.set(
            cx + offset! + dir! * t,
            groundY - at! - Math.floor(t / 2),
            i % 2 ? COLORS.deadWoodDark : COLORS.deadWood,
          );
      });
      break;
    }
  }
  return c.cropTop(H);
}

const root = "assets";
for (const kind of ["grass", "meadow", "forest", "dirt", "pavement"] as const) {
  const files: Record<string, Canvas> = {};
  for (let v = 0; v < GROUND_VARIANT_COUNT; v++) files[`variant-${v}.png`] = ground(kind, v);
  writeFolder({
    dir: join(root, "ground", kind),
    manifest: { id: kind, kind: "ground", ...CREDITS },
    files,
  });
}
{
  const files: Record<string, Canvas> = {};
  for (let mask = 0; mask < 16; mask++) files[`mask-${mask}.png`] = road(mask);
  writeFolder({
    dir: join(root, "roads", "street"),
    manifest: { id: "street", kind: "road", ...CREDITS },
    files,
  });
}
{
  const files: Record<string, Canvas> = {};
  for (let mask = 0; mask < 16; mask++) files[`mask-${mask}.png`] = water(mask);
  writeFolder({
    dir: join(root, "water", "water"),
    manifest: { id: "water", kind: "water", ...CREDITS },
    files,
  });
}
for (const kind of [
  "tree",
  "blossom",
  "bush",
  "flowers",
  "weeds",
  "dead-tree",
  "fountain",
  "bench",
  "lamp",
]) {
  const files: Record<string, Canvas> = {};
  const props = ["fountain", "bench", "lamp"];
  for (let v = 0; v < DECORATION_VARIANT_COUNT; v++)
    files[`variant-${v}.png`] = props.includes(kind) ? prop(kind, v) : vegetation(kind, v);
  writeFolder({
    dir: join(root, "vegetation", kind),
    manifest: { id: kind, kind: "vegetation", ...CREDITS },
    files,
  });
}
console.log("✓ Drew ground, roads, water, vegetation and props");
