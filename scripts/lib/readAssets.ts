import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { PNG } from "pngjs";
import {
  type BuildingManifest,
  type RgbaImage,
  type Variant,
  type View,
  checkFolderFiles,
  checkSprite,
  parseManifest,
  parsePalette,
  spriteFiles,
} from "../../src/core/assets";

export interface BuildingAssets {
  manifest: BuildingManifest;
  sprites: { view: View; variant: Variant; image: RgbaImage }[];
}

export interface AssetReport {
  buildings: BuildingAssets[];
  /** Each problem starts with the path it is about, relative to the repository. */
  problems: string[];
}

/**
 * Reads and validates every building under `<root>/buildings` against the palette
 * in `<root>/palette/commitcity.hex`. Only fully valid buildings are returned.
 */
export function readAssets(root: string): AssetReport {
  const palette = parsePalette(readFileSync(join(root, "palette", "commitcity.hex"), "utf8"));
  const buildingsDir = join(root, "buildings");
  const buildings: BuildingAssets[] = [];
  const problems: string[] = [];
  const at = (path: string, message: string) =>
    problems.push(`${relative(process.cwd(), path)}: ${message}`);

  const folders = existsSync(buildingsDir)
    ? readdirSync(buildingsDir)
        .filter((name) => statSync(join(buildingsDir, name)).isDirectory())
        .sort()
    : [];
  for (const folder of folders) {
    const dir = join(buildingsDir, folder);
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
    const { manifest, problems: manifestProblems } = parseManifest(json, folder);
    manifestProblems.forEach((p) => at(manifestPath, p));
    if (!manifest) continue;

    const before = problems.length;
    const files = readdirSync(dir).filter((f) => !f.startsWith("."));
    checkFolderFiles(manifest, files).forEach((p) => at(dir, p));

    const sprites: BuildingAssets["sprites"] = [];
    for (const { file, view, variant } of spriteFiles(manifest)) {
      const path = join(dir, file);
      if (!existsSync(path)) continue;
      let image: RgbaImage;
      try {
        const png = PNG.sync.read(readFileSync(path));
        image = { width: png.width, height: png.height, data: png.data };
      } catch (error) {
        at(path, `cannot be read as a PNG (${(error as Error).message})`);
        continue;
      }
      checkSprite(image, manifest.footprint, palette).forEach((p) => at(path, p));
      sprites.push({ view, variant, image });
    }
    if (problems.length === before) buildings.push({ manifest, sprites });
  }
  return { buildings, problems };
}
