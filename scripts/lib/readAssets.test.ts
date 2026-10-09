import { afterEach, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PNG } from "pngjs";
import { readAssets } from "./readAssets";

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

/** A temporary assets folder with the real palette. */
function assetsDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "commitcity-assets-"));
  dirs.push(dir);
  cpSync("assets/palette", join(dir, "palette"), { recursive: true });
  return dir;
}

/** A footprint-1 box (height 24) or a flat tile (height 16) in a palette color. */
function sprite(height = 24): Buffer {
  const png = new PNG({ width: 32, height });
  png.data.fill(0);
  for (let x = 0; x < 32; x++) {
    const top = Math.ceil((x < 16 ? 15 - x : x - 16) / 2);
    for (let y = top; y < height - top; y++)
      png.data.set([0x62, 0x55, 0x65, 255], (y * 32 + x) * 4);
  }
  return PNG.sync.write(png);
}

function building(root: string, id: string, manifest: object | string, files: string[]) {
  const dir = join(root, "buildings", id);
  mkdirSync(dir, { recursive: true });
  const json = typeof manifest === "string" ? manifest : JSON.stringify(manifest);
  writeFileSync(join(dir, "manifest.json"), json);
  for (const file of files) writeFileSync(join(dir, file), sprite());
}

const manifest = (id: string) => ({
  id,
  family: "civic",
  footprint: 1,
  levels: [1],
  views: [0],
  symmetric: true,
  variants: ["default"],
  authors: ["Test"],
  license: "CC-BY-SA-4.0",
  aiAssisted: false,
});

describe("readAssets", () => {
  it("is empty when there are no buildings", () => {
    expect(readAssets(assetsDir())).toEqual({ buildings: [], tiles: [], ui: [], problems: [] });
  });

  it("returns valid buildings with their decoded sprites", () => {
    const root = assetsDir();
    building(root, "small-hall", manifest("small-hall"), ["view-0.png"]);
    const { buildings, problems } = readAssets(root);
    expect(problems).toEqual([]);
    expect(buildings.map((b) => b.manifest.id)).toEqual(["small-hall"]);
    expect(buildings[0]!.sprites[0]).toMatchObject({ view: 0, variant: "default" });
    expect(buildings[0]!.sprites[0]!.image.width).toBe(32);
  });

  it("reports broken folders by path and keeps the valid ones", () => {
    const root = assetsDir();
    building(root, "good", manifest("good"), ["view-0.png"]);
    building(root, "bad-json", "{ nope", []);
    building(root, "no-sprite", manifest("no-sprite"), []);
    mkdirSync(join(root, "buildings", "empty"));
    writeFileSync(join(root, "buildings", "not-a-png"), "");
    const { buildings, problems } = readAssets(root);
    expect(buildings.map((b) => b.manifest.id)).toEqual(["good"]);
    expect(problems).toHaveLength(3);
    expect(problems[0]).toMatch(/bad-json\/manifest\.json: not valid JSON/);
    expect(problems[1]).toMatch(/empty: manifest\.json is missing$/);
    expect(problems[2]).toMatch(/no-sprite: view-0\.png is missing/);
  });

  it("reads ground, road and vegetation folders with their texture keys", () => {
    const root = assetsDir();
    const tileManifest = (id: string, kind: string) => ({
      id,
      kind,
      authors: ["Test"],
      license: "CC-BY-SA-4.0",
      aiAssisted: false,
    });
    const write = (folder: string, id: string, kind: string, files: string[], height: number) => {
      const dir = join(root, folder, id);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "manifest.json"), JSON.stringify(tileManifest(id, kind)));
      for (const file of files) writeFileSync(join(dir, file), sprite(height));
    };
    const range = (n: number, name: string) =>
      Array.from({ length: n }, (_, i) => `${name}-${i}.png`);
    write("ground", "grass", "ground", range(4, "variant"), 16);
    write("roads", "street", "road", range(16, "mask"), 16);
    write("vegetation", "tree", "vegetation", range(3, "variant"), 24);
    write("vegetation", "cactus", "vegetation", range(3, "variant"), 24);

    const { tiles, problems } = readAssets(root);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/cactus\/manifest\.json: vegetation folders must be named one of/);
    expect(tiles.map((t) => t.manifest.id)).toEqual(["grass", "street", "tree"]);
    expect(tiles[0]!.sprites.map((s) => s.textureKey)).toEqual([
      "ground/grass/0",
      "ground/grass/1",
      "ground/grass/2",
      "ground/grass/3",
    ]);
    expect(tiles[1]!.sprites[15]!.textureKey).toBe("road/15");
    expect(tiles[2]!.sprites[0]!.textureKey).toBe("decoration/tree/0");
  });

  it("reads interface images and reports the invalid ones", () => {
    const root = assetsDir();
    mkdirSync(join(root, "ui"));
    writeFileSync(join(root, "ui", "panel.png"), sprite());
    const odd = new PNG({ width: 2, height: 2 });
    odd.data.fill(128);
    writeFileSync(join(root, "ui", "broken.png"), PNG.sync.write(odd));
    const { ui, problems } = readAssets(root);
    expect(ui.map((u) => u.file)).toEqual(["panel.png"]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("broken.png: semi-transparent pixel");
  });
});
