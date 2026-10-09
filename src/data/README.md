# `src/data`

Adapters that turn external data (fixtures, the GitHub API) into `CityInput`. See [`docs/ARCHITECTURE.md` §10](../../docs/ARCHITECTURE.md#10-github-data).

| Module | What it does |
|---|---|
| `github/fetchCityInput.ts` | Fetches and normalizes one owner's public repositories. No Next.js; `fetch` and the clock are options, so tests replay `fixtures/github/` offline. |
| `github/getCityInput.ts` | The cached lookup pages call. Server only: reads `GITHUB_TOKEN`. |
| `github/normalize.ts` | API repository → `RepoInput`, checked with `parseCityInput`. |
| `github/query.ts` | The GraphQL query and the response types. |
