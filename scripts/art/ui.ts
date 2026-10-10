// Interface art: panels, buttons, text field, banner and cursors (ART_DIRECTION.md §16).
// Nine-slice images are drawn at 1x; CSS scales them by whole pixels. Run: pnpm art
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Canvas, type Hex, noise } from "./kit";

const OUT = join("assets", "ui");

/** Interface materials from Resurrect 64, darkest first. */
const INK = "2e222f";
const WOOD = ["45293f", "6e2727", "7a3045", "9e4539", "cd683d", "e6904e"] as const;
const PAPER = ["694f62", "966c6c", "ab947a", "fca790", "fdcbb0"] as const;
const IRON = ["3e3546", "625565", "9babb2", "c7dcd0"] as const;
const GOLD = ["9e4539", "f79617", "f9c22b", "fbff86"] as const;
const CLOTH = ["6e2727", "ae2334", "e83b3b"] as const;

type Side = "top" | "left" | "bottom" | "right";

/** Distance to the nearest edge, and which edge; ties go to top and left. */
function edge(x: number, y: number, w: number, h: number): { d: number; side: Side } {
  const sides: [number, Side][] = [
    [y, "top"],
    [x, "left"],
    [h - 1 - y, "bottom"],
    [w - 1 - x, "right"],
  ];
  const [d, side] = sides.reduce((a, b) => (b[0] < a[0] ? b : a));
  return { d, side };
}

const lit = (side: Side) => side === "top" || side === "left";

/** True for the pixels cut off to round a rectangle's corners. */
function cornerCut(x: number, y: number, w: number, h: number, radius: number): boolean {
  const cx = Math.min(x, w - 1 - x);
  const cy = Math.min(y, h - 1 - y);
  return cx + cy < radius;
}

/**
 * Wooden frame with iron corner plates around dark planks. Slice 8, 24 × 24:
 * the edges repeat along their length and the planks fill the middle.
 */
function woodPanel(): Canvas {
  const S = 24;
  const c = new Canvas(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (cornerCut(x, y, S, S, 1)) continue;
      const { d, side } = edge(x, y, S, S);
      const along = side === "top" || side === "bottom" ? x : y;
      let color: Hex;
      if (d === 0) color = INK;
      else if (d <= 5) {
        const grain = d === 3 && along % 8 === 5;
        if (lit(side)) color = d === 1 ? WOOD[5] : d === 5 ? WOOD[3] : grain ? WOOD[3] : WOOD[4];
        else color = d === 1 ? WOOD[1] : d === 5 ? WOOD[2] : grain ? WOOD[2] : WOOD[3];
      } else if (d === 6) color = INK;
      else {
        // Planks: a seam every 8 rows, a darker row under the frame.
        const seam = y % 8 === 3;
        color = d === 7 && lit(side) ? WOOD[0] : seam ? WOOD[0] : WOOD[1];
      }
      c.set(x, y, color);
    }
  // Iron plates with a rivet over each corner of the frame.
  for (const [fx, fy] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ] as const)
    for (let j = 0; j < 6; j++)
      for (let i = 0; i < 6; i++) {
        const x = fx ? S - 1 - i : i;
        const y = fy ? S - 1 - j : j;
        if (i === 0 || j === 0) continue;
        const border = i === 1 || j === 1 || i === 5 || j === 5;
        const rivet = i === 3 && j === 3;
        c.set(x, y, border ? IRON[0] : rivet ? IRON[3] : i + j <= 5 ? IRON[2] : IRON[1]);
      }
  return c;
}

/** Parchment with a darker, slightly ragged edge. Slice 8, 24 × 24. */
function parchmentPanel(): Canvas {
  const S = 24;
  const c = new Canvas(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (cornerCut(x, y, S, S, 2)) continue;
      const { d, side } = edge(x, y, S, S);
      const along = side === "top" || side === "bottom" ? x : y;
      // A worn spot on the rim once along each 8 px segment.
      const worn = along % 8 === 5;
      let color: Hex;
      if (d === 0) color = PAPER[0];
      else if (d === 1) color = worn ? PAPER[1] : PAPER[2];
      else if (d === 2) color = lit(side) ? PAPER[4] : PAPER[3];
      else color = PAPER[4];
      c.set(x, y, color);
    }
  return c;
}

interface ButtonColors {
  light: Hex;
  face: Hex;
  shade: Hex;
  lip: Hex;
}

