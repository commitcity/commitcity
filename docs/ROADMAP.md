# CommitCity — Roadmap

| | |
|---|---|
| **Status** | Draft — Phase 0 (Discovery & Specification) |
| **Audience** | Maintainers, contributors, and anyone deciding what to work on next |
| **Related docs** | [`VISION.md`](./VISION.md), [`ART_DIRECTION.md`](./ART_DIRECTION.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md) |

This roadmap splits CommitCity into **small phases**, each made of **milestones** that one developer can implement and one reviewer can verify. There are **no dates**: a phase starts when the previous one meets its acceptance criteria.

Rules for the roadmap itself:

- Each milestone has an objective, scope, dependencies, deliverables, acceptance criteria, and suggested contributor tasks.
- A milestone is **done** only when every acceptance criterion is verified, not when the code "mostly works".
- Each milestone should land as **one or a few small pull requests**.
- Anything not listed in a phase's scope is out of scope for that phase, even if it is easy.
- The roadmap is updated through pull requests, like code.

---

## Overview

| Phase | Name | Outcome |
|---|---|---|
| **0** | Specification | Documents, licenses, and contribution rules exist; the project can accept contributors. |
| **1** | Rendering foundation | A hand-written isometric scene renders correctly with PixiJS. **Validates the rendering direction.** |
| **2** | Deterministic generation | A pure TypeScript generator turns fixture data into a `CityModel`, fully tested. |
| **3** | Explorable fixture city | The generated city is rendered, explorable, and inspectable using fixture data and placeholder art. |
| **4** | Asset pipeline and first art | Real (or AI-assisted, cleaned) art replaces placeholders through validated manifests. |
| **5** | GitHub data and public pages | Any public GitHub user gets a shareable city. **First public release (v0.1).** |
| **6** | Polish and scale | Social previews, mobile, large accounts, performance. |
| **Later** | Feature tracks | Rotation, timelapse, day/night, optional data sources, community packs. |

```
0 ──► 1 ──► 3 ──► 5 ──► 6 ──► Later tracks
      2 ──┘     ▲
      4 ────────┘ (can start after 1, in parallel)
```

Phases 1 and 2 are independent and can run in parallel. Phase 4 can start once Phase 1 has validated the tile size.

---

## Phase 0 — Specification *(current)*

**Objective:** define the project well enough that contributors can start without guessing.

