# `src/core`

Pure TypeScript shared by every layer: no React, no PixiJS, no Next.js, no browser APIs, no `Math.random`, no `Date.now`. See [ADR 0001](../../docs/decisions/0001-separate-generation-from-rendering.md).

Planned modules (see [`docs/ARCHITECTURE.md` §3.1](../../docs/ARCHITECTURE.md#31-repository-layout-proposal)):

| Folder        | Purpose                                    |
| ------------- | ------------------------------------------ |
| `model/`      | Shared types (`CityInput`, `CityModel`, …) |
| `random/`     | Seeded PRNG and hashing                    |
| `generation/` | `CityInput` → `CityModel`                  |
| `view/`       | `CityModel` + orientation → `RenderList`   |
| `assets/`     | Building manifest types and catalog        |
| `raster/`     | `RenderList` → pixels, for social previews |
