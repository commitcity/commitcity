---
name: isometric-pixel-sprites
description: Draw CommitCity-style 2:1 isometric pixel-art sprites (buildings, ground, roads, trees) in code with a fixed palette, then validate and preview them in the city.
---

# Isometric pixel sprites, drawn in code

Use this when creating or changing art for CommitCity (or any project with the same rules): building sprites, ground tiles, road tiles, trees and props. The sprites are drawn pixel by pixel by a TypeScript generator, written as PNGs, and checked by the project's validator. Code-drawn art is exact (size, palette, hard alpha) and easy to restyle in bulk.

## 0. Read the source of truth first

The repository documents win over this skill when they differ. Before drawing, read:

- `docs/ART_DIRECTION.md`: projection (§2), tiles (§3), canvas and anchor (§4.2), light (§5), palette (§6), line rules (§7), views (§8), families (§9), ground and roads (§10), folder layout and manifest (§12), checklist (§15).
- `assets/palette/commitcity.hex`: the only colors allowed.
- `assets/README.md` and `scripts/README.md`: how assets are validated and packed.

## 1. Hard rules (an asset that breaks one is rejected)

- **Projection 2:1.** Structural diagonals step exactly 2 px across per 1 px down. Vertical edges are perfectly vertical. No other angles.
- **Tile 32 x 16.** The diamond's top and bottom vertices are 2 px wide; the left and right vertices are 1 px tall. For column `x` of a diamond `w` wide, the first covered row is `ceil(|x - (w/2 - 0.5)| - 0.5) / 2` rounded up, i.e. `ceil((x < w/2 ? w/2 - 1 - x : x - w/2) / 2)`, and the last covered row is `h - 1 - top`.
- **Building canvas.** Footprint `N`: width `N x 32`, height `N x 16 + H`, with `H` a multiple of 4 and at most 3 empty rows on top. The footprint diamond fills the bottom of the canvas; the anchor is the bottom-center pixel.
- **Occupancy.** Nothing below the footprint's lower edges, except an overhang of at most 2 px. Height grows upward only.
- **Palette only, hard alpha only.** Every pixel is fully transparent or fully opaque, in a palette color.
- **Light from the upper left, fixed on screen.** Top faces lightest, left-facing walls medium, right-facing walls darkest. Never mirror a building to make another view.
- **No text, no anti-aliasing against transparency, no noise textures.**

## 2. Material ramps (Resurrect 64)

Pick each material's colors from one ramp, darkest first. Roof or top = lightest steps, left wall = middle, right wall = darker, outline = darkest step of that material.

| Material | Ramp (dark to light) |
|---|---|
| Brick | `6e2727 9e4539 cd683d e6904e` |
| Red roof tiles | `6e2727 ae2334 e83b3b f68181` |
| Glass | `323353 484a77 4d65b4 4d9be6 8fd3ff` |
| Cool concrete | `2e222f 3e3546 625565 7f708a 9babb2 c7dcd0` |
| Green concrete / stone | `313638 374e4a 547e64 92a984 b2ba90` |
| Plaster / sand | `694f62 966c6c ab947a fdcbb0` |
| Teal metal / copper roof | `0b5e65 0b8a8f 0eaf9b 30e1b9` |
| Foliage | `165a4c 239063 1ebc73 91db69 cddf6c` |
| Dirt | `4c3e24 966c6c ab947a` |
| Dry grass / weeds | `4c3e24 676633 a2a947 d5e04b` |
| Asphalt | `2e222f 3e3546 625565`, curb `9babb2`, lane paint `f9c22b` |
| Lit window | `fbb954` (warm) or `8fd3ff` (cool) |
| Dark window | `323353` or `3e3546` |

Avoid `ffffff` except as a 1 px sparkle. Shadows lean cool, highlights lean warm.

## 3. Shapes and details

- **Storey** 5 to 6 px (the first art set uses 6 for brick, 5 for glass). Windows are 2 x 3 px with 2 px gaps (ART_DIRECTION §7), stepped along the wall's 2:1 slope so they sit on the wall plane: on the left wall a window row moves 1 px down for every 2 px to the right; on the right wall it moves 1 px up.
- **Outlines**: 1 px, darkest color of the adjacent material, on the silhouette; inner edges lighter or omitted.
- **Roofs**: flat roofs get a 1 px parapet line and a few clusters (AC units, vents, a water tank); pitched roofs run along a 2:1 ridge.
- **Readability first**: footprint size, family and condition must read at 2x zoom. Prefer clear silhouettes over fine texture.
- **Abandoned variant**: same silhouette as the default. Darken and desaturate one or two ramp steps, board up windows (dark window color with a lighter 1 px plank), add weeds along the base. Draw it from the default by recoloring, never as a new shape.
- **Trees and props** sit on one tile, anchored bottom-center like a 1 x 1 building; they may overhang neighbors a little but never cover a building's footprint.
- **Ground tiles** are a full 32 x 16 diamond with 2 to 4 variants that tile seamlessly: keep the outer edge rows in the base color, and put detail clusters inside.
- **Road tiles** are 32 x 16, auto-tiled by a 4-bit neighbor mask (1 = +x, 2 = +y, 4 = -x, 8 = -y in view space): curbs on sides without a neighbor, lane marks toward sides with one. All 16 masks must exist and connect seamlessly with each other.

## 4. Procedure

1. **Plan the set.** List every sprite with its kind, footprint, height, family, variants and views. Check how many the milestone or issue asks for.
2. **Use the drawing kit.** Shared helpers (canvas, diamond, ramps, noise, PNG and manifest writer) live in `scripts/art/kit.ts`. Ground, roads and vegetation are drawn in `scripts/art/terrain.ts`, buildings in `scripts/art/models.ts` (solids ray-cast by `scripts/art/solids.ts`). Add new material ramps to the kit and new styles as data in the generator; never copy helpers between generators.
3. **Generate deterministically.** No `Math.random`; derive any variation from the sprite's name or an index, so re-running the generator reproduces the same PNGs byte for byte.
4. **Write assets where the docs say**, with a complete `manifest.json` per building. Code-drawn art made by an AI agent sets `"aiAssisted": true`, and the pull request says how it was made (ART_DIRECTION §14.4).
5. **Regenerate and validate**: `pnpm art` redraws everything and formats the manifests; `pnpm validate-assets` must pass. Fix the generator, not the PNG.
6. **Look at it in context**: start the dev city (`pnpm dev`, then `/dev/city?fixture=medium` and `?fixture=large`), take screenshots at zoom 1 and 2, and check sorting, seams between ground and road tiles, silhouettes, and contrast between families. Fix what reads badly and repeat.
7. **Review against the checklist** in ART_DIRECTION §15, item by item.
8. **Show the screenshots to the user before opening the pull request**, and ask what to change. Visual taste is theirs to approve.

## 5. Common mistakes

- A 1 px error in `diamondTop` makes every tile seam visible. Test with a 3 x 3 patch of ground tiles before anything else.
- Window rows drawn horizontally instead of along the 2:1 wall slope look like they float.
- Using the same mid tone on both walls flattens the building; keep at least one ramp step between left and right walls.
- Lane marks that stop short of the tile edge break the road at every tile.
- Tall towers on small footprints hide the city behind them; keep height under about 4 x canvas width.
