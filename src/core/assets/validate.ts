import { type BuildingManifest, FAMILIES, type Variant, type View } from "./manifest";

// Rules for artist-made assets (ART_DIRECTION.md §4, §6, §8, §12). Pure: the
// scripts read files and PNGs, then hand the data here, so every rule is unit
// tested. Messages say what is wrong and what to do, for contributors who never
// read this code.

/** Base tile size (ART_DIRECTION.md §3). */
const TILE_WIDTH = 32;
const TILE_HEIGHT = 16;
/** Building height is rounded up to a multiple of this (§4.2). */
const HEIGHT_STEP = 4;
/** How far a building may draw below its footprint's lower edges (§4.1). */
const OVERHANG = 2;

export const ASSET_LICENSE = "CC-BY-SA-4.0";

const VARIANTS: readonly Variant[] = ["default", "abandoned"];
const LEVELS = [1, 2, 3];
const MANIFEST_KEYS = [
  "id",
  "family",
  "footprint",
  "levels",
  "views",
  "symmetric",
  "variants",
  "authors",
  "license",
  "aiAssisted",
] as const;
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** An RGBA image, 4 bytes per pixel, row-major. */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

/** Reads a `.hex` palette (one `rrggbb` per line) into a set of 0xRRGGBB values. */
export function parsePalette(text: string): Set<number> {
  const colors = new Set<number>();
  for (const [i, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line) continue;
    if (!/^#?[0-9a-fA-F]{6}$/.test(line)) throw new Error(`palette line ${i + 1}: "${line}"`);
    colors.add(parseInt(line.replace("#", ""), 16));
  }
  return colors;
}

/** `view-0.png` for the default variant, `view-0.abandoned.png` for the others. */
export function spriteFileName(view: View, variant: Variant): string {
  return variant === "default" ? `view-${view}.png` : `view-${view}.${variant}.png`;
}

/** Every PNG a manifest promises. A symmetric building draws only view 0 (§8). */
export function spriteFiles(
  manifest: BuildingManifest,
): { file: string; view: View; variant: Variant }[] {
  const views: View[] = manifest.symmetric ? [0] : manifest.views;
  return views.flatMap((view) =>
    manifest.variants.map((variant) => ({ file: spriteFileName(view, variant), view, variant })),
  );
}

/**
 * Checks a parsed `manifest.json` against the schema (ARCHITECTURE.md §4.2) and
 * returns it typed, or null with the problems found. `folder` is the building's
 * folder name, which must equal its id.
 */
export function parseManifest(
  value: unknown,
  folder: string,
): { manifest: BuildingManifest | null; problems: string[] } {
  const problems: string[] = [];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { manifest: null, problems: ["manifest.json must contain a JSON object"] };
  }
  const m = value as Record<string, unknown>;
  for (const key of MANIFEST_KEYS) {
    if (!(key in m)) problems.push(`missing field "${key}"`);
  }
  for (const key of Object.keys(m)) {
    if (!(MANIFEST_KEYS as readonly string[]).includes(key))
      problems.push(`unknown field "${key}" (allowed: ${MANIFEST_KEYS.join(", ")})`);
  }
  const has = (key: string) => key in m;

  if (has("id")) {
    if (typeof m.id !== "string" || !ID_PATTERN.test(m.id))
      problems.push(`"id" must be lowercase words joined by dashes, like "brick-office-small"`);
    else if (m.id !== folder) problems.push(`"id" is "${m.id}" but the folder is "${folder}"`);
    else if (m.id.startsWith("placeholder-"))
      problems.push(`"id" must not start with "placeholder-" (reserved for code-drawn boxes)`);
  }
  if (has("family") && !FAMILIES.includes(m.family as never))
    problems.push(`"family" must be one of ${FAMILIES.join(", ")}`);
  if (has("footprint") && ![1, 2, 3, 4].includes(m.footprint as number))
    problems.push(`"footprint" must be 1, 2, 3 or 4 (tiles per side)`);
  if (has("levels") && !isSet(m.levels, (v) => LEVELS.includes(v as number)))
    problems.push(`"levels" must be a non-empty list of distinct levels from 1 to 3`);
  if (has("views")) {
    if (!isSet(m.views, (v) => [0, 1, 2, 3].includes(v as number)))
      problems.push(`"views" must be a non-empty list of distinct views from 0 to 3`);
    else if (!(m.views as number[]).includes(0)) problems.push(`"views" must include view 0`);
  }
  if (has("symmetric") && typeof m.symmetric !== "boolean")
    problems.push(`"symmetric" must be true or false`);
  if (has("variants")) {
    if (!isSet(m.variants, (v) => VARIANTS.includes(v as Variant)))
      problems.push(`"variants" must be a non-empty list from: ${VARIANTS.join(", ")}`);
    else if (!(m.variants as string[]).includes("default"))
      problems.push(`"variants" must include "default"`);
  }
  if (
    has("authors") &&
    !(
      Array.isArray(m.authors) &&
      m.authors.length > 0 &&
      m.authors.every((a) => typeof a === "string" && a.trim() !== "")
    )
  )
    problems.push(`"authors" must be a non-empty list of names`);
  if (has("license") && m.license !== ASSET_LICENSE)
    problems.push(`"license" must be "${ASSET_LICENSE}" (see ASSETS_LICENSE)`);
  if (has("aiAssisted") && typeof m.aiAssisted !== "boolean")
    problems.push(`"aiAssisted" must be true or false (ART_DIRECTION.md §14.4)`);

  if (problems.length > 0) return { manifest: null, problems };
  const manifest = m as unknown as BuildingManifest;
  return {
    manifest: {
      ...manifest,
      levels: [...manifest.levels].sort((a, b) => a - b),
      views: [...manifest.views].sort((a, b) => a - b),
    },
    problems,
  };
}

