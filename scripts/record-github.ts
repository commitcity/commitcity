// Records the GitHub API responses for one login, for the adapter tests.
// Usage: GITHUB_TOKEN=... pnpm record-github <login> [scenario]
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchCityInput } from "../src/data/github/fetchCityInput";

const [login, scenario = login] = process.argv.slice(2);
if (!login) {
  console.error("Usage: pnpm record-github <login> [scenario]");
  process.exit(1);
}

const dir = join("fixtures", "github", scenario!);
const pages: unknown[] = [];
// Headers worth replaying; the rest (request ids, cookies) stay out of the repository.
const KEEP = /^(content-type|retry-after|x-ratelimit-(limit|remaining|reset|used|resource))$/;

const recording: typeof fetch = async (url, init) => {
  const response = await fetch(url, init);
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => null);
  const headers = Object.fromEntries([...response.headers].filter(([name]) => KEEP.test(name)));
  pages.push({ status: response.status, headers, body });
  return response;
};

async function main() {
  const result = await fetchCityInput(login!, {
    token: process.env.GITHUB_TOKEN,
    fetch: recording,
    endpoint: process.env.GITHUB_GRAPHQL_URL || undefined,
  });
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  pages.forEach((page, i) =>
    writeFileSync(join(dir, `page-${i + 1}.json`), JSON.stringify(page, null, 2) + "\n"),
  );
  console.log(
    result.ok
      ? `✓ ${result.input.repos.length} repositories of ${result.input.owner} in ${pages.length} pages → ${dir}`
      : `Recorded ${pages.length} pages → ${dir} (lookup result: ${result.error.kind})`,
  );
}

void main();