const BUTTONS: Record<string, { idle: ButtonColors; hover: ButtonColors }> = {
  wood: {
    idle: { light: WOOD[4], face: WOOD[3], shade: WOOD[2], lip: WOOD[0] },
    hover: { light: WOOD[5], face: WOOD[4], shade: WOOD[3], lip: WOOD[0] },
  },
  gold: {
    idle: { light: GOLD[3], face: GOLD[2], shade: GOLD[1], lip: GOLD[0] },
    hover: { light: "ffffff", face: GOLD[3], shade: GOLD[2], lip: GOLD[0] },
  },
};

/**
 * A raised button, 18 × 18, slice 6. The pressed state sits 2 px lower and
 * loses its lip, so the face looks pushed in.
 */
function button(colors: ButtonColors, pressed: boolean): Canvas {
  const S = 18;
  const c = new Canvas(S, S);
  const top = pressed ? 2 : 0;
  const lipRows = pressed ? 0 : 2;
  const bottom = S - 1;
  for (let y = top; y <= bottom; y++)
    for (let x = 0; x < S; x++) {
      const cx = Math.min(x, S - 1 - x);
      const cy = Math.min(y - top, bottom - y);
      if (cx === 0 && cy === 0) continue;
      let color: Hex;
      if (x === 0 || x === S - 1 || y === top || y === bottom) color = INK;
      else if (y > bottom - 1 - lipRows) color = colors.lip;
      else if (y === bottom - 1 - lipRows || x === S - 2) color = colors.shade;
      else if (y === top + 1 || x === 1) color = colors.light;
      else color = colors.face;
      c.set(x, y, color);
    }
  return c;
}

/** A sunken parchment text field, 18 × 18, slice 6. Focus swaps the ink rim for gold. */
function textField(focused: boolean): Canvas {
  const S = 18;
  const c = new Canvas(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (cornerCut(x, y, S, S, 1)) continue;
      const { d, side } = edge(x, y, S, S);
      let color: Hex;
      if (d === 0) color = focused ? GOLD[1] : INK;
      else if (d === 1) color = focused ? GOLD[2] : lit(side) ? PAPER[1] : PAPER[3];
      else if (d === 2 && lit(side)) color = PAPER[3];
      else color = PAPER[4];
      c.set(x, y, color);
    }
  return c;
}

/**
 * A red cloth banner with notched tails folded behind it, 48 × 20. Slice:
 * 4 top, 14 right, 8 bottom, 14 left; the middle stretches sideways.
 */
function banner(): Canvas {
  const W = 48;
  const H = 20;
  const c = new Canvas(W, H);
  const tail = (x: number, y: number) => {
    // A V notch, deepest at the middle row of the tail.
    const notch = Math.max(0, 3 - Math.floor(Math.abs(y - 11.5)));
    if (x < notch) return;
    const rim = x === notch || y === 6 || y === 17 || x === 10;
    c.set(x, y, rim ? INK : CLOTH[0]);
  };
  for (let y = 6; y < 18; y++)
    for (let x = 0; x <= 10; x++) {
      tail(x, y);
      tail(W - 1 - x, y);
    }
  // The fold, where each tail goes behind the band.
  for (let y = 14; y < 18; y++)
    for (let x = 7; x <= 10; x++)
      if (x - 7 >= y - 14) {
        c.set(x, y, y === 17 ? INK : "45293f");
        c.set(W - 1 - x, y, y === 17 ? INK : "45293f");
      }
  for (let y = 2; y <= 13; y++)
    for (let x = 6; x < W - 6; x++) {
      const rim = y === 2 || y === 13 || x === 6 || x === W - 7;
      c.set(
        x,
        y,
        rim ? INK : y === 3 ? CLOTH[2] : y === 12 ? CLOTH[0] : x === 7 ? CLOTH[2] : CLOTH[1],
      );
    }
  return c;
}

/**
 * Cursor pixels: o ink; 1-4 iron, dark to light; e f g the cuff's iron, light
 * to dark; d and c its gold rim; x the dark opening of the cuff.
 */
const CURSOR_COLORS: Record<string, Hex> = {
  o: INK,
  x: INK,
  "1": IRON[0],
  "2": IRON[1],
  "3": IRON[2],
  "4": IRON[3],
  e: IRON[2],
  f: IRON[1],
  g: IRON[0],
  d: GOLD[3],
  c: GOLD[2],
};

/**
 * An iron gauntlet seen in three-quarter view, pointing up and to the left:
 * index finger out, the other fingers curled, thumb underneath. The cuff is
 * added by `gauntlet`, which also outlines the shape.
 */
