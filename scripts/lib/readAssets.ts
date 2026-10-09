import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { PNG } from "pngjs";
import {
  type BuildingManifest,
  type RgbaImage,
  TILE_FOLDERS,
  TILE_KINDS,
  type TileManifest,
  type Variant,
  type View,
  checkFiles,
  checkFolderFiles,
  checkSprite,
  checkTile,
  checkUiImage,
  parseManifest,
  parseTileManifest,
  tileFiles,
  parsePalette,
  spriteFiles,
} from "../../src/core/assets";

export interface BuildingAssets {
  manifest: BuildingManifest;
  sprites: { view: View; variant: Variant; image: RgbaImage }[];
}

export interface TileAssets {
  manifest: TileManifest;
  sprites: { textureKey: string; image: RgbaImage }[];
}

/** An interface image from `<root>/ui` (ART_DIRECTION.md §16). */
export interface UiAsset {
  file: string;
  path: string;
}

export interface AssetReport {
  buildings: BuildingAssets[];
  tiles: TileAssets[];
  ui: UiAsset[];
  /** Each problem starts with the path it is about, relative to the repository. */
  problems: string[];
}

/**
 * Reads and validates every building under `<root>/buildings` and every ground,
 * road and vegetation folder, against the palette in
 * `<root>/palette/commitcity.hex`, and every interface image in `<root>/ui`.
 * Only fully valid folders and images are returned.
 */
export function readAssets(root: string): AssetReport {
  const palette = parsePalette(readFileSync(join(root, "palette", "commitcity.hex"), "utf8"));
  const buildings: BuildingAssets[] = [];
  const tiles: TileAssets[] = [];
  const ui: UiAsset[] = [];
  const problems: string[] = [];
  const at = (path: string, message: string) =>
    problems.push(`${relative(process.cwd(), path)}: ${message}`);

  /** Reads a PNG, or reports why it cannot be read. */
  const readImage = (path: string): RgbaImage | null => {
    try {
      const png = PNG.sync.read(readFileSync(path));
      return { width: png.width, height: png.height, data: png.data };
    } catch (error) {
      at(path, `cannot be read as a PNG (${(error as Error).message})`);
      return null;
    }
  };

  /** Each folder's directory, file names and parsed manifest JSON, or a reported problem. */
  const folders = function* (parent: string) {
    if (!existsSync(parent)) return;
    const names = readdirSync(parent)
      .filter((name) => statSync(join(parent, name)).isDirectory())
      .sort();
    for (const folder of names) {
      const dir = join(parent, folder);
      const manifestPath = join(dir, "manifest.json");
      if (!existsSync(manifestPath)) {
        at(dir, "manifest.json is missing");
        continue;
      }
      let json: unknown;
      try {
        json = JSON.parse(readFileSync(manifestPath, "utf8"));
      } catch (error) {
        at(manifestPath, `not valid JSON (${(error as Error).message})`);
        continue;
      }
      const files = readdirSync(dir).filter((f) => !f.startsWith("."));
      yield { folder, dir, manifestPath, json, files };
    }
  };

  for (const { folder, dir, manifestPath, json, files } of folders(join(root, "buildings"))) {
    const { manifest, problems: manifestProblems } = parseManifest(json, folder);
    manifestProblems.forEach((p) => at(manifestPath, p));
    if (!manifest) continue;
    const before = problems.length;
    checkFolderFiles(manifest, files).forEach((p) => at(dir, p));
    const sprites: BuildingAssets["sprites"] = [];
    for (const { file, view, variant } of spriteFiles(manifest)) {
      const path = join(dir, file);
      const image = existsSync(path) ? readImage(path) : null;
      if (!image) continue;
      checkSprite(image, manifest.footprint, palette).forEach((p) => at(path, p));
      sprites.push({ view, variant, image });
    }
    if (problems.length === before) buildings.push({ manifest, sprites });
  }

  for (const kind of TILE_KINDS) {
    for (const { folder, dir, manifestPath, json, files } of folders(
      join(root, TILE_FOLDERS[kind]),
    )) {
      const { manifest, problems: manifestProblems } = parseTileManifest(json, folder, kind);
      manifestProblems.forEach((p) => at(manifestPath, p));
      if (!manifest) continue;
      const before = problems.length;
      const expected = tileFiles(manifest);
      checkFiles(
        expected.map((e) => e.file),
        files,
      ).forEach((p) => at(dir, p));
      const sprites: TileAssets["sprites"] = [];
      for (const { file, textureKey } of expected) {
        const path = join(dir, file);
        const image = existsSync(path) ? readImage(path) : null;
        if (!image) continue;
        checkTile(image, kind, palette).forEach((p) => at(path, p));
        sprites.push({ textureKey, image });
      }
      if (problems.length === before) tiles.push({ manifest, sprites });
    }
  }
  const uiDir = join(root, "ui");
  if (existsSync(uiDir)) {
    for (const file of readdirSync(uiDir).sort()) {
      if (!file.endsWith(".png")) continue;
      const path = join(uiDir, file);
      const image = readImage(path);
      if (!image) continue;
      const imageProblems = checkUiImage(image, palette);
      imageProblems.forEach((p) => at(path, p));
      if (imageProblems.length === 0) ui.push({ file, path });
    }
  }
  return { buildings, tiles, ui, problems };
}