/** The PNG files a folder must and must not contain, given its manifest. */
export function checkFolderFiles(manifest: BuildingManifest, files: readonly string[]): string[] {
  const problems: string[] = [];
  const expected = new Set(spriteFiles(manifest).map((s) => s.file));
  for (const file of expected) {
    if (!files.includes(file)) problems.push(`${file} is missing (the manifest declares it)`);
  }
  for (const file of files) {
    if (file === "manifest.json") continue;
    if (!expected.has(file))
      problems.push(
        `${file} is not declared by the manifest (expected files: ${[...expected].join(", ")})`,
      );
  }
  return problems;
}

/**
 * Checks one building sprite: canvas size (§4.2), no drawing below the footprint
 * (§4.1), hard alpha (§4.3) and palette colors (§6). Returns problems, each with
 * the first offending pixel and how many pixels share the problem.
 */
export function checkSprite(
  image: RgbaImage,
  footprint: number,
  palette: ReadonlySet<number>,
): string[] {
  const { width, height, data } = image;
  const expectedWidth = footprint * TILE_WIDTH;
  const diamond = footprint * TILE_HEIGHT;
  if (width !== expectedWidth || height <= diamond || (height - diamond) % HEIGHT_STEP !== 0) {
    const valid = `${expectedWidth} × (${diamond} + a multiple of ${HEIGHT_STEP})`;
    return [
      `canvas is ${width} × ${height} px; a footprint-${footprint} building must be ${valid}`,
    ];
  }

  let firstOpaqueRow = height;
  const issues = {
    alpha: new Issue("semi-transparent pixel", "use fully opaque or fully transparent pixels"),
    color: new Issue("color not in the palette", "use only assets/palette/commitcity.hex"),
    outside: new Issue(
      "pixel below the footprint",
      `buildings may only extend upward, or ${OVERHANG} px past the lower edges`,
    ),
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3]!;
      if (alpha === 0) continue;
      if (alpha !== 255) {
        issues.alpha.add(x, y, `alpha ${alpha}`);
        continue;
      }
      firstOpaqueRow = Math.min(firstOpaqueRow, y);
      const rgb = (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!;
      if (!palette.has(rgb)) issues.color.add(x, y, `#${rgb.toString(16).padStart(6, "0")}`);
      if (y > height - 1 - diamondTop(x, width) + OVERHANG) issues.outside.add(x, y);
    }
  }

  const problems = Object.values(issues).flatMap((issue) => issue.report());
  if (firstOpaqueRow === height) problems.unshift("the sprite is empty");
  else if (firstOpaqueRow >= HEIGHT_STEP)
    problems.push(
      `${firstOpaqueRow} empty rows at the top; crop the canvas so at most ${HEIGHT_STEP - 1} remain`,
    );
  return problems;
}

/** First row of a 2:1 diamond of `width` in column `x` (ART_DIRECTION.md §2). */
function diamondTop(x: number, width: number): number {
  const half = width / 2;
  return Math.ceil((x < half ? half - 1 - x : x - half) / 2);
}

function isSet(value: unknown, valid: (v: unknown) => boolean): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(valid) &&
    new Set(value).size === value.length
  );
}

/** Collects pixels that break one rule, so the report stays one line per rule. */
class Issue {
  private count = 0;
  private first = "";

  constructor(
    private readonly what: string,
    private readonly fix: string,
  ) {}

  add(x: number, y: number, detail?: string) {
    if (this.count++ === 0) this.first = `(${x}, ${y})${detail ? ` ${detail}` : ""}`;
  }

  report(): string[] {
    if (this.count === 0) return [];
    const more = this.count > 1 ? ` and ${this.count - 1} more` : "";
    return [`${this.what} at ${this.first}${more}; ${this.fix}`];
  }
}
