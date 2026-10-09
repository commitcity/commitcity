# `scripts`

Development scripts, run with `tsx` so they share code with `src/core`.

| Command | What it does |
|---|---|
| `pnpm validate-assets [dir]` | Checks every building in `assets/` (or `dir`) against `docs/ART_DIRECTION.md`. Exits with 1 and lists the problems. Runs in CI. |
| `pnpm pack-assets [dir]` | Validates, then packs every sprite into `public/generated/assets/atlas.png` and `catalog.json`. Runs before `pnpm dev` and `pnpm build`. |
