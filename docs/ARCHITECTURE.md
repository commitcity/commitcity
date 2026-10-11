# CommitCity — Technical Architecture

| | |
|---|---|
| **Status** | Draft — Phase 0 (Discovery & Specification) |
| **Audience** | Developers and technical reviewers |
| **Related docs** | [`VISION.md`](./VISION.md), [`ART_DIRECTION.md`](./ART_DIRECTION.md), [`ROADMAP.md`](./ROADMAP.md) |

This document describes **how CommitCity is built**: the stack, the layers of the system, the data models, and the procedural generation algorithm. It is a specification, not an implementation. Code samples are illustrative TypeScript types, not final APIs.

Each decision is marked as **Confirmed**, **Proposal** (to be validated, usually by a milestone), or **Open**.

---

## 1. Architectural principles

1. **Generation is pure.** City generation is a deterministic function with no I/O, no DOM, no rendering library, no clock, and no global randomness. It can run in Node, in the browser, or in a test.
2. **Rendering is a consumer.** The renderer only draws a model it receives. It never decides where things go.
3. **Data is normalized at the edge.** External data (GitHub API, fixtures) is converted into a small internal format before anything else sees it.
4. **Content is data.** Building types come from asset manifests, not from code.
5. **Add infrastructure only when a milestone needs it.** No database, queue, or service before a concrete requirement.

## 2. Stack evaluation

