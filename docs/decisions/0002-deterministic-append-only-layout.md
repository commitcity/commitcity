# 0002. Deterministic, append-only city layout

- **Status:** Accepted
- **Date:** 2026-10-08
- **Related:** [`VISION.md` §4](../VISION.md), [`ARCHITECTURE.md` §5–6](../ARCHITECTURE.md)

## Context

A city is only meaningful if it is recognizable: the same user must see the same city every time, a shared link must show what its owner saw, and creating a new repository must not reshuffle the whole city. A timelapse feature also needs every building to keep its position over time.

## Decision

1. Generation is **deterministic**: same input, same catalog, and same `generatorVersion` produce an identical `CityModel`.
2. Randomness comes from a seeded PRNG with a **separate stream per repository**, seeded from the owner and repository id.
3. Repositories are placed in **creation order** along a fixed spiral of lots, so the city is **append-only**: new repositories take the next lot and nothing else moves.
4. Changes to a single repository (stars, activity, archival) affect only that repository's building.
5. `generatorVersion` is bumped whenever the output for the same input could change.

The specific lot geometry (one 4×4 lot per repository, blocks of 2×2 lots) is a **proposal** described in `ARCHITECTURE.md` §6.2 and will be confirmed by implementation milestones; it is not part of this decision.

## Alternatives considered

- **Global random seed**: adding one repository would change random choices everywhere.
- **Placement by language district**: a new language would require space and move other buildings.
- **Dense variable-size packing**: a building growing in size would push later buildings.
- **Persisting positions in a database**: perfectly stable even across deletions, but requires infrastructure we do not need yet.

## Consequences

- Cities are stable and shareable; timelapse placement comes for free.
- Deleting a repository, or changing the data scope, shifts newer buildings. This is an accepted limitation.
- Spatial language districts are deferred.
- Changing the algorithm is a visible event for users and must be versioned and announced.