const GAUNTLET_HAND = [
  "......................",
  ".oo...................",
  "o44o..................",
  "o343o.................",
  ".o343o................",
  "..o343o.ooo...........",
  "...o343oo332o.........",
  "....o3432o3332oo......",
  "...oo23432o3332o2o....",
  "..o32o23332o3322o2o...",
  ".o3332o23322o222o1o...",
  ".o33332o2222222221o...",
  "..o3332o222222211o....",
  "...oo332o22222111o....",
  ".....oo2o2222111o.....",
  ".......o22221111o.....",
  "........o221111o......",
  ".........oo11oo.......",
  "......................",
  "......................",
  "......................",
  "......................",
];

/**
 * The gauntlet, with the index finger cut back to diagonal `reach` (0 keeps it
 * whole): 4 bends it while clicking, 11 curls it into the fist for dragging.
 */
function gauntlet(reach: number): string[] {
  const N = GAUNTLET_HAND.length;
  const g = GAUNTLET_HAND.map((row) => [...row]);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) if (x + y <= reach && Math.abs(x - y) <= 2) g[y]![x] = ".";
  // Drop outline pixels the cut left with nothing to outline.
  const filled = (x: number, y: number) => !".o".includes(g[y]?.[x] ?? ".");
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
      if (
        g[y]![x] === "o" &&
        ![-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => filled(x + dx, y + dy)))
      )
        g[y]![x] = ".";
  // The cuff: a band across the wrist, flaring a little toward its open end.
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const along = x + y;
      const across = x - y;
      if (along < 28 || along > 36 || Math.abs(across) > 4.5 + (along - 28) * 0.12) continue;
      g[y]![x] =
        along === 28
          ? "d"
          : along === 29
            ? "c"
            : along >= 35
              ? "x"
              : across > 1.5
                ? "e"
                : across < -2.5
                  ? "g"
                  : "f";
    }
  // Outline the silhouette and the seam where the hand meets the cuff.
  const at = (x: number, y: number) => g[y]?.[x] ?? ".";
  return g.map((row, y) =>
    row
      .map((ch, x) => {
        const near = [at(x + 1, y), at(x, y + 1), at(x - 1, y), at(x, y - 1)];
        if (ch === "." && near.some((n) => n !== "." && n !== "o")) return "o";
        if ("1234".includes(ch) && near.some((n) => "cdefgx".includes(n))) return "o";
        return ch;
      })
      .join(""),
  );
}

/** Draws a cursor grid at 2x: browsers show cursor images at their CSS pixel size. */
function cursor(rows: readonly string[]): Canvas {
  const scale = 2;
  const c = new Canvas(rows[0]!.length * scale, rows.length * scale);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const color = CURSOR_COLORS[ch];
      if (color) c.rect(x * scale, y * scale, scale, scale, color);
    }),
  );
  return c;
}

/** Purple leather for the book, darkest first. */
const LEATHER = ["45293f", "6b3e75", "905ea9", "a884f3"] as const;

/** Book sizes, in art pixels: the open spread, and one board (the closed cover). */
const BOOK_W = 248;
const BOOK_H = 168;
const BOARD_W = BOOK_W / 2;
const BOARD_H = 160;

/** Leather with a sparse grain, a lit top-left rim and a dark bottom-right rim. */
function leather(c: Canvas, x0: number, y0: number, w: number, h: number, seed: string) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const { d, side } = edge(x - x0, y - y0, w, h);
      if (cornerCut(x - x0, y - y0, w, h, 3)) continue;
      let color: Hex = LEATHER[1];
      if (d === 0) color = INK;
      else if (d === 1) color = lit(side) ? LEATHER[2] : LEATHER[0];
      else if (noise(seed, x, y) < 0.03) color = LEATHER[0];
      else if (noise(seed, "hi", x, y) < 0.012) color = LEATHER[2];
      c.set(x, y, color);
    }
}

/**
 * A small isometric building: a 2:1 diamond roof over two walls, with rows of
 * lit windows. `top` is the roof's top pixel.
 */
