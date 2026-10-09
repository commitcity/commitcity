// Interface art: panels, buttons, text field, banner and cursors (ART_DIRECTION.md §16).
// Nine-slice images are drawn at 1x; CSS scales them by whole pixels. Run: pnpm art
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Canvas, type Hex } from "./kit";

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

const files: Record<string, Canvas> = {
  "panel-wood.png": woodPanel(),
  "panel-parchment.png": parchmentPanel(),
  "field.png": textField(false),
  "field-focus.png": textField(true),
  "banner-red.png": banner(),
  "cursor-hand.png": cursor(gauntlet(0)),
  "cursor-hand-press.png": cursor(gauntlet(4)),
  "cursor-fist.png": cursor(gauntlet(11)),
};
for (const [name, { idle, hover }] of Object.entries(BUTTONS)) {
  files[`button-${name}.png`] = button(idle, false);
  files[`button-${name}-hover.png`] = button(hover, false);
  files[`button-${name}-pressed.png`] = button(idle, true);
}

mkdirSync(OUT, { recursive: true });
for (const old of readdirSync(OUT)) if (old.endsWith(".png")) rmSync(join(OUT, old));
for (const [name, canvas] of Object.entries(files)) canvas.writePng(join(OUT, name));
console.log(`✓ Drew ${Object.keys(files).length} interface images in ${OUT}`);
