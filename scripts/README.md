# `scripts`

Development scripts, run with `tsx` so they share code with `src/core`.

| Command | What it does |
|---|---|
| `pnpm validate-assets [dir]` | Checks every building in `assets/` (or `dir`) against `docs/ART_DIRECTION.md`. Exits with 1 and lists the problems. Runs in CI. |
| `pnpm art` | Redraws the code-drawn art set (`scripts/art/`): ground, roads, vegetation and the buildings. `buildings.ts` draws the first brick and modern boxes; `models.ts` draws houses, industry, civic buildings and more brick and modern shapes as solids that `solids.ts` ray-casts onto the 2:1 grid. Overwrites those folders in `assets/`. |
| `pnpm record-github <login> [scenario]` | Records the GitHub API responses for a login into `fixtures/github/<scenario>/` for the adapter tests. Needs `GITHUB_TOKEN`. |
| `pnpm pack-assets [dir]` | Validates, then packs every sprite into `public/generated/assets/atlas.png` and `catalog.json`. Runs before `pnpm dev` and `pnpm build`. |