function tower(c: Canvas, cx: number, top: number, w: number, wall: number) {
  const half = w / 2;
  for (let x = 0; x < w; x++) {
    const t = Math.ceil((x < half ? half - 1 - x : x - half) / 2);
    for (let y = t; y < half - t + wall; y++) {
      const roof = y < half - t;
      const left = x < half;
      const outline = y === t || y === half - t + wall - 1 || x === 0 || x === w - 1;
      c.set(cx - half + x, top + y, outline ? INK : roof ? GOLD[3] : left ? GOLD[2] : GOLD[1]);
    }
  }
  // Windows: one column on each wall, a row every 4 pixels, following the slope.
  for (let row = half + 2; row < half + wall - 4; row += 4)
    for (const x of [Math.floor(half / 2), w - 1 - Math.floor(half / 2)]) {
      const t = Math.ceil((x < half ? half - 1 - x : x - half) / 2);
      c.rect(cx - half + x, top + row - t + 1, 1, 2, x < half ? GOLD[0] : "fbb954");
    }
}

/** Gem colors set in the medallion's ring, each dark, base, light. */
const GEMS: [Hex, Hex, Hex][] = [
  ["ae2334", "e83b3b", "f68181"],
  ["0b8a8f", "30e1b9", "8ff8e2"],
  ["4d65b4", "4d9be6", "8fd3ff"],
  ["f79617", "f9c22b", "fbff86"],
  ["239063", "1ebc73", "91db69"],
  ["c32454", "f04f78", "ed8099"],
  ["9e4539", "fb6b1d", "fbb954"],
  ["7f708a", "c7dcd0", "ffffff"],
];

/**
 * The cover's round medallion: a gold rim, a ring set with gems, and a small
 * skyline of gold towers in the middle, the city's emblem.
 */
function medallion(c: Canvas, cx: number, cy: number) {
  const R = 40;
  for (let y = cy - R; y <= cy + R; y++)
    for (let x = cx - R; x <= cx + R; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) continue;
      const upperLeft = dx + dy < 0;
      let color: Hex;
      if (d > R - 1.2) color = INK;
      else if (d > R - 3.6) color = upperLeft ? GOLD[3] : GOLD[1];
      else if (d > R - 4.6) color = INK;
      else if (d > 25.4) color = upperLeft ? LEATHER[2] : (x + y) % 2 ? LEATHER[2] : LEATHER[1];
      else if (d > 24.4) color = INK;
      else if (d > 22.6) color = upperLeft ? GOLD[2] : GOLD[1];
      else color = d > 21.6 ? LEATHER[0] : INK;
      c.set(x, y, color);
    }
  // Gems around the ring, each a small diamond with a glint.
  GEMS.forEach(([dark, base, light], i) => {
    const a = (i / GEMS.length) * Math.PI * 2 - Math.PI / 2;
    const gx = Math.round(cx - 0.5 + Math.cos(a) * 30.5);
    const gy = Math.round(cy - 0.5 + Math.sin(a) * 30.5);
    for (let j = -4; j <= 4; j++)
      for (let i2 = -4; i2 <= 4; i2++) {
        const m = Math.abs(i2) + Math.abs(j);
        if (m > 4) continue;
        const color = m === 4 ? INK : i2 + j < 0 ? light : i2 + j > 1 ? dark : base;
        c.set(gx + i2, gy + j, color);
      }
    c.set(gx - 1, gy - 1, "ffffff");
  });
  // The skyline: a tall tower behind two short ones.
  tower(c, cx, cy - 19, 14, 20);
  tower(c, cx - 10, cy - 3, 12, 10);
  tower(c, cx + 10, cy - 1, 12, 8);
}

/** An iron corner plate: a quarter disc with rivets, mirrored to any corner. */
function cornerPlate(c: Canvas, x0: number, y0: number, fx: 1 | -1, fy: 1 | -1) {
  const R = 22;
  for (let j = 0; j < R; j++)
    for (let i = 0; i < R; i++) {
      const d = Math.hypot(i + 0.5, j + 0.5);
      if (d > R) continue;
      let color: Hex = IRON[2];
      if (d > R - 1.2 || i === 0 || j === 0) color = INK;
      else if (d > R - 3) color = IRON[1];
      else if (i === 1 || j === 1) color = IRON[3];
      c.set(x0 + fx * i, y0 + fy * j, color);
    }
  for (const [i, j] of [
    [5, 5],
    [14, 4],
    [4, 14],
  ] as const) {
    c.set(x0 + fx * i, y0 + fy * j, INK);
    c.set(x0 + fx * (i + 1), y0 + fy * j, IRON[3]);
    c.set(x0 + fx * i, y0 + fy * (j + 1), IRON[1]);
  }
}

/** Board size on the cover; the rest shows the edges of the pages. */
const FRONT_W = BOARD_W - 8;
const FRONT_H = BOARD_H - 8;

