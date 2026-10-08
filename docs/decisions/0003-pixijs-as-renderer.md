# 0003. PixiJS as the renderer, used imperatively

- **Status:** Proposed — to be validated by Milestone 1.1 (isometric rendering spike)
- **Date:** 2026-10-08
- **Related:** [`ARCHITECTURE.md` §2, §7](../ARCHITECTURE.md), [`ROADMAP.md` Milestone 1.1](../ROADMAP.md)

## Context

CommitCity renders a 2D isometric scene of potentially thousands of pixel-art sprites, which must stay crisp at integer zoom levels, be depth-sorted correctly, and run smoothly on laptops and phones. The application itself is built with Next.js and React.

## Decision

Use **PixiJS v8** as the renderer, **imperatively**, inside a single client-side React component. React is used for the UI around the canvas, not for individual sprites. `@pixi/react` is not used for now.

## Alternatives considered

- **@pixi/react**: declarative and familiar to React developers, but every sprite becomes a React element, adding reconciliation overhead and making sorting and culling harder to control.
- **Canvas 2D**: no dependency and simple, but no sprite batching and likely too slow at our target scale. Kept as the fallback.
- **Phaser**: a full game framework with physics and scenes we do not need; harder to embed in Next.js pages.
- **Three.js with an orthographic camera**: designed for 3D; fights pixel-perfect sprite rendering and contradicts the "not 3D" direction.

## Consequences

- Full control over batching, sorting, culling, and pixel snapping.
- Contributors working on the renderer need some PixiJS knowledge; the rest of the codebase does not.
- Because the renderer only consumes a render list (ADR 0001), replacing it later is contained.

## Validation

This ADR becomes `Accepted` if Milestone 1.1 meets its acceptance criteria: no depth-sorting errors in the hard-cases scene in all orientations, crisp pixels at all zoom levels, and at least 60 fps while panning the 300-building benchmark on a mid-range laptop.
