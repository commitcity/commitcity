// Validates the assets, then packs every sprite into one atlas for the app:
// public/generated/assets/{atlas.png,catalog.json} (ARCHITECTURE.md §9).
// Usage: pnpm pack-assets [assets-dir]
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import { type AtlasFrame, type PackedAssets, frameKey, packShelves } from "../src/core/assets";
import { readAssets } from "./lib/readAssets";

const root = process.argv[2] ?? "assets";
const out = join("public", "generated", "assets");
const { buildings, tiles, problems } = readAssets(root);

if (problems.length > 0) {
  console.error(`✗ Not packing: ${problems.length} asset problem(s). Run pnpm validate-assets.`);
  process.exit(1);
}

const sprites = [
  ...buildings.flatMap(({ manifest, sprites }) =>
    sprites.map((s) => ({ key: frameKey(manifest.id, s.view, s.variant), image: s.image })),
  ),
  ...tiles.flatMap(({ sprites }) => sprites.map((s) => ({ key: s.textureKey, image: s.image }))),
];
const { positions, width, height } = packShelves(sprites.map((s) => s.image));

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const frames: Record<string, AtlasFrame> = {};
const catalog: PackedAssets = {
  image: "atlas.png",
  buildings: buildings.map((b) => b.manifest),
  tiles: tiles.map((t) => t.manifest),
  frames,
};

if (sprites.length > 0) {
  const atlas = new PNG({ width, height });
  atlas.data.fill(0);
  sprites.forEach(({ key, image }, i) => {
    const { x, y } = positions[i]!;
    frames[key] = { x, y, width: image.width, height: image.height };
    for (let row = 0; row < image.height; row++) {
      const from = row * image.width * 4;
      atlas.data.set(
        image.data.subarray(from, from + image.width * 4),
        ((y + row) * width + x) * 4,
      );
    }
  });
  writeFileSync(join(out, "atlas.png"), PNG.sync.write(atlas));
}
writeFileSync(join(out, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
console.log(
  `✓ Packed ${sprites.length} sprites from ${buildings.length} buildings and ${tiles.length} tile sets into ${out}`,
);
