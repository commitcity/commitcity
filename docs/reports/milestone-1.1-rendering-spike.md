# Milestone 1.1 — Rendering spike results

Status: **in progress.** Depth sorting and the view transform are checked. Performance on real hardware and the tile-size decision are still open.

Run it with `pnpm dev` and open `/dev/spike`. Query parameters make a view reproducible: `scene=benchmark`, `o=0..3`, `tile=64`, `zoom=1..8`, `pan=1` (auto-pan for FPS measurements).

## Depth sorting in all four orientations

Hard-cases scene (`fixtures/spike/hard-cases.json`): a tall building behind a short one, small buildings against both walls of a large one, buildings touching a large one at both diagonal corners, and buildings on every map edge. Each world side has its own wall color (+x red, +y green, -x blue, -y yellow), so the colors must turn with the map.

| Orientation 0 | Orientation 1 |
|---|---|
| ![orientation 0](images/spike-hard-cases-o0.png) | ![orientation 1](images/spike-hard-cases-o1.png) |
| **Orientation 2** | **Orientation 3** |
| ![orientation 2](images/spike-hard-cases-o2.png) | ![orientation 3](images/spike-hard-cases-o3.png) |

No sorting errors found. The front-corner rule from the original proposal fails when a small building stands against a large one's wall, so the sort is now topological (see `ARCHITECTURE.md` §7.2 and `src/core/view/depth.ts`).

## Tile size

| 32 × 16 (zoom 2) | 64 × 32 (zoom 1) |
|---|---|
| ![32 × 16](images/spike-hard-cases-o0.png) | ![64 × 32](images/spike-hard-cases-64.png) |

At the same on-screen size the two look identical with placeholders; the difference is how much detail an artist (or an AI image tool) can put into each tile, and how much art has to be drawn. **Decision pending — maintainers.**

## Benchmark

300 buildings on the lot grid plus 90 × 90 ground tiles (8,400 sprites, no culling or ground caching yet).

![benchmark](images/spike-benchmark-32.png)

| Measurement | Result |
|---|---|
| Building the sorted render list (all 8,100 ground tiles and 300 buildings), Node 22 | 11–34 ms per orientation change |
| FPS while panning, mid-range laptop | _pending_ |
| FPS while panning, phone | _pending_ |

The screenshots above come from headless Chromium with software WebGL (SwiftShader), which says nothing about real frame rates.

## Pixel integrity

The canvas is sized in device pixels and the zoom is a whole number of device pixels per art pixel, so pixels stay square on any display, including fractional device pixel ratios. The camera position is rounded to whole device pixels. Because zoom counts device pixels, zoom 2 on a 2× display is the same physical size as zoom 1 on a 1× display.