/**
 * The closed book, cartoon style: a purple board with iron corners and a gem
 * medallion, over a thick block of pages and the back board. The title and
 * subtitle are HTML. The spine is on the left.
 */
function bookCover(): Canvas {
  const c = new Canvas(BOARD_W, BOARD_H);
  // The back board, and the block of pages between it and the front board.
  leather(c, 3, 3, BOARD_W - 3, BOARD_H - 3, "back");
  for (let y = 4; y < BOARD_H - 3; y++)
    for (let x = 4; x < BOARD_W - 3; x++) {
      const right = x >= FRONT_W;
      const line = right ? (x - FRONT_W) % 2 === 1 : (y - FRONT_H) % 2 === 1;
      const rim = x === BOARD_W - 4 || y === BOARD_H - 4;
      c.set(x, y, rim ? PAPER[1] : line ? PAPER[2] : PAPER[4]);
    }
  leather(c, 0, 0, FRONT_W, FRONT_H, "cover");
  // Spine: a darker strip with raised bands.
  for (let y = 3; y < FRONT_H - 3; y++)
    for (let x = 1; x < 8; x++) {
      const band = [18, 52, 96, 130].some((b) => y >= b && y < b + 5);
      let color: Hex = x === 7 ? INK : LEATHER[0];
      if (band && x < 7) color = y % 5 === 0 || x === 1 ? LEATHER[2] : LEATHER[1];
      c.set(x, y, color);
    }
  // A few scuffs on the leather.
  for (const [x, y, n] of [
    [86, 132, 6],
    [90, 130, 5],
    [22, 118, 4],
    [96, 22, 4],
  ] as const)
    for (let k = 0; k < n; k++) c.set(x + k, y - Math.floor(k / 2), LEATHER[2]);
  cornerPlate(c, 0, 0, 1, 1);
  cornerPlate(c, FRONT_W - 1, 0, -1, 1);
  cornerPlate(c, 0, FRONT_H - 1, 1, -1);
  cornerPlate(c, FRONT_W - 1, FRONT_H - 1, -1, -1);
  medallion(c, Math.round(FRONT_W / 2) + 4, 82);
  return c;
}

/** Ribbon colors, dark and light. */
const RIBBONS: [Hex, Hex][] = [
  [CLOTH[1], CLOTH[2]],
  ["fb6b1d", "fbb954"],
  ["239063", "1ebc73"],
];

/**
 * The open book: both boards, a stack of page edges, two pages that dip into
 * the gutter, and a ribbon. The spine is at x = 124.
 */
function bookOpen(): Canvas {
  const c = new Canvas(BOOK_W, BOOK_H);
  leather(c, 0, 0, BOOK_W, BOARD_H, "open");
  const spine = BOOK_W / 2;
  // Page edges under the top pages, seen along the bottom and the outer sides.
  const edges = [PAPER[0], PAPER[2], PAPER[4], PAPER[2]];
  edges.forEach((color, i) => {
    const k = 3 - i;
    for (let y = 4; y < 150 + k; y++)
      for (let x = 6 - k; x < BOOK_W - 6 + k; x++) c.set(x, y, color);
  });
  // The top pages: shading toward the gutter, a crease at the spine.
  for (let y = 4; y < 150; y++)
    for (let x = 6; x < BOOK_W - 6; x++) {
      const gutter = Math.abs(x + 0.5 - spine);
      let color: Hex = PAPER[4];
      if (gutter < 1) color = PAPER[1];
      else if (gutter < 3) color = PAPER[2];
      else if (gutter < 7) color = (x + y) % 2 ? PAPER[3] : PAPER[4];
      else if (gutter < 12 && (x + y) % 4 === 0) color = PAPER[3];
      if (x === 6 || x === BOOK_W - 7 || y === 4 || y === 149) color = PAPER[1];
      c.set(x, y, color);
    }
  // Three ribbon bookmarks hanging below the right page.
  RIBBONS.forEach(([dark, light], i) => {
    const x0 = spine + 14 + i * 9;
    const end = BOOK_H - 1 - (i % 2) * 2;
    for (let y = 146; y <= end; y++)
      for (let x = x0; x < x0 + 5; x++) {
        if (y >= end - 1 && x === x0 + 2) continue;
        const rim = x === x0 || x === x0 + 4 || y === end;
        c.set(x, y, rim ? INK : x === x0 + 1 ? light : dark);
      }
  });
  return c;
}

