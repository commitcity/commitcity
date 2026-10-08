# CommitCity — Product Vision

> **Your code. Your city.**

| | |
|---|---|
| **Status** | Draft — Phase 0 (Discovery & Specification) |
| **Audience** | Contributors, designers, pixel artists, and anyone evaluating the project |
| **Related docs** | [`ART_DIRECTION.md`](./ART_DIRECTION.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`ROADMAP.md`](./ROADMAP.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md) |

This document defines **what** CommitCity is and **why** it exists. It intentionally avoids implementation detail. Technical choices live in `ARCHITECTURE.md`; visual rules live in `ART_DIRECTION.md`.

Every statement in this document is tagged with one of three scope levels (see [Scope](#5-scope)):

- **Current scope** — what we are building toward now.
- **Later** — planned, but not before the current scope is solid.
- **Ideas** — interesting, not committed, open for discussion.

---

## 1. What CommitCity is

CommitCity turns a developer's GitHub history into a **living, isometric pixel-art city**.

Each repository becomes a building. How a repository looks — its size, style, district, and condition — is derived from real data: languages, stars, commit activity, age, and status. The city is **generated deterministically**: the same input always produces the same city, and a city grows outward over time instead of reshuffling itself.

Users can explore their city like a small city-builder game: pan, zoom, inspect buildings, and share a public link to their city.

CommitCity is **a visualization, not a simulation**. It borrows the *look and feel* of city-builder games, not their economic or management systems.

## 2. Who it is for

| Audience | What they get |
|---|---|
| **Developers** (primary) | A beautiful, personal artifact that represents their work and that they want to share. |
| **Recruiters, peers, and communities** | A more memorable way to browse someone's body of work than a list of repositories. |
| **Pixel artists and designers** | A real, visible, open-source project where their artwork is credited and used by many people. |
| **Open-source contributors** | A friendly, well-documented project with clear, small tasks across code and art. |

## 3. The problem it solves

A GitHub profile is a list. It shows *what* exists but not the *shape* of a developer's journey: which projects grew, which were abandoned, what languages dominate, how activity changed over time.

Contribution graphs exist, but they are flat, abstract, and identical in form for everyone.

CommitCity gives that history **a place**: something spatial, explorable, personal, and fun — a portfolio people actually *want* to show.

## 4. What makes it different

- **Authentic pixel art, not low-poly 3D.** The visual target is detailed isometric sprite art in the spirit of TheoTown: streets, modular buildings, vegetation, and small ambient details.
- **Deterministic and stable.** A city is a pure function of its input data. Adding a repository never moves existing buildings. This makes cities recognizable over time and enables timelapses.
- **Data-driven buildings.** Building types are defined by data (a sprite plus a manifest), not by code. Artists can contribute buildings without touching the renderer — similar in spirit to TheoTown's plugin system.
- **Community-built.** Code *and* art are open, licensed, and credited. The project is designed from day one to accept contributions from non-programmers.

### Visual reference and originality

TheoTown is the **primary visual reference**. It is a reference only: CommitCity does not copy, extract, trace, or redistribute any TheoTown artwork, data, or code. All assets must be original or properly licensed.

---

## 5. Scope

### 5.1 Current scope

The minimum experience we are building toward:

1. **Generate a city from repository data** for a single GitHub user (initially from static fixture data, later from the GitHub API).
2. **Render the city** as an isometric pixel-art scene: ground tiles, roads, buildings, and simple vegetation.
3. **Explore the city**: pan and zoom with mouse, trackpad, and touch.
4. **Inspect a building**: select it to see the repository it represents.
5. **Public city page**: a shareable URL for a user's city.

Data source in current scope: **public repositories owned by the user**.

### 5.2 Later

- **Four-direction rotation** of the view in 90° steps. *Deferred, but the data model and generator must be rotation-compatible from the start* (see `ARCHITECTURE.md`).
- **Timelapse**: replay how the city grew over time.
- **Optional data sources**, chosen by the user: contributions to other people's repositories, organization repositories.
- **Day/night cycle** with lit windows reflecting recent activity.
- **Community building packs** (sprite + manifest) loaded by the renderer.
- **Share images** (social preview of a city).

### 5.3 Ideas (not committed)

- Animated traffic whose density reflects commit activity.
- Seasons and weather.
- Comparing or connecting cities of collaborators.
- Private repositories (requires authentication; see [Non-goals](#8-non-goals)).
- Landmarks for special achievements (for example, a first repository with 1,000 stars).

---

## 6. Core experience

### 6.1 User journeys

**J1 — "See my city" (current scope)**
1. A visitor enters a GitHub username.
2. CommitCity fetches (or loads cached) public repository data.
3. A city is generated and displayed.
4. The visitor pans, zooms, and clicks buildings.

**J2 — "Share my city" (current scope)**
1. A developer opens their city.
2. They copy the public URL (for example, `/u/<username>`).
3. Anyone opening the link sees the same city, because generation is deterministic.

**J3 — "Watch my city grow" (later)**
1. A developer opens the timelapse control.
2. The city is replayed from the first repository to today; buildings appear and level up as activity accumulates.

**J4 — "Contribute a building" (later, contributor journey)**
1. A pixel artist follows `ART_DIRECTION.md` to draw a building.
2. They add the sprite and a small manifest file in a pull request.
3. Once merged, the building can appear in any city whose repositories match its rules.

### 6.2 City exploration

- **Pan**: drag (mouse or touch), keyboard arrows.
- **Zoom**: wheel, pinch, keyboard. Zoom levels are **integer scale factors** to keep pixels crisp.
- **Rotate** *(later)*: four discrete orientations (N, E, S, W), switched with buttons or keys. No free rotation.
- The camera is bounded to the city's extent.

### 6.3 Repository representation

Each repository maps to **exactly one building**. The mapping below is a **proposal**; the final rules are specified in `ARCHITECTURE.md` and must be deterministic.

| Repository property | Proposed visual effect | Status |
|---|---|---|
| Primary language / topic | Architectural style (spatial districts later, see `ARCHITECTURE.md` §6.4) | Proposal |
| Stars | Building size / footprint and height | Proposal |
| Commit activity (total) | Building level (grows like TheoTown buildings) | Proposal |
| Recent activity | Lit windows, small ambient details | Later |
| Creation date | Position: older repositories near the center | Proposal |
| Archived | Abandoned / decayed variant | Proposal |
| Fork | Smaller, annex-style building | Confirmed |

Mechanics borrowed from city builders, **as visualization only**:

- **Zoning → districts** by language or topic.
- **Building levels → repository growth.**
- **Abandonment → archived repositories.**
- **Parks and vegetation → filler and decoration** between buildings.

### 6.4 Building interactions

- **Hover**: highlight the building.
- **Select**: open an info panel with the repository's name, description, primary language, stars, last activity, and a link to GitHub.
- Selection is reflected in the URL so a specific building can be shared.

### 6.5 Four-direction rotation *(later)*

Rotation is part of the long-term experience but **not** part of the current scope, because it multiplies the art required per building. To avoid a costly rewrite later:

- City data uses **world coordinates independent of view orientation**.
- Buildings declare which orientations they support; missing orientations fall back to an allowed alternative (detailed in `ART_DIRECTION.md`).

### 6.6 Public city profiles

- One public page per GitHub user, available without signing in.
- The page shows the city plus a small summary (repository count, top languages).
- Data is cached to respect GitHub API limits; the page shows when it was last updated.

### 6.7 City size

- **Small histories get small towns.** A user with one or two repositories gets a small village. The city is never padded with neutral filler buildings to look bigger.
- **Large histories are capped.** Up to **300 repositories** are rendered as individual buildings. Above that, the least significant repositories (lowest activity and stars, forks and archived first) are aggregated into generic neighborhood blocks, which can be expanded in the info panel. The number 300 is a **proposal** to be validated by a rendering benchmark (see `ROADMAP.md`).

---

## 7. Long-term direction

1. **A beautiful, stable, shareable city** for any public GitHub user. *(Current scope.)*
2. **A city with time**: timelapse, day/night, building growth. *(Later.)*
3. **A city with a community**: artist-contributed building packs, credits, and themes. *(Later.)*
4. **A richer city**: optional data sources, ambient life, special landmarks. *(Ideas.)*

Each step must be complete and polished before the next begins.

## 8. Non-goals

These are explicitly **out of scope** and should not be added without a new discussion:

- **City-management simulation**: no budget, taxes, power, water, happiness, or citizen needs.
- **Disasters or destructive events.**
- **Free camera rotation or 3D rendering.**
- **User accounts and login** in the current scope. Public data only.
- **Private repositories** in the current scope.
- **Ranking or comparing developers** by score.
- **Paid features or monetization.**

## 9. Guiding principles

1. **Small, verifiable steps.** Every milestone is independently testable and reviewable.
2. **Determinism over randomness.** Same input, same city — always.
3. **Pixel integrity.** No blurry scaling, no mixed pixel densities.
4. **Data-driven content.** New buildings should not require code changes.
5. **Contributor-friendly.** Documentation is a feature; non-programmers are first-class contributors.
6. **No premature complexity.** No services, databases, or abstractions before they are needed.
7. **Free to run.** The project must be able to operate on free hosting tiers.

## 10. Decisions recorded in this document

| Decision | Status |
|---|---|
| CommitCity is a visualization, not a simulation | Confirmed |
| TheoTown is a visual reference only; all assets original or licensed | Confirmed |
| Deterministic, append-only city layout | Confirmed |
| Current-scope data: public repositories owned by the user | Confirmed |
| Four-direction rotation deferred; architecture stays rotation-compatible | Confirmed |
| Timelapse planned (later) | Confirmed |
| Optional data sources selectable by the user (later) | Confirmed |
| Buildings defined by data (sprite + manifest) | Confirmed |
| Free hosting tier (Vercel proposed) | Proposal — see `ARCHITECTURE.md` |
| Code under MIT, artwork under CC BY-SA 4.0 | Confirmed — details in `CONTRIBUTING.md` |
| Repository-to-building mapping table | Proposal |
| Forks are shown as smaller, annex-style buildings | Confirmed |
| Small histories are shown as small villages, without filler | Confirmed |
| Individual-building limit of 300 repositories, then aggregation | Proposal — needs benchmark |
| GitHub organization: [`commitcity`](https://github.com/commitcity) | Confirmed |

## 11. Open questions

1. Who is the first pixel artist, and how do we attract them? Until then, the project uses code-generated placeholder art.
