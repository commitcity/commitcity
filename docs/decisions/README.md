# Architecture Decision Records

This folder records the significant decisions of the CommitCity project: **what** was decided, **why**, and **which alternatives were rejected**. See [`CONTRIBUTING.md` §10](../../CONTRIBUTING.md#10-decision-making-and-governance) for when an ADR is needed.

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](./0001-separate-generation-from-rendering.md) | Separate city generation from rendering | Accepted |
| [0002](./0002-deterministic-append-only-layout.md) | Deterministic, append-only city layout | Accepted |
| [0003](./0003-pixijs-as-renderer.md) | PixiJS as the renderer, used imperatively | Proposed |
| [0004](./0004-licensing.md) | MIT for code, CC BY-SA 4.0 for art, DCO for contributions | Accepted |

## Rules

- File name: `NNNN-short-title.md`, numbered in order.
- Statuses: `Proposed`, `Accepted`, `Superseded by NNNN`, `Rejected`.
- An ADR is proposed in a pull request; merging it as `Accepted` is the decision.
- Accepted ADRs are not edited to change the decision. Write a new ADR that supersedes them.

## Template

```markdown
# NNNN. Title

- **Status:** Proposed
- **Date:** YYYY-MM-DD
- **Related:** links to documents, issues, or other ADRs

## Context

What problem are we solving? What constraints apply?

## Decision

What we decided, stated clearly.

## Alternatives considered

Each alternative and why it was not chosen.

## Consequences

What becomes easier, what becomes harder, and what we must watch.
```
