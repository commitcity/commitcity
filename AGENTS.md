# Agent instructions

Guidance for AI coding tools (Claude Code, Cursor, Codex, Copilot and others) working in this repository. People: see `CONTRIBUTING.md` §13 for the policy on using AI.

## What this project is

CommitCity turns a GitHub account's public repositories into an isometric pixel-art city. Read `docs/VISION.md` for scope, `docs/ARCHITECTURE.md` for the design, `docs/ART_DIRECTION.md` for every art rule, and `docs/ROADMAP.md` for the current milestone. These documents are the source of truth; when code and docs disagree, ask instead of guessing.

## Layers (enforced by lint)

```
src/app       Next.js routes
src/ui        React components and hooks
src/renderer  PixiJS drawing, client only
src/data      adapters: fixtures and the GitHub API → CityInput
src/core      pure TypeScript: model, random, generation, view, assets
```

A layer imports only from layers below it. `src/core` must not import React, Next.js, PixiJS, browser APIs, `Math.random` or `Date.now`: generation is deterministic, so the same input always gives the same city (`docs/decisions/0001-*`, `0002-*`).

## Commands

| Command | Run it when |
|---|---|
| `pnpm install` | First, once |
| `pnpm dev` | Trying a change in the browser: `/dev/city` (fixture cities), `/u/<login>` (needs `GITHUB_TOKEN` in `.env.local`) |
| `pnpm test` | After any logic change; add tests for logic in `src/core` and `src/data` |
| `pnpm lint`, `pnpm typecheck`, `pnpm format:check` | Before every commit; CI runs all of them plus `pnpm build` |
| `pnpm validate-assets` | After any change in `assets/` |
| `pnpm art` | After changing the code-drawn art in `scripts/art/` |

## Conventions

- **English** for code, comments, docs, commits and pull requests.
- **Small pull requests**, one concern each, linked to an issue of the current phase. Use `.github/pull_request_template.md`.
- **Commits are signed off** for the DCO: `git commit -s`, with the contributor's own name and email.
- **No new dependencies** unless the issue agreed to them.
- **Never commit secrets.** The GitHub token lives in `.env.local`, which is not committed.
- **Generation output is a contract.** If a change alters the city for existing data, bump `generatorVersion` and say so in the pull request.
- **Art** follows `docs/ART_DIRECTION.md` exactly: the 2:1 grid, palette colors only, hard alpha, light from the upper left. Run `pnpm validate-assets`, then look at the result in `/dev/city`. For drawing art in code, use the skill in `.claude/skills/isometric-pixel-sprites/`.
- **Say how AI was used** in the pull request description, and set `"aiAssisted": true` in the manifest of any AI-assisted art.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
