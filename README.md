# CommitCity

> **Your code. Your city.**

CommitCity turns a developer's GitHub history into a living, isometric **pixel-art city**. Every repository becomes a building. Its size, style, and condition come from real data — stars, languages, activity, age — and the city grows outward over time, with your oldest projects at its heart.

Explore it like a small city-builder: pan, zoom, click a building to see the repository behind it, and share a link to your city.

---

## Status

🚧 **Phase 5 — GitHub data and public pages.** Open `/u/<username>` to see a real city; the first public release (v0.1) follows the deployment.

| Phase | Name | Status |
|---|---|---|
| 0 | Specification | Done |
| 1 | Rendering foundation | Done |
| 2 | Deterministic generation | Done |
| 3 | Explorable fixture city | Done |
| 4 | Asset pipeline and first art | Done |
| 5 | GitHub data and public pages (v0.1) | **In progress** |
| 6 | Polish and scale | Planned |

See the full [roadmap](./docs/ROADMAP.md).

## What makes it different

- **Authentic pixel art**, not low-poly 3D: dense isometric streets, buildings, and trees.
- **Deterministic**: the same data always produces the same city, and new repositories never move existing buildings.
- **Data-driven buildings**: artists add buildings as an image plus a small manifest — no code required.
- **Community-built**: code and art are open, licensed, and credited.

CommitCity is a **visualization, not a simulation**: no budgets, taxes, or disasters. TheoTown is our main *visual* reference; all CommitCity artwork is original or properly licensed.

## Documentation

| Document | What it covers |
|---|---|
| [Vision](./docs/VISION.md) | What CommitCity is, who it is for, scope and non-goals |
| [Art Direction](./docs/ART_DIRECTION.md) | Pixel-art rules, tile and sprite specification, AI-assisted art policy |
| [Architecture](./docs/ARCHITECTURE.md) | Stack, system layers, data models, procedural generation |
| [Roadmap](./docs/ROADMAP.md) | Phases, milestones, acceptance criteria, risks |
| [Deployment](./docs/DEPLOYMENT.md) | Running CommitCity on Vercel's free tier |
| [Decisions](./docs/decisions/) | Architecture Decision Records |
| [Contributing](./CONTRIBUTING.md) | How to contribute code, art, and docs; governance; licensing |

## Planned stack

Next.js · TypeScript · PixiJS · Tailwind CSS · Zustand · Vitest — hosted on a free tier. See [Architecture](./docs/ARCHITECTURE.md) for what is confirmed and what is still being validated.

## Contributing

Developers, pixel artists, designers, and writers are all welcome. Start with [CONTRIBUTING.md](./CONTRIBUTING.md), then look for issues labeled `good first issue`.

Right now, the most helpful contribution is **reading the documents and opening issues** for anything unclear, missing, or wrong.

## License

- **Code and documentation:** [MIT](./LICENSE)
- **Artwork** (`assets/`): [CC BY-SA 4.0](./ASSETS_LICENSE)

Contributions are accepted under the [Developer Certificate of Origin](https://developercertificate.org/). Please follow our [Code of Conduct](./CODE_OF_CONDUCT.md).