| | |
|---|---|
| **Scope** | Documentation, licenses, contribution rules, GitHub organization setup. No application code. |
| **Dependencies** | None. |
| **Deliverables** | `README.md` ✅, `docs/VISION.md` ✅, `docs/ART_DIRECTION.md` ✅, `docs/ARCHITECTURE.md` ✅, `docs/ROADMAP.md` ✅, `CONTRIBUTING.md` ✅, `LICENSE` (MIT) ✅, `ASSETS_LICENSE` (CC BY-SA 4.0) ✅, `CODE_OF_CONDUCT.md` ✅ *(contact method pending)*, first ADRs in `docs/decisions/` ✅, issue and PR templates ✅, label set *(created on GitHub)*, GitHub organization [`commitcity`](https://github.com/commitcity) ✅. |
| **Acceptance criteria** | A new contributor can read the README and find what the project is, its status, and how to pick a task. Every major decision is marked Confirmed / Proposal / Open. The repository is public under the GitHub organization. |
| **Contributor tasks** | Review the documents and open issues for unclear parts; propose a palette; propose a logo. |

---

## Phase 1 — Rendering foundation

### Milestone 1.0 — Project skeleton

**Objective:** an empty but correctly configured application that every later milestone builds on.

| | |
|---|---|
| **Scope** | Next.js (App Router) + TypeScript strict + pnpm + ESLint + Prettier + Vitest + a CI workflow running lint, type check, and tests. One empty page. Folder layout from `ARCHITECTURE.md` §3.1. Lint rule preventing `src/core` from importing React, PixiJS, or Next.js. |
| **Dependencies** | Phase 0 (licenses and contributing rules). |
| **Deliverables** | Skeleton repository, CI passing, a trivial unit test. |
| **Acceptance criteria** | `pnpm install && pnpm dev` shows the page; `pnpm test`, `pnpm lint`, `pnpm typecheck` pass locally and in CI; an import of `pixi.js` from `src/core` fails lint. |
| **Contributor tasks** | Set up CI; write the import-boundary lint rule; write the setup section of the README. |

### Milestone 1.1 — Isometric rendering spike ⭐ *First technical milestone*

See [the detailed specification below](#first-technical-milestone-isometric-rendering-spike).

---

## Phase 2 — Deterministic generation

Phase 2 is pure TypeScript in `src/core`. **No rendering.** Results are verified only by tests and by a text/JSON dump.

### Milestone 2.1 — Randomness and input

| | |
|---|---|
| **Objective** | Deterministic building blocks for generation. |
| **Scope** | Seeded PRNG, string hash, per-repository random streams; `CityInput` types; 3–4 fixture files (tiny: 2 repos; medium: ~30; large: ~300; edge cases: forks, archived, missing language, same `createdAt`). |
| **Dependencies** | 1.0. |
| **Deliverables** | `src/core/random`, `src/core/model`, `fixtures/*.json`. |
| **Acceptance criteria** | PRNG output for a known seed matches a stored sequence; streams for different repositories are independent; fixtures validate against the types. |
| **Contributor tasks** | Implement PRNG and hash; create fixtures from real (anonymized) public profiles. |

### Milestone 2.2 — Lot placement

| | |
|---|---|
| **Objective** | Every repository gets a stable lot in the chronological spiral (`ARCHITECTURE.md` §6.2–6.3). |
| **Scope** | Repository ordering, block/lot spiral enumeration, lot assignment. Building attributes and roads are out of scope. |
| **Dependencies** | 2.1. |
| **Deliverables** | Placement function; ASCII debug print of the lot grid. |
| **Acceptance criteria** | Same input → identical output. Adding a newer repository changes no existing position. Changing stars or archiving a repository changes no position. Timelapse property: the city at date `T` is a subset (same positions) of the city today. |
| **Contributor tasks** | Spiral enumeration; property-based tests for the stability rules. |

### Milestone 2.3 — Buildings, roads, ground, decoration

| | |
|---|---|
| **Objective** | Produce a complete `CityModel`. |
| **Scope** | Repository-to-building mapping (`ARCHITECTURE.md` §6.5) against a placeholder `AssetCatalog`; rendezvous manifest choice; roads around occupied blocks; ground; lot decoration; collision invariant. Aggregation above 300 repositories is out of scope (Phase 6). |
| **Dependencies** | 2.2. |
| **Deliverables** | `generateCity(input, catalog): CityModel`; snapshot tests for every fixture. |
| **Acceptance criteria** | No two occupants share a tile on any fixture. Snapshots are stable across runs. Generation of the ~300-repository fixture takes < 50 ms in the test environment. Adding a new manifest to the catalog changes only a minority of building choices (tested). |
| **Contributor tasks** | Mapping tables; road placement; decoration rules; invariant checker. |

---

## Phase 3 — Explorable fixture city

### Milestone 3.1 — View layer and full render

| | |
|---|---|
| **Objective** | Render a generated city. |
| **Scope** | `CityModel + orientation → RenderList` (pure, tested); road auto-tiling; placeholder sprites for every manifest; renderer consuming the render list; fixture picker in a dev page. |
| **Dependencies** | 1.1, 2.3. |
| **Deliverables** | `src/core/view`; renderer integration; `/dev/city?fixture=medium`. |
| **Acceptance criteria** | All fixtures render with no visible sorting errors at orientation 0; road shapes connect correctly; render list is unit-tested for a small city in all four orientations. |
| **Contributor tasks** | Road auto-tile rules; render-list tests; placeholder variety. |

### Milestone 3.2 — Interaction

| | |
|---|---|
| **Objective** | Users can explore and inspect the city. |
| **Scope** | Hover highlight, click selection with pixel-accurate hit testing, info panel (name, description, language, stars, last activity, GitHub link), selection in the URL, camera bounds, keyboard controls. |
| **Dependencies** | 3.1. |
| **Deliverables** | Interaction code; info panel component; Zustand UI store. |
| **Acceptance criteria** | Clicking any visible pixel of a building selects that building and no other, including behind/in front cases; opening a URL with a selected building restores the selection; works with mouse, trackpad, touch, and keyboard. |
| **Contributor tasks** | Info panel UI; keyboard controls; accessibility of the panel. |

---

## Phase 4 — Asset pipeline and first art

Can start after Milestone 1.1 has confirmed the tile size.

### Milestone 4.1 — Palette and pipeline

| | |
|---|---|
| **Objective** | Artists can add buildings without touching code, and invalid assets are rejected automatically. |
| **Scope** | Adopt the palette (license verified); manifest schema; validation script (schema, sizes, palette, hard alpha); atlas packing; catalog loading in the app; CI check. |
| **Dependencies** | 1.1 (tile size), 2.3 (manifest types). |
| **Deliverables** | `assets/palette/*`, `scripts/validate-assets`, `scripts/pack-assets`, CI job. |
| **Acceptance criteria** | A deliberately broken asset (wrong size, off-palette color, semi-transparent pixel, missing field) fails CI with a clear message; a valid asset appears in the dev city without code changes. |
| **Contributor tasks** | Validation rules; packing script; "how to add a building" guide. |

### Milestone 4.2 — First art set

| | |
|---|---|
| **Objective** | The city looks like CommitCity, not like boxes. |
| **Scope** | Ground (grass, dirt, pavement), one road set (16 shapes), 3–4 tree types, and at least one building per footprint (1–4) for two families, each with `default` and `abandoned` variants. AI-assisted art allowed under `ART_DIRECTION.md` §14. |
| **Dependencies** | 4.1. |
| **Deliverables** | Asset folders with manifests; a screenshot of the medium fixture city. |
| **Acceptance criteria** | All assets pass validation and the review checklist (`ART_DIRECTION.md` §15); the medium fixture city has no placeholder visible at orientation 0. |
| **Contributor tasks** | Individual buildings (one issue per building); trees; road set. |

---

## Phase 5 — GitHub data and public pages *(v0.1 release)*

### Milestone 5.1 — GitHub adapter

| | |
|---|---|
| **Objective** | Real data in, `CityInput` out. |
| **Scope** | Server-side GraphQL adapter for public repositories owned by a user; normalization to `CityInput`; caching with revalidation; handling of unknown users, empty accounts, and rate-limit errors. Commit counts only if within budget (`ARCHITECTURE.md` §10). |
| **Dependencies** | 2.1. |
| **Deliverables** | `src/data/github`; recorded API responses for tests. |
| **Acceptance criteria** | Adapter tests run offline against recorded responses; a repeated lookup within the cache period makes no API call; errors produce typed results, not crashes. |
| **Contributor tasks** | Query design; normalization tests; error states. |

### Milestone 5.2 — Public city page and deployment

| | |
|---|---|
| **Objective** | Anyone can open `/u/<username>` and share it. |
| **Scope** | Home page with a username input; public city page; "last updated" indicator; loading and error states; deployment to Vercel's free tier. |
| **Dependencies** | 3.2, 4.2, 5.1. |
| **Deliverables** | Production deployment; v0.1 release notes. |
| **Acceptance criteria** | Two different people opening the same URL see the same city; the page works for a user with 1 repository and for one with ~300; the deployment stays within free-tier limits under expected load. |
| **Contributor tasks** | Home page; error and empty states; deployment docs. |

---

## Phase 6 — Polish and scale

Candidate milestones, refined when Phase 5 is done:

- **6.1 Social preview images** for city pages.
- **6.2 Mobile experience**: touch gestures, layout, performance on phones.
- **6.3 Large accounts**: aggregation above the individual-building limit; benchmark that sets the final limit.
- **6.4 Performance**: chunked ground caching, culling, Web Worker generation if needed.

---

## Later feature tracks

Unordered; each becomes a phase with its own milestones when picked up.

| Track | Key dependency or risk |
|---|---|
| **Four-direction rotation** | Art for four views of every building; renderer already rotation-compatible. |
| **Timelapse** | Positions are already stable; showing *growth* needs historical data (`ARCHITECTURE.md` §10). |
| **Day/night cycle** | Lights overlay layer in the art spec. |
| **Optional data sources** | Contributions and organizations; more API cost. |
| **Community building packs** | Asset pipeline (Phase 4) and contribution rules for art. |
| **Ambient life** | Traffic, animated props; performance budget. |
| **Spatial language districts** | Must not break placement stability. |

---

## First technical milestone: Isometric rendering spike

**Milestone 1.1.** The smallest piece of work that proves or disproves the core rendering direction.

### Objective

Prove that **PixiJS** can render a **pixel-perfect, correctly sorted, rotation-compatible isometric scene** at our target scale, and settle the **tile size**.

### What it answers

| Question | Answered by |
|---|---|
| Is PixiJS a good fit? | Scene renders correctly and the benchmark meets the target. |
| Does front-corner depth sorting work? | The "hard cases" scene shows no sorting errors in all four orientations. |
| Is the view transform rotation-compatible? | Toggling orientation re-sorts and re-positions correctly. |
| 32 × 16 or 64 × 32? | Side-by-side screenshots at 1×, 2×, 3× reviewed by maintainers. |
| Can we keep pixels crisp? | No blurring at any zoom or on a high-DPI screen. |

### Scope

- A dev page (`/dev/spike`) inside the skeleton from Milestone 1.0.
- A **hand-written scene JSON**: a small grid (for example 16 × 16) with ground, a few road tiles, and 6–10 buildings of footprints 1–4, including the hard cases: a tall building directly behind a short one, adjacent large and small buildings on both diagonals, and buildings touching map edges.
- **Placeholder sprites generated by code** following `ART_DIRECTION.md` (2:1 edges, three-tone shading, correct canvas and anchor), with a different face color per building side so that rotation errors are obvious.
- Projection, front-corner depth sorting, and the orientation view transform, implemented as pure functions with unit tests.
- Camera: drag to pan, wheel to zoom (integer levels), pixel-snapped.
- A **debug orientation toggle** (0–3). This is a test tool, not the rotation feature.
- A **benchmark mode**: 300 placeholder buildings plus full ground on a ~90 × 90 grid, with an FPS counter.
- A **tile size switch** between 32 × 16 and 64 × 32.

### Out of scope

The generator, real data, real art, the asset pipeline, the info panel, selection, UI styling, and deployment.

### Deliverables

- `/dev/spike` page and its scene file.
- Pure functions for projection, orientation transform, and depth sort, with tests.
- A short results report in the pull request: screenshots (both tile sizes, all orientations), benchmark numbers with device details, and a recommendation.
- Updated status of the related decisions in `ART_DIRECTION.md` and `ARCHITECTURE.md` (Proposal → Confirmed, or a change proposal).

### Acceptance criteria

1. The hard-cases scene renders with **no depth-sorting errors** in all four orientations, verified by screenshots.
2. Projection, orientation, and depth functions have unit tests, including all four orientations for a multi-tile building.
3. At every zoom level (1×–4×) and on a high-DPI display, pixels stay **crisp** (no smoothing, no sub-pixel shimmer while panning).
4. The benchmark scene runs at **≥ 60 fps while panning** on a mid-range laptop, and the result on a recent phone is recorded.
5. Maintainers make a recorded decision on the tile size.
6. `src/core` code in this milestone has no PixiJS or React imports.

### Suggested contributor tasks

- Placeholder sprite generator (a building box with shaded faces at any footprint and height).
- Projection and orientation functions plus tests.
- Depth-sort function plus a test for each hard case.
- Camera controls with pixel snapping.
- Benchmark scene and FPS overlay.

### If it fails

| Failure | Next step |
|---|---|
| Sorting errors with tall buildings | Try sprite slicing (`ARCHITECTURE.md` §7.2) within the same milestone. |
| Performance below target | Try ground caching into render textures; if still short, evaluate Canvas 2D in a follow-up spike. |
| Neither tile size looks right | Art direction revision before Phase 4. |

---

## Risks

| Risk | Impact | Likelihood | Mitigation | Validated by |
|---|---|---|---|---|
| **PixiJS is the wrong tool** (performance, pixel crispness, integration with Next.js) | High | Low | Keep rendering behind the `RenderList` boundary so the renderer can be replaced; Canvas 2D as fallback. | Milestone 1.1 |
| **Four-direction sprites multiply art effort** by up to 4× | High | High | Rotation deferred; only view 0 required now; symmetric buildings reuse one drawing; simpler silhouettes. | Rotation track |
| **Isometric depth sorting errors** with multi-tile buildings | High | Medium | Square footprints only; lots separate buildings; hard-case test scene; sprite slicing fallback. | Milestone 1.1 |
| **City instability** (buildings moving between visits) | High | Medium | One fixed lot per repository, chronological spiral, per-repository random streams, `generatorVersion`. Deletions remain a known limitation. | Milestone 2.2 tests |
| **No pixel artist; inconsistent or legally unclear AI art** | High | High | Strict art spec, validation in CI, review checklist, AI disclosure, replaceable assets, placeholders that already look coherent. | Phase 4 |
| **Rendering performance** on phones and large accounts | Medium | Medium | Individual-building limit with aggregation, culling, ground caching, Web Worker. | Milestones 1.1, 6.3 |
| **GitHub API limits and cost** (commit counts especially) | Medium | High | GraphQL, caching per user, cheaper activity signals, offline tests with recorded responses. | Milestone 5.1 |
| **Free-tier hosting limits** | Medium | Medium | Aggressive caching; no database until required. | Milestone 5.2 |
| **Scope creep** (simulation features, early polish) | Medium | High | Non-goals in `VISION.md`; strict phase scopes; ideas tracked separately from the roadmap. | Every review |
| **Few contributors** | Medium | Medium | Small, well-described issues; `good first issue` label; art tasks for non-programmers. | Phase 0 onward |

## Decision status summary

Detailed status lives in each document. The most important items:

| Decision | Status | Where |
|---|---|---|
| Visualization, not simulation | Confirmed | `VISION.md` |
| Deterministic, append-only layout | Confirmed | `VISION.md`, `ARCHITECTURE.md` |
| Pure generation separated from rendering | Confirmed | `ARCHITECTURE.md` |
| No database in current scope | Confirmed | `ARCHITECTURE.md` |
| MIT (code) and CC BY-SA 4.0 (art) | Confirmed | `CONTRIBUTING.md` |
| PixiJS, used imperatively | Proposal → Milestone 1.1 | `ARCHITECTURE.md` |
| Tile size 32 × 16 | Proposal → Milestone 1.1 | `ART_DIRECTION.md` |
| Front-corner depth sorting | Proposal → Milestone 1.1 | `ARCHITECTURE.md` |
| One 4×4 lot per repository | Proposal → Milestone 2.2/3.1 | `ARCHITECTURE.md` |
| Mapping thresholds (stars, commits) | Proposal → Milestone 5.1 with real data | `ARCHITECTURE.md` |
| Individual-building limit of 300 | Proposal → Milestone 6.3 | `VISION.md` |
| GitHub organization: `commitcity` | Confirmed | `CONTRIBUTING.md` |
| Activity signal if commit counts are too expensive | Open | `ARCHITECTURE.md` |
| History storage for growth timelapse | Open | `ARCHITECTURE.md` |