| Technology | Verdict | Reasoning | Status |
|---|---|---|---|
| **TypeScript** (strict) | Keep | Shared types between generation, rendering, and UI; essential for contributors. | Confirmed |
| **Next.js (App Router)** | Keep | Public city pages need server rendering, caching, and social preview images; it deploys natively to Vercel's free tier. The renderer itself runs only on the client. `cacheComponents` and `partialPrefetching` are on (milestone 5.1), so caching uses `use cache` (§10); pages that read the query string render it inside `<Suspense>`. | Confirmed |
| **PixiJS v8** | Keep | Mature WebGL/WebGPU 2D sprite renderer with batching, texture atlases, and nearest-neighbor scaling. Fits a sprite-based isometric city. | Confirmed — Milestone 1.1 (phone measurement pending, #10) |
| **@pixi/react** | Defer | Declaring thousands of sprites as React elements adds reconciliation overhead and makes sorting and culling harder to control. Proposal: PixiJS used imperatively inside one client component; React is used for UI only. Can be revisited. | Proposal |
| **Tailwind CSS** | Keep (UI only), when needed | Fast, consistent styling for panels and pages. Never used inside the canvas. Not added yet: the two product pages of milestone 5.2 use one plain stylesheet (`src/app/globals.css`). Revisit when the UI grows. | Deferred |
| **Zustand** | Keep (small), when needed | Lightweight store for UI state (selection, panels, orientation). Not used for city data or per-frame camera updates. Not added yet: milestone 3.2 needed only one component's state (§8). | Deferred |
| **Vitest** | Keep | Fast unit tests; generation is pure, so it is highly testable. | Confirmed |
| **tsx**, **pngjs** (dev only) | Keep | `tsx` runs the asset scripts in TypeScript with the same `@/` imports as `src/core`, so the rules are shared, not copied. `pngjs` reads and writes PNGs in Node with no native build step. | Confirmed (milestone 4.1) |
| **PostgreSQL** | Defer | No requirement yet. Public pages can be served from cached API results. It may become necessary for timelapse history or rate-limit protection. | Confirmed (deferred) |
| **GitHub API** | Keep | GraphQL, server side only (§10). | Confirmed (milestone 5.1) |
| **Package manager** | pnpm | Fast, strict dependency resolution, common in open-source projects. | Proposal |

### Alternatives considered for rendering

| Option | Why not (for now) |
|---|---|
| Canvas 2D | Simple, but slower for thousands of sprites, and no batching; would likely need a rewrite later. Good fallback if PixiJS proves problematic. |
| Phaser | A full game framework (physics, scenes, input) is more than we need; harder to integrate with Next.js pages. |
| Three.js (orthographic) | Designed for 3D; pixel-art sprites work, but depth and pixel-perfect scaling fight the engine. Contradicts the "not 3D" direction. |

## 3. System layers

```
┌────────────────────────────────────────────────────────────┐
│  UI (React, Tailwind, Zustand)                             │
│  pages, panels, controls, URL state                        │
├────────────────────────────────────────────────────────────┤
│  Renderer (PixiJS, client only)                            │
│  sprites, camera, culling, hit testing                     │
├────────────────────────────────────────────────────────────┤
│  View (pure TypeScript)                                    │
│  CityModel + orientation  →  sorted RenderList             │
├────────────────────────────────────────────────────────────┤
│  Generation (pure TypeScript)                              │
│  CityInput + AssetCatalog  →  CityModel                    │
├────────────────────────────────────────────────────────────┤
│  Data (adapters)                                           │
│  fixtures / GitHub API  →  CityInput                       │
└────────────────────────────────────────────────────────────┘
```

**Dependency rule (Confirmed):** a layer may import only from layers *below* it. `generation` and `view` must not import React, PixiJS, Next.js, or browser APIs. This is enforced by lint rules once code exists.

### 3.1 Repository layout (proposal)

A single Next.js application. No monorepo until a second package is genuinely needed.

```
commitcity/
  docs/                     project documentation
  assets/                   source art (see ART_DIRECTION.md §12)
  fixtures/                 sample CityInput JSON files for development and tests
  src/
    core/
      model/                shared types (CityInput, CityModel, …)
      random/               seeded PRNG and hashing
      generation/           CityInput → CityModel
      view/                 CityModel + orientation → RenderList
      assets/               manifest types and catalog
    data/                   adapters (fixtures, GitHub)
    renderer/               PixiJS code (client only)
    ui/                     React components and stores
    app/                    Next.js routes
  scripts/                  asset validation and atlas packing
```

## 4. Data models

### 4.1 Input: `CityInput`

The normalized, source-independent input to generation.

```ts
interface CityInput {
  owner: string;               // GitHub login, used for the city seed
  snapshotAt: string;          // ISO date the data was fetched
  repos: RepoInput[];
}

interface RepoInput {
  id: string;                  // stable GitHub node id
  name: string;
  description: string | null;
  createdAt: string;           // ISO date — drives placement order
  pushedAt: string | null;     // last activity
  primaryLanguage: string | null;
  stars: number;
  commitCount: number | null;  // may be unavailable (see §10)
  isFork: boolean;
  isArchived: boolean;
}
```

### 4.2 Assets: `BuildingManifest` and `AssetCatalog`

Matches `ART_DIRECTION.md` §12.

```ts
type Orientation = 0 | 1 | 2 | 3;
type Family = "residential" | "brick" | "modern" | "industrial" | "civic";
type Variant = "default" | "abandoned";

interface BuildingManifest {
  id: string;
  family: Family;
  footprint: 1 | 2 | 3 | 4;
  levels: number[];            // e.g. [1, 2]
  views: Orientation[];        // available views, at least [0]
  symmetric: boolean;
  variants: Variant[];
  authors: string[];
  license: string;
  aiAssisted: boolean;
}

interface AssetCatalog {
  version: string;             // hash of all manifests
  buildings: BuildingManifest[];
}
```

### 4.3 Output: `CityModel`

The complete, orientation-independent description of a city. World coordinates are integer tile coordinates; `(0, 0)` is the city center.

```ts
interface CityModel {
  generatorVersion: number;    // bumped on any change to the algorithm
  catalogVersion: string;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  ground: GroundTile[];
  roads: RoadTile[];
  buildings: Building[];
  decorations: Decoration[];   // trees, bushes, props
  aggregates: Aggregate[];     // grouped repositories (> 300, see §6.7)
}

interface Building {
  repoId: string;
  manifestId: string;
  origin: { x: number; y: number };   // top (back) corner of the footprint
  footprint: 1 | 2 | 3 | 4;
  family: Family;                      // resolved family, also used by placeholders
  facing: Orientation;                 // side that faces the road
  level: number;
  variant: Variant;
  isAnnex: boolean;
}

interface RoadTile { x: number; y: number }       // shape resolved in the view layer
interface GroundTile { x: number; y: number; kind: "grass" | "dirt" | "pavement"; variant: number }
interface Decoration { x: number; y: number; kind: string; variant: number; repoId: string }
interface Aggregate { origin: { x: number; y: number }; repoIds: string[] }
```

### 4.4 View: `ViewState` and `RenderList`

```ts
interface ViewState {
  orientation: Orientation;    // 0 only in current scope
  zoom: 1 | 2 | 3 | 4;         // integer scale
  center: { x: number; y: number }; // world position at screen center
}

interface RenderItem {
  layer: "ground" | "road" | "object";
  textureKey: string;          // see the key formats below
  screenX: number;             // integer pixels at 1x
  screenY: number;             // tiles: top vertex; objects: footprint front vertex
  depth: number;               // draw order within the layer
  pickId?: string;             // repoId for hit testing (buildings only)
}

interface RenderList {
  ground: RenderItem[];        // sorted by view (y, x)
  roads: RenderItem[];         // sorted by view (y, x)
  objects: RenderItem[];       // buildings and decorations, topologically sorted (§7.2)
}
```

`buildRenderList(model, orientation, tile)` in `src/core/view/renderList.ts` is pure: the same model and orientation always give the same list. **Confirmed** (milestone 3.1). Texture keys:

| Item | Key | Notes |
|---|---|---|
| Ground | `ground/<kind>/<variant>` | |
| Road | `road/<mask>` | Neighbor mask in view space: 1 = +x, 2 = +y, 4 = −x, 8 = −y. |
| Building | `building/<manifestId>/view-<v>/<variant>/level-<n>` | `v = rotateSide(facing, orientation)`. |
| Decoration | `decoration/<kind>/<variant>` | |



| Rule | Status |
|---|---|
| Generation never calls `Math.random`, `Date.now`, or anything locale- or environment-dependent. | Confirmed |
| Randomness comes from a small seeded PRNG implemented in the repository: `sfc32`, seeded through the `cyrb128` string hash, with `cyrb53` for single hashes. No dependency; only 32-bit integer math (`src/core/random`). | Confirmed (Milestone 2.1) |
| **Every repository has its own random stream**, seeded from `hash(owner + ":" + repo.id)`. Adding a repository never changes the random choices of another. Each decision type gets its own stream (`owner:id/building`, `owner:id/decoration`, …), so drawing one more number for one never shifts another. | Confirmed |
| All sorting uses explicit, total tie-breakers (for example `createdAt`, then `id`). | Confirmed |
| Only integer math for positions. | Confirmed |
| `generatorVersion` is bumped whenever output for the same input could change. Stability is guaranteed only within one version. | Confirmed |
| Test: generating the same fixture twice produces deep-equal models, and the model for each fixture is stored as a snapshot. | Confirmed |

## 6. Procedural generation

### 6.1 Overview

```
CityInput
  → normalize & sort repos (createdAt, id)
  → select individual repos (≤ 300) and aggregates
  → map each repo to building attributes (family, footprint, level, variant)
  → assign each repo a lot (chronological spiral)
  → place building and lot decoration inside each lot
  → lay roads around occupied blocks
  → fill ground
  → CityModel
```

### 6.2 City grid: lots and blocks

The city is a grid of **blocks**. Each block contains **2 × 2 lots**, and each lot is **4 × 4 tiles**. Blocks are separated by 1-tile roads.

```
 R R R R R R R R R R
 R [lot][lot] R [lot]…
 R [lot][lot] R
 R R R R R R R R R R
```

- Block interior: 8 × 8 tiles. Block period including the road: 9 tiles. **Proposal.**
- Every repository receives **exactly one lot**, regardless of its building size. **Proposal.**
- A 4 × 4 lot fits any allowed footprint (1–4). The building sits in the lot's outer corner, against both roads that border the lot, and faces one of them (chosen from its random stream); the rest of the lot is filled with deterministic **lot decoration** belonging to that repository (gardens, trees, parking, sheds), chosen from its own random stream.

**Why one fixed-size lot per repository?** It makes placement depend *only* on creation order. A repository growing from a 2×2 to a 3×3 building never moves any other building. This is the core stability guarantee and makes timelapse trivial.

**Trade-off:** small buildings get large lots, so the city is less dense than a tightly packed layout. Lot decoration compensates visually. The alternative, variable-size packing, is denser but any size change would move later buildings. See §12.

### 6.3 Placement order: chronological spiral

1. Repositories are sorted by `createdAt`, then `id`.
2. Lots are enumerated in a fixed **spiral order**: blocks by ring distance from the center (`max(|bx|, |by|)`), then clockwise on screen (at orientation 0) starting from the ring's back corner `(-r, -r)` and moving along +x, +y, -x, -y; within a block, lots go back, right, front, left. Block (0, 0) is centered on the world origin. Implemented in `src/core/generation/spiral.ts`.
3. The *n*-th repository gets the *n*-th lot.

Result: the oldest repositories form the city center, and the city grows outward like tree rings.

**Stability guarantees (Confirmed):**

| Change | Effect |
|---|---|
| New repository created | Placed in the next lot. Nothing else moves. |
| Repository gets more stars or commits | Its own building changes size, level, or type. Nothing else moves. |
| Repository archived | Its own building becomes `abandoned`. Nothing else moves. |
| Repository deleted, or data scope changed | Newer repositories shift by one lot. *Accepted limitation* (see §12). |
| `generatorVersion` changes | The city may change. Documented in release notes. |

**Timelapse:** a city at date `T` is generated from the repositories with `createdAt ≤ T`. Because of the spiral order, every building is at the same position at every date.

### 6.4 Districts

`VISION.md` lists "primary language → district". With chronological placement, spatially grouping languages into districts would conflict with stability (a new language would need space somewhere).

- **Current scope (Proposal):** language determines the **building family** (style), not position. Visual clusters still emerge because developers tend to use the same language in the same period.
- **Later (Open):** spatial districts, for example dedicated wedges of the spiral per language.

### 6.5 Repository-to-building mapping

All thresholds are **proposals** to be tuned with real data.

| Attribute | Rule |
|---|---|
| **Footprint** | From stars on a log scale: 0–9 → 1, 10–99 → 2, 100–999 → 3, ≥ 1000 → 4. |
| **Level** | From `commitCount`: < 50 → 1, < 500 → 2, ≥ 500 → 3. If `commitCount` is unknown, level 1. |
| **Family** | From `primaryLanguage` through a mapping table (for example web languages → `modern`, systems languages → `industrial`, scripting languages → `brick`, documentation/config → `residential`). Unknown languages: chosen from the repository's random stream. |
| **Variant** | `abandoned` if archived, otherwise `default`. |
| **Annex** | Forks: footprint reduced by one (minimum 1) and `isAnnex = true`. |
| **Manifest** | Chosen among manifests matching family, footprint, level, and variant (see below). If none match, relax family first, then level. A placeholder exists for every footprint, so the search always succeeds. |

**Manifest choice uses rendezvous hashing (Proposal):** each candidate manifest gets a score `hash(repoSeed + manifest.id)` and the highest score wins. When artists add a new building type, only a small fraction of buildings switch to it, instead of the whole city reshuffling as a simple `hash % count` would cause.

### 6.6 Roads, ground, and decoration

- Roads surround every block that contains at least one occupied lot. Road shapes (straight, corner, T, crossing) are **not** stored; the view layer derives them from neighbors, so they stay correct under rotation. **Confirmed** (milestone 3.1): each road tile gets a 4-bit mask of its view-space neighbors, which picks one of 16 textures.
- Ground fills the city bounds plus a 2-tile margin, with variants from a position-based hash (`hash(seed, x, y)`), so ground never depends on repository order. Lots of archived repositories are dirt.
- Decoration is placed only on free tiles of an occupied lot, from that repository's `decoration` stream. Every lot tile draws its numbers whether or not the building covers it, so a building growing never reshuffles the rest of its lot's decoration.
- Parks fill the space buildings leave empty (generator version 2). The unused lots of the last block become a pond, a plaza with a fountain, or a garden, picked by `hash(owner, lot index)`. Parks use hashes, never repository streams, so they shift nothing else; a park lot simply gives way when a new repository takes it. Water is ground, auto-tiled like roads from a 4-bit mask of water neighbors, and no decoration sits on it.

### 6.7 Large accounts (> 300 repositories)

As decided in `VISION.md`, up to 300 repositories are individual buildings (the number is a proposal pending a benchmark). The remaining repositories are ranked by significance (forks and archived first, then lowest activity and stars) and grouped into **aggregate lots** placed after the individual ones in spiral order, each representing up to N repositories as one generic neighborhood. **Proposal; details in a later milestone.**

### 6.8 Collision handling

Collisions are avoided by construction: lots never overlap, buildings never exceed their lot, roads only occupy road tiles, and decoration only occupies free lot tiles. The generator still verifies the invariant **"no two occupants share a tile"** in tests (and in development builds), so a bug fails loudly instead of rendering overlaps.

### 6.9 Rotation compatibility

Rotation is a **view transform**, never a regeneration:

- Each world tile `(x, y)` is rotated around the city center by `90° × orientation` to get view coordinates.
- A building's sprite view is `(facing + orientation) mod 4`; if that view is missing, the renderer falls back as defined in `ART_DIRECTION.md` §8.
- A building's origin in view space is the rotated footprint corner that becomes the top corner.
- Depth sorting (§7.2) is always done in view coordinates.

Because `CityModel` never stores screen positions, rotation adds no new generation logic.

## 7. Rendering architecture

### 7.1 Scene structure

The renderer receives a `RenderList` and keeps PixiJS objects in sync with it.

| Container | Contents | Notes |
|---|---|---|
| `groundLayer` | Ground tiles | Static; rebuilt only on orientation change. Can be cached into chunked render textures. |
| `roadLayer` | Road tiles | Same as ground, drawn above it. |
| `objectLayer` | Buildings and decorations | Sorted by `depth`. |
| `overlayLayer` | Hover and selection outlines | Drawn by code, not by artists. |

UI (panels, buttons) is plain React/HTML **outside** the canvas.

### 7.2 Depth sorting

With square, non-overlapping footprints, objects are sorted in view space so that each one is drawn after everything it may cover:

```
a is behind b  when  a lies entirely on the -x or -y side of b
                     and the two overlap horizontally on screen
order          =     topological sort over "is behind"
tie-break      =     front-corner sum (vx + vy + 2 × (footprint - 1)), then vx, then pickId
```

Pairs that sit diagonally (behind on one axis, in front on the other) never overlap on screen, so they have no order. The sort is O(n²) and runs only when the city or the orientation changes.

The front-corner sum alone, the original proposal, is **not** enough: a small object standing against the right or left wall of a large one has a lower sum than the large one but must be drawn after it. The milestone 1.1 unit tests include this case (`src/core/view/depth.test.ts`). **Confirmed** by the Milestone 1.1 hard-cases scene in all four orientations. The fallback, if needed, is slicing large sprites into 1-tile-wide vertical strips, each sorted independently.

### 7.3 Pixel integrity

- Textures use nearest-neighbor scaling. **Confirmed.**
- Zoom levels are integers only. **Confirmed.**
- The camera position is rounded to whole screen pixels before drawing. **Confirmed.**
- The canvas is sized in device pixels to avoid browser smoothing on high-DPI screens. **Confirmed.**

### 7.4 Interaction

- **Pan:** pointer drag, touch drag, keyboard arrows. The camera is clamped so the canvas center always stays over the ground; the clamp works in view tile space, where the ground is a rectangle.
- **Zoom:** wheel, pinch, keyboard; anchored at the pointer. Wheel deltas are accumulated so a trackpad zooms one integer step at a time like a mouse wheel.
- **Tap vs. drag:** a press that moves less than 6 CSS px is a tap; anything longer pans. A second finger turns the gesture into a pinch.
- **Hit testing:** screen point → candidate objects whose bounding box contains it, checked from front to back → alpha test against the sprite's pixel. Decorations are not pickable, so a click on a tree reaches the building behind it. `pickAt` and `spriteOrigin` live in `src/core/view/hitTest.ts`, so the renderer and the tests share the exact sprite placement. **Confirmed** (milestone 3.2): a test paints every building of the medium and edge-case cities in all four orientations and checks that every painted pixel picks its owner.
- **Highlight:** hover and selection are 1 px outlines generated from the sprite's alpha, drawn in `overlayLayer`, so a selected building stays visible even when another one stands in front of it.
- **Keyboard:** arrows pan, `+`/`-` zoom, `q`/`e` rotate, `n`/`p` select the next or previous building, `Escape` clears the selection.
- **Culling:** only objects intersecting the viewport (plus margin) are visible.

## 8. State management

| State | Owner | Notes |
|---|---|---|
| `CityInput` | Data layer | Loaded once per page. |
| `CityModel` | Memoized result of generation | Immutable; recomputed only when input or catalog changes. |
| `RenderList` | Memoized result of the view layer | Recomputed on orientation change. |
| Camera (center, zoom) | Renderer | Changes every frame during pan; kept out of React and Zustand to avoid re-renders. |
| Selection, orientation, panels | React state in the page component | Zustand was planned here; with one page and one panel, plain React state is enough. Revisit when several component trees need the same state. |
| Username, selected building | **URL** | The URL is the source of truth for anything shareable. |

Generation may later move to a Web Worker if it exceeds the performance budget; because it is pure, this needs no redesign.

## 9. Asset pipeline

1. Artists add a building folder with PNGs and `manifest.json` (`ART_DIRECTION.md` §12).
2. A validation script checks every manifest (schema, files exist, canvas sizes match footprints, palette colors only, hard alpha). It runs in CI and blocks invalid assets. **Confirmed** (milestone 4.1): the rules live in `src/core/assets/validate.ts`, are unit-tested, and run through `pnpm validate-assets` (`ART_DIRECTION.md` §12.1).
3. A packing script builds texture atlases and a catalog JSON. **Confirmed** (milestone 4.1): `pnpm pack-assets` shelf-packs every sprite into one `atlas.png` and writes `catalog.json` (`PackedAssets`: manifests plus frame rectangles) to `public/generated/assets/`, which is not committed. It runs before `dev` and `build`. One atlas is enough until it passes 2048 px; splitting it is future work.
4. The app fetches the catalog and atlas at runtime and decodes the atlas once, for both textures and hit masks. A building key resolves to a frame by manifest, nearest available view (`resolveView`) and variant; every level of a manifest uses the same drawing. Keys without a frame fall back to code-drawn placeholders, which stay in the catalog until real art covers every family and footprint (milestone 4.2).
5. `catalogVersion` (a hash of all manifests) is recorded in each `CityModel`.

## 10. GitHub data

The adapter lives in `src/data/github` (milestone 5.1). `fetchCityInput(login, options)` takes `fetch` and a clock as options, so it is tested offline against the recorded responses in `fixtures/github/`. `getCityInput(login)` adds the cache and reads the token; it is what pages call.

| Topic | Approach | Status |
|---|---|---|
| API | GitHub GraphQL API: one query on `repositoryOwner`, so users and organizations both work. It returns public repositories the owner owns, oldest first, 100 per page, with stars, primary language, dates, fork and archive flags. A lookup stops after 1,000 repositories; generation handles large accounts (§6.7). | Confirmed |
| Owner | `CityInput.owner` is the login as GitHub spells it, so every spelling of a login gives the same city seed. | Confirmed |
| Commit counts | Fetched in the same query through the default branch `history.totalCount`. Empty repositories, branches that point at a tag, and counts that time out (an error next to the data) give `null`. If large accounts make pages slow, drop the field or fetch it separately. | Confirmed (watch) |
| Errors | Every failure is a typed result, never an exception: `invalid-login` (checked before any request), `not-found`, `rate-limited` (with the reset time from the headers), `unauthorized` (token missing or wrong), `unavailable` (network, server error, unexpected data). | Confirmed |
| Authentication | Server-side requests with a project token in `GITHUB_TOKEN` (`.env.example`). Never in the client. | Confirmed |
| Rate limits | Authenticated requests have an hourly budget (GraphQL is measured in points). Every user lookup is cached. | Confirmed |
| Caching | `getCityInput` is a `use cache: remote` function, so the hosting platform's cache is shared across server instances; locally it falls back to memory. The cache key is the login in lower case. A city is refreshed in the background after a day (`cacheLife("days")`); a missing user is looked up again after an hour; rate limits and outages are kept for seconds only. Each entry is tagged `github:<login>` for `revalidateTag`. No database. | Confirmed |
| Timelapse history | Placement only needs `createdAt`, which is cheap. Showing *how buildings grew* over time needs historical activity, which is expensive to fetch and may be the first real reason to add persistence. | Open |
| Abuse protection | Limit lookups per IP and only allow existing GitHub users. | Later |

## 11. Performance targets

| Metric | Target | Status |
|---|---|---|
| Generation, 300 repositories | < 50 ms on a mid-range laptop | Proposal |
| Rendering, 300 buildings + full ground | Stable 60 fps while panning on a mid-range laptop; usable on a recent phone | Proposal |
| Initial load (atlases + code) | Small enough for mobile; measured once real art exists | Open |

The individual-building limit (300) is adjusted to whatever these targets allow.

## 12. Trade-offs and decision log

| Decision | Alternatives | Why this one | Status |
|---|---|---|---|
| Pure generation separated from rendering | Generator inside the renderer | Testable, reusable on the server (preview images), workable in a Web Worker | Confirmed |
| PixiJS used imperatively | @pixi/react; Canvas 2D; Phaser | Control over sorting, culling, and performance; React stays for UI | Confirmed |
| One fixed 4×4 lot per repository | Variable-size bin packing | Strongest stability and trivial timelapse, at the cost of density | Proposal |
| Chronological spiral placement | Placement by language district; random placement | Stable, meaningful ("old code in the center"), timelapse-friendly | Proposal |
| Deleted repositories shift newer ones | Persisting positions in a database | Avoids a database; deletion is rare | Proposal |
| Language → style, not position | Spatial language districts | Keeps placement stable; districts can come later | Proposal |
| Per-repository random streams | One global stream | Adding a repository does not change others | Confirmed |
| Rendezvous hashing for manifest choice | `hash % count` | Adding art changes few buildings | Proposal |
| No database in current scope | PostgreSQL from day one | No requirement yet; free hosting | Confirmed |

These decisions will be recorded as short ADRs in `docs/decisions/` when they are confirmed.

## 13. Open questions

1. Does PixiJS meet the performance targets with real-sized atlases on mobile? *(First milestone.)*
2. Does front-corner depth sorting hold up with tall buildings in the test scene, or do we need sprite slicing? *(First milestone.)*
3. Is the 4×4 lot too sparse visually? If so, should small buildings share lots, accepting weaker stability?
4. Which activity signal do we use if commit counts are too expensive to fetch?
5. How do we store history for a timelapse that shows growth, not only creation?
6. Do we want spatial language districts later, and how do they coexist with chronological placement?
