# `fixtures`

Sample `CityInput` JSON files used in development and tests. All profiles are **synthetic**: owners, names, and numbers are made up, so no real person's data is stored here.

| File | Repositories | Purpose |
| --- | --- | --- |
| `tiny.json` | 2 | Smallest useful city. |
| `medium.json` | 30 | A typical profile. |
| `large.json` | 320 | Above the 300-building limit, to exercise aggregation later. |
| `edge-cases.json` | 12 | Forks, archived repos, missing language, unknown commit count, identical `createdAt`, star thresholds, non-ASCII names. |
| `spike/` | — | Hand-written scenes for the Milestone 1.1 rendering spike. Not `CityInput`. |

Every file must pass `parseCityInput` (`src/core/model/input.ts`); `src/core/model/input.test.ts` checks this. Dates are UTC ISO 8601 date-times.
