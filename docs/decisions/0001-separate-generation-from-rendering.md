# 0001. Separate city generation from rendering

- **Status:** Accepted
- **Date:** 2026-10-08
- **Related:** [`ARCHITECTURE.md` §1, §3](../ARCHITECTURE.md)

## Context

CommitCity must produce the same city for the same data, be testable without a browser, support rotation without regenerating the city, and possibly render preview images on the server. If placement logic lives inside the renderer, all of these become harder, and contributors working on generation would need to understand PixiJS.

## Decision

City generation is a **pure TypeScript function** (`CityInput + AssetCatalog → CityModel`) in `src/core`, with no I/O, DOM, React, PixiJS, Next.js, clock, or global randomness. A separate pure **view layer** converts the model and an orientation into a sorted render list. The renderer only draws that list.

Layers may import only from layers below them, enforced by lint rules.

## Alternatives considered

- **Generator inside the renderer** (for example, placing PixiJS sprites while generating): simpler at first, but untestable without a browser, tied to one rendering library, and hard to rotate.
- **Generation on the server only**: would require an API call for every view and prevent offline development with fixtures.

## Consequences

- Generation and view logic can be fully unit-tested and snapshot-tested.
- The renderer can be replaced (for example by Canvas 2D) without touching generation.
- Generation can move to a Web Worker or the server without redesign.
- Slightly more code up front: explicit model types and a render-list step.
