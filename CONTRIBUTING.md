# Contributing to CommitCity

Thank you for your interest in CommitCity! This project is built by developers, pixel artists, and designers together, and every kind of contribution matters: code, art, documentation, testing, ideas, and reviews.

This guide explains **how the project is organized**, **how to contribute**, and **how decisions are made**.

> **Project status:** early development. Only the application skeleton exists so far; see [Development setup](#12-development-setup) to run it. Reviewing the documents in [`docs/`](./docs) and opening issues for anything unclear is still very helpful. See [`docs/ROADMAP.md`](./docs/ROADMAP.md).

---

## Table of contents

1. [Before you start](#1-before-you-start)
2. [Ways to contribute](#2-ways-to-contribute)
3. [GitHub organization and repositories](#3-github-organization-and-repositories)
4. [Contribution workflow](#4-contribution-workflow)
5. [Issues and labels](#5-issues-and-labels)
6. [Pull request guidelines](#6-pull-request-guidelines)
7. [Code review principles](#7-code-review-principles)
8. [Contributing art](#8-contributing-art)
9. [Documentation requirements](#9-documentation-requirements)
10. [Decision making and governance](#10-decision-making-and-governance)
11. [Licensing](#11-licensing)
12. [Development setup](#12-development-setup)

---

## 1. Before you start

- Read [`docs/VISION.md`](./docs/VISION.md) to understand what CommitCity is and, just as important, what it is **not** (see its *Non-goals*).
- Read [`docs/ROADMAP.md`](./docs/ROADMAP.md) to see the current phase. **Work outside the current phase is generally not accepted**, even if it is good work, because it makes the project harder to review and maintain.
- Follow our [Code of Conduct](./CODE_OF_CONDUCT.md). We adopt the Contributor Covenant, version 2.1.
- Technical documents, code, identifiers, commit messages, and issues are written in **English** so everyone can participate.

## 2. Ways to contribute

| You are… | You can… | Start with |
|---|---|---|
| A developer | Implement milestone tasks, write tests, review pull requests | Issues labeled `good first issue` or `help wanted` in the current phase |
| A pixel artist | Draw buildings, trees, ground and road tiles | [`docs/ART_DIRECTION.md`](./docs/ART_DIRECTION.md) and issues labeled `area: art` |
| A designer | Improve the UI, the info panel, the home page, the logo | Issues labeled `area: ui` |
| A writer | Improve documentation and guides | Issues labeled `type: docs` |
| A user | Report bugs, suggest ideas, share your city | Issue templates |

## 3. GitHub organization and repositories

The project lives under the [`commitcity`](https://github.com/commitcity) GitHub organization.

| Repository | Purpose | Status |
|---|---|---|
| `commitcity/commitcity` | **The main repository**: application code, assets, documentation, decisions | Planned |
| `commitcity/.github` | Organization-wide community files: default issue templates, Code of Conduct, organization profile | Planned |

**One main repository** keeps code, art, and documentation reviewed together, so a building and the code that uses it can never drift apart. A separate assets repository will be considered only if art becomes too large for the main repository.

### Teams

| Team | Responsibility |
|---|---|
| `maintainers` | Merge rights, roadmap, final decisions, releases |
| `art-reviewers` | Review art contributions against the art direction |
| `contributors` | Recognized regular contributors (triage rights) |

Teams are created as the community grows. Initially, the founding maintainer covers every role.

## 4. Contribution workflow

```
Find or open an issue ──► Discuss and get it assigned ──► Fork & branch
      ──► Small commits (signed off) ──► Pull request ──► Review ──► Merge
```

1. **Find or open an issue.** Every pull request (except typo fixes) must be linked to an issue. For anything larger than a small fix, discuss the approach in the issue **before** writing code.
2. **Get assigned.** Comment on the issue to ask for it. A maintainer assigns it to you. Unassigned work may conflict with someone else's.
3. **Fork and branch.** Create a branch from `main` named `<type>/<short-description>`, for example `feat/depth-sort` or `art/brick-office-small`.
4. **Commit with sign-off.** Use `git commit -s` (see [§11](#11-licensing)). Write commit messages in the [Conventional Commits](https://www.conventionalcommits.org/) style: `feat: add spiral lot enumeration`.
5. **Open a pull request** following the template and [§6](#6-pull-request-guidelines). Open it as a draft early if you want feedback.
6. **Address the review.** Push new commits. Do not force-push after the review has started, so reviewers can see what changed.
7. **Merge.** A maintainer merges with squash, so each pull request becomes one commit on `main`.

If an assigned issue sees no activity for a long time, a maintainer may ask whether you are still working on it and, without an answer, reassign it. That is never a judgment of you; life happens.

## 5. Issues and labels

### Issue templates

| Template | Use it for |
|---|---|
| **Bug report** | Something does not work as documented |
| **Feature proposal** | A new capability; must say which phase or later track it belongs to |
| **Art asset** | A building, tile, or prop to be drawn, with footprint, family, and references |
| **Decision proposal** | A significant technical or product decision (may lead to an ADR, see [§10](#10-decision-making-and-governance)) |

Every milestone task in the roadmap becomes an issue with **objective, scope, acceptance criteria, and pointers to the relevant documents**, so that it can be picked up without asking.

### Labels

Labels are grouped by prefix. Each issue should have one `type`, at least one `area`, and a `phase` when it belongs to the roadmap.

| Group | Labels |
|---|---|
| **Type** | `type: bug`, `type: feature`, `type: art`, `type: docs`, `type: chore`, `type: decision` |
| **Area** | `area: generation`, `area: rendering`, `area: ui`, `area: data`, `area: assets`, `area: art`, `area: infra`, `area: docs` |
| **Phase** | `phase: 0` … `phase: 6`, `phase: later` |
| **Status** | `status: needs-triage`, `status: needs-discussion`, `status: ready`, `status: in-progress`, `status: blocked` |
| **Community** | `good first issue`, `help wanted` |
| **Special** | `breaking-generation` (changes the city for existing users; see [§7](#7-code-review-principles)), `ai-assisted` (art made with AI assistance) |

An issue labeled `status: ready` has clear acceptance criteria and can be picked up immediately.

## 6. Pull request guidelines

### Size and focus

- **One concern per pull request.** A refactor, a feature, and an asset are three pull requests.
- **Keep it small.** As a guideline, under ~400 changed lines excluding tests, snapshots, and binary assets. Larger changes should be split; ask in the issue how.
- **No drive-by changes.** Unrelated formatting, renames, or "while I was here" fixes go in their own pull request.

### Content

Every pull request must:

- [ ] Link the issue it resolves (`Closes #123`).
- [ ] Describe **what changed and why** in plain language.
- [ ] Include **screenshots or a short recording** for any visual change.
- [ ] Include **tests** for logic in `src/core` (generation, view, random).
- [ ] Update **documentation** affected by the change ([§9](#9-documentation-requirements)).
- [ ] Pass CI: lint, type check, tests, and asset validation.
- [ ] Have every commit **signed off** (DCO).

Additionally:

- **No new dependencies** without prior agreement in the issue. Explain why the dependency is needed and what it costs (size, maintenance, license).
- **Changes to generation output** must bump `generatorVersion` and carry the `breaking-generation` label (see `docs/ARCHITECTURE.md` §5).
- **Pull request titles** follow Conventional Commits, because they become the squashed commit message.

## 7. Code review principles

Reviews keep the project healthy. They are about the code, never about the person.

**For reviewers**

- Review against the documents: does the change match the vision, architecture, art direction, and the milestone's acceptance criteria?
- Separate **blocking** comments from suggestions. Prefix optional comments with `nit:` or `suggestion:`.
- Explain *why* when you ask for a change, and link the relevant document section when possible.
- Prefer approving with small suggestions over blocking on matters of taste.
- Respond to a pull request within a reasonable time. If you cannot review it, say so.

**What reviewers check**

| Area | Checks |
|---|---|
| All | Scope matches the issue; nothing out of phase; docs updated |
| `src/core` | Pure (no React, PixiJS, Next.js, browser APIs, `Math.random`, `Date.now`); deterministic; tested |
| Generation changes | `generatorVersion` bumped if output changes; snapshots updated intentionally |
| Rendering | Pixel crispness; no depth-sorting regressions; performance not degraded |
| Art | `docs/ART_DIRECTION.md` §15 checklist; manifest complete; license and AI disclosure |
| Dependencies | Agreed beforehand; license compatible |

**Approvals**

- Every pull request needs **one maintainer approval**.
- Art pull requests also need approval from an **art reviewer** (when that team exists).
- Changes to `docs/VISION.md`, the roadmap, licenses, or governance need approval from **two maintainers** (when there are two or more).

**For authors**

- Every comment deserves a response: a change, a question, or an explanation of why not.
- Disagreement is fine. If a discussion stalls, move it to the issue or ask a maintainer to decide.

## 8. Contributing art

1. Pick an issue labeled `area: art`, or open an **Art asset** issue proposing what you want to draw.
2. Follow [`docs/ART_DIRECTION.md`](./docs/ART_DIRECTION.md) exactly: projection, tile size, canvas and anchor, palette, light, outlines.
3. Add a folder under `assets/buildings/` with your PNG files and a `manifest.json`, including your name in `authors` ([`assets/README.md`](./assets/README.md)). Run `pnpm validate-assets` until it passes; CI runs it too.
4. If you used AI tools, set `"aiAssisted": true`, name the tool in the pull request, and follow §14 of the art direction.
5. Include a screenshot of the asset placed next to existing assets at 1× and 2×.

You keep the copyright of your art. By contributing, you license it under CC BY-SA 4.0 (see [§11](#11-licensing)), and you are credited in the manifest and in the credits page.

## 9. Documentation requirements

Documentation is part of the work, not an afterthought.

- A pull request that changes behavior described in a document **updates that document in the same pull request**.
- Every decision in a document is marked **Confirmed**, **Proposal**, or **Open**. Do not silently turn a proposal into a confirmed decision; that happens through review ([§10](#10-decision-making-and-governance)).
- Exported functions and types in `src/core` have short TSDoc comments explaining *what* and *why*.
- Each milestone that validates a proposal (for example the rendering spike) includes its **results** in the pull request and updates the decision status.
- New documents are created only when an existing one cannot reasonably hold the content. Prefer extending the current documents:

| Document | Contains |
|---|---|
| `README.md` | Pitch, status, links |
| `docs/VISION.md` | Product vision, experience, scope, non-goals |
| `docs/ART_DIRECTION.md` | Art rules and asset specification |
| `docs/ARCHITECTURE.md` | Technical design and generation algorithm |
| `docs/ROADMAP.md` | Phases, milestones, risks |
| `docs/decisions/` | Architecture Decision Records |
| `CONTRIBUTING.md` | This guide |

## 10. Decision making and governance

### Model

CommitCity starts with a **single founding maintainer** who has the final word, and aims to move to a **maintainer team** as trusted contributors appear.

| Stage | Who decides | How |
|---|---|---|
| **Now** | Founding maintainer | Decisions discussed openly in issues; final call by the maintainer |
| **Later** (2+ active maintainers) | Maintainer team | Lazy consensus: a proposal is accepted if no maintainer objects after a reasonable discussion period. Unresolved objections go to a vote of maintainers. |

### Becoming a maintainer

Contributors who have made sustained, high-quality contributions and reviews, and who act in line with the Code of Conduct, may be invited by existing maintainers. Art reviewers are invited the same way, based on art contributions and reviews.

### Architecture Decision Records (ADRs)

Significant decisions are recorded as short ADRs in `docs/decisions/`, so anyone can see **what** was decided, **why**, and **what alternatives were rejected**.

- File name: `NNNN-short-title.md`, for example `0001-pixijs-as-renderer.md`.
- Sections: **Context**, **Decision**, **Alternatives considered**, **Consequences**, **Status** (`Proposed`, `Accepted`, `Superseded by NNNN`).
- An ADR starts as `Proposed` in a pull request; merging it as `Accepted` is the decision.
- Accepted ADRs are never edited to change the decision; a new ADR supersedes them.

What needs an ADR: choice or replacement of a core technology, changes to the generation algorithm's guarantees, changes to the art specification that affect existing assets, licensing changes, and governance changes.

### Scope discipline

New ideas are welcome, but they go to issues labeled `phase: later` until the roadmap includes them. Keeping the current phase small is how the project stays finishable.

## 11. Licensing

CommitCity uses **different licenses for code and art**, because they are different kinds of work.

| What | License | File |
|---|---|---|
| Source code, scripts, configuration | **MIT** | `LICENSE` |
| Artwork in `assets/` (sprites, tiles, palettes, logos) | **CC BY-SA 4.0** | `ASSETS_LICENSE` |
| Documentation | MIT, like the code | `LICENSE` |

What this means:

- Anyone can reuse the **code** freely, including commercially, as long as they keep the copyright notice.
- Anyone can reuse the **art**, including commercially, as long as they **credit the authors** and **share their modifications of the art under the same license**.
- The two are separate works: using CommitCity's code does not require using its art, and the share-alike condition applies to the art only.

### Developer Certificate of Origin (DCO)

Instead of a Contributor License Agreement, we use the [Developer Certificate of Origin](https://developercertificate.org/). By signing off a commit, you certify that you wrote the contribution or otherwise have the right to submit it under the project's licenses.

Sign off every commit with:

```bash
git commit -s -m "feat: add spiral lot enumeration"
```

This adds a line like `Signed-off-by: Your Name <you@example.com>`. A CI check rejects pull requests with unsigned commits.

### Third-party material

- Do not submit code, art, or data you do not have the right to license under the terms above.
- Never submit material copied, traced, or derived from TheoTown or any other game. TheoTown is a visual reference only.
- AI-assisted art must follow `docs/ART_DIRECTION.md` §14.
- Third-party code dependencies must have licenses compatible with MIT.

## 12. Development setup

### Requirements

- **Node.js 22** or newer (the exact major version is in [`.nvmrc`](./.nvmrc))
- **pnpm 10**: run `corepack enable` once and Node will use the version pinned in `package.json`

### First run

```bash
git clone https://github.com/<your-username>/commitcity.git
cd commitcity
pnpm install
pnpm dev
```

Open http://localhost:3000.

### Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Starts the development server |
| `pnpm build` | Builds the production app |
| `pnpm lint` | Runs ESLint, including the `src/core` purity rules |
| `pnpm typecheck` | Runs the TypeScript compiler without emitting files |
| `pnpm test` | Runs the unit tests once (`pnpm test:watch` to keep them running) |
| `pnpm format` | Formats code with Prettier (`pnpm format:check` only checks) |

CI runs `format:check`, `lint`, `typecheck`, `test`, and `build` on every pull request. Run them locally before pushing.

### Layer rules enforced by lint

Code in `src/core` must stay pure ([ADR 0001](./docs/decisions/0001-separate-generation-from-rendering.md)). ESLint rejects, inside `src/core`:

- imports of React, Next.js, or PixiJS;
- imports from higher layers (`src/renderer`, `src/ui`, `src/app`, `src/data`);
- `Math.random` and `Date.now`.

---

Questions? Open an issue with the `status: needs-discussion` label. Thank you for helping build CommitCity!