/** One half of the open book, the back of the cover while it turns. */
function bookHalf(open: Canvas, right: boolean): Canvas {
  const c = new Canvas(BOARD_W, BOARD_H);
  for (let y = 0; y < BOARD_H; y++)
    for (let x = 0; x < BOARD_W; x++) {
      const color = open.get(x + (right ? BOARD_W : 0), y);
      if (color) c.set(x, y, color);
    }
  return c;
}

/** Symbols for icon buttons, 10 × 10: `x` is a stroke. */
const ICONS: Record<string, string[]> = {
  plus: [
    "..........",
    "....xx....",
    "....xx....",
    "....xx....",
    ".xxxxxxxx.",
    ".xxxxxxxx.",
    "....xx....",
    "....xx....",
    "....xx....",
    "..........",
  ],
  minus: [
    "..........",
    "..........",
    "..........",
    "..........",
    ".xxxxxxxx.",
    ".xxxxxxxx.",
    "..........",
    "..........",
    "..........",
    "..........",
  ],
  close: [
    "..........",
    ".xx....xx.",
    ".xxx..xxx.",
    "..xxxxxx..",
    "...xxxx...",
    "...xxxx...",
    "..xxxxxx..",
    ".xxx..xxx.",
    ".xx....xx.",
    "..........",
  ],
  "rotate-right": [
    "..xxxx....",
    ".xxxxxx...",
    "xx....xx..",
    "xx.....xx.",
    "xx...xxxxx",
    "xx....xxx.",
    "xx.....x..",
    "xx........",
    ".xxxx.....",
    "..xxxx....",
  ],
};
ICONS["sound-on"] = [
  "....x.....",
  "...xx...x.",
  "..xxx.x..x",
  "xxxxx..x.x",
  "xxxxx..x.x",
  "xxxxx..x.x",
  "xxxxx..x.x",
  "..xxx.x..x",
  "...xx...x.",
  "....x.....",
];
ICONS["sound-off"] = [
  "....x.....",
  "...xx.....",
  "..xxx.....",
  "xxxxx.x..x",
  "xxxxx..xx.",
  "xxxxx..xx.",
  "xxxxx.x..x",
  "..xxx.....",
  "...xx.....",
  "....x.....",
];
ICONS["rotate-left"] = ICONS["rotate-right"]!.map((row) => [...row].reverse().join(""));

/** An icon in parchment with a one-pixel ink shadow below, like button text. */
function icon(rows: readonly string[]): Canvas {
  const c = new Canvas(10, 11);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== "x") return;
      if (rows[y + 1]?.[x] !== "x") c.set(x, y + 1, INK);
    }),
  );
  rows.forEach((row, y) => [...row].forEach((ch, x) => ch === "x" && c.set(x, y, PAPER[4])));
  return c;
}

/** The nail that pins a note to the screen: a round iron head with a glint. */
function nail(): Canvas {
  const c = new Canvas(8, 8);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const d = Math.hypot(x - 3.5, y - 3.5);
      if (d > 3.8) continue;
      const upperLeft = x + y < 7;
      c.set(x, y, d > 2.8 ? INK : upperLeft ? IRON[2] : IRON[1]);
    }
  c.set(2, 2, IRON[3]);
  c.set(3, 2, IRON[3]);
  c.set(2, 3, IRON[3]);
  return c;
}

const open = bookOpen();
const files: Record<string, Canvas> = {
  "book-open.png": open,
  "book-cover.png": bookCover(),
  "book-left.png": bookHalf(open, false),
  "panel-wood.png": woodPanel(),
  "panel-parchment.png": parchmentPanel(),
  "field.png": textField(false),
  "field-focus.png": textField(true),
  "banner-red.png": banner(),
  "cursor-hand.png": cursor(gauntlet(0)),
  "cursor-hand-press.png": cursor(gauntlet(4)),
  "cursor-fist.png": cursor(gauntlet(11)),
  "nail.png": nail(),
};
for (const [name, rows] of Object.entries(ICONS)) files[`icon-${name}.png`] = icon(rows);
for (const [name, { idle, hover }] of Object.entries(BUTTONS)) {
  files[`button-${name}.png`] = button(idle, false);
  files[`button-${name}-hover.png`] = button(hover, false);
  files[`button-${name}-pressed.png`] = button(idle, true);
}

mkdirSync(OUT, { recursive: true });
for (const old of readdirSync(OUT)) if (old.endsWith(".png")) rmSync(join(OUT, old));
for (const [name, canvas] of Object.entries(files)) canvas.writePng(join(OUT, name));
console.log(`✓ Drew ${Object.keys(files).length} interface images in ${OUT}`);
