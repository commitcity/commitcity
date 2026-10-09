# GitHub API recordings

Responses of the GitHub GraphQL API, replayed by the adapter tests in `src/data/github` so they run offline. Each scenario is a folder with one file per request, in order: `{ status, headers, body }`.

| Scenario | What it covers |
|---|---|
| `two-pages` | Pagination; a fork, an archived repository, an empty repository (no default branch), a branch pointing at a tag, empty and missing descriptions and languages |
| `empty` | An owner with no public repositories |
| `not-found` | A login that does not exist |
| `partial` | A commit count that timed out, reported as an error next to the data |
| `rate-limited` | The hourly GraphQL budget is used up |
| `secondary-rate-limit` | Too many requests in a short time (HTTP 403 with `retry-after`) |
| `bad-credentials` | A wrong or expired token (HTTP 401) |
| `server-error` | A GitHub outage (HTTP 502) |

The files follow the documented response shapes; repository names and ids are made up. To record real responses for a login, set `GITHUB_TOKEN` and run:

```sh
pnpm record-github <login> [scenario]
```

It writes `fixtures/github/<scenario>/` (default: the login). Check the result for anything you would not publish before committing it.
