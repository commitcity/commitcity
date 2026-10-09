import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateCity } from "@/core/generation";
import { createCatalog, withPlaceholders } from "@/core/assets";
import { type FetchOptions, fetchCityInput, isValidLogin } from "./fetchCityInput";
import { PAGE_SIZE } from "./query";

interface Recording {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

const RECORDINGS = join(process.cwd(), "fixtures", "github");
const NOW = new Date("2026-10-09T12:00:00.000Z");

function recordings(scenario: string): Recording[] {
  const dir = join(RECORDINGS, scenario);
  return readdirSync(dir)
    .filter((f) => /^page-\d+\.json$/.test(f))
    .sort((a, b) => parseInt(a.slice(5)) - parseInt(b.slice(5)))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Recording);
}

/** A `fetch` that answers with a scenario's recordings, in order, and logs each request. */
function replay(scenario: string) {
  const queue = recordings(scenario);
  const requests: { url: string; init: RequestInit }[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    const next = queue.shift();
    if (!next) throw new Error(`no more recordings in ${scenario}`);
    return new Response(JSON.stringify(next.body), { status: next.status, headers: next.headers });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, requests };
}

function lookup(scenario: string, login = "octo-dev", extra: Partial<FetchOptions> = {}) {
  const { fetch, requests } = replay(scenario);
  const result = fetchCityInput(login, { token: "test-token", fetch, now: () => NOW, ...extra });
  return { result, requests };
}

describe("fetchCityInput", () => {
  it("pages through every repository and normalizes them", async () => {
    const { result, requests } = lookup("two-pages");
    const r = await result;
    if (!r.ok) throw new Error(r.error.kind);
    expect(requests).toHaveLength(2);
    expect(r.input.owner).toBe("Octo-Dev");
    expect(r.input.snapshotAt).toBe("2026-10-09T12:00:00.000Z");
    expect(r.input.repos.map((repo) => repo.name)).toEqual([
      "dotfiles",
      "pixel-garden",
      "react",
      "old-blog",
      "empty-idea",
      "release-notes",
    ]);
    const byName = new Map(r.input.repos.map((repo) => [repo.name, repo]));
    expect(byName.get("pixel-garden")).toEqual({
      id: "R_kgDOH00002",
      name: "pixel-garden",
      description: "The pixel-garden project",
      createdAt: "2019-07-21T18:30:00Z",
      pushedAt: "2025-06-30T21:04:11Z",
      primaryLanguage: "TypeScript",
      stars: 148,
      commitCount: 912,
      isFork: false,
      isArchived: false,
    });
    expect(byName.get("react")?.isFork).toBe(true);
    expect(byName.get("old-blog")).toMatchObject({ isArchived: true, description: null });
    expect(byName.get("empty-idea")).toMatchObject({ primaryLanguage: null, commitCount: null });
    expect(byName.get("release-notes")).toMatchObject({ commitCount: null, pushedAt: null });
  });

  it("sends the token, the login and the cursor of the previous page", async () => {
    const { result, requests } = lookup("two-pages");
    await result;
    const [first, second] = requests.map((r) => ({
      headers: r.init.headers as Record<string, string>,
      variables: JSON.parse(r.init.body as string).variables,
    }));
    expect(requests[0]!.url).toBe("https://api.github.com/graphql");
    expect(first!.headers.Authorization).toBe("Bearer test-token");
    expect(first!.variables).toEqual({ login: "octo-dev", first: PAGE_SIZE, after: null });
    expect(second!.variables.after).toBe("Y3Vyc29yOnYyOpHOAAAAAw==");
  });

  it("produces input that generation accepts", async () => {
    const r = await lookup("two-pages").result;
    if (!r.ok) throw new Error(r.error.kind);
    const city = generateCity(r.input, createCatalog(withPlaceholders([])));
    expect(city.buildings).toHaveLength(6);
  });

  it("stops after maxRepos", async () => {
    const { result, requests } = lookup("two-pages", "octo-dev", { maxRepos: 2 });
    const r = await result;
    expect(requests).toHaveLength(1);
    expect(r.ok && r.input.repos.map((repo) => repo.name)).toEqual(["dotfiles", "pixel-garden"]);
  });

  it("returns an empty city for an owner without public repositories", async () => {
    const r = await lookup("empty", "quiet-org").result;
    expect(r).toMatchObject({ ok: true, input: { owner: "quiet-org", repos: [] } });
  });

  it("keeps the data when only a commit count failed", async () => {
    const r = await lookup("partial").result;
    expect(r).toMatchObject({
      ok: true,
      input: { repos: [{ name: "monorepo", commitCount: null }] },
    });
  });

  it.each([
    ["not-found", { kind: "not-found" }],
    ["rate-limited", { kind: "rate-limited", resetAt: "2026-10-09T22:06:40.000Z" }],
    ["secondary-rate-limit", { kind: "rate-limited", resetAt: "2026-10-09T12:01:00.000Z" }],
    ["bad-credentials", { kind: "unauthorized" }],
    ["server-error", { kind: "unavailable", detail: "HTTP 502" }],
  ])("reports %s as a typed error", async (scenario, error) => {
    expect(await lookup(scenario).result).toEqual({ ok: false, error });
  });

  it("reports a not-found error on the owner itself", async () => {
    const fetch = (async () =>
      Response.json({
        data: { repositoryOwner: null },
        errors: [{ type: "NOT_FOUND", path: ["repositoryOwner"], message: "Could not resolve" }],
      })) as unknown as typeof globalThis.fetch;
    const r = await fetchCityInput("ghost", { token: "t", fetch });
    expect(r).toEqual({ ok: false, error: { kind: "not-found" } });
  });

  it("reports network failures and malformed responses as unavailable", async () => {
    const offline = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof globalThis.fetch;
    expect(await fetchCityInput("octo-dev", { token: "t", fetch: offline })).toEqual({
      ok: false,
      error: { kind: "unavailable", detail: "request failed: fetch failed" },
    });
    const html = (async () => new Response("<html>")) as unknown as typeof globalThis.fetch;
    expect(await fetchCityInput("octo-dev", { token: "t", fetch: html })).toEqual({
      ok: false,
      error: { kind: "unavailable", detail: "response is not JSON" },
    });
  });

  it("rejects bad logins and a missing token without a request", async () => {
    const { result, requests } = lookup("two-pages", "-bad-");
    expect(await result).toEqual({ ok: false, error: { kind: "invalid-login" } });
    const missing = lookup("two-pages", "octo-dev", { token: undefined });
    expect(await missing.result).toEqual({ ok: false, error: { kind: "unauthorized" } });
    expect(requests.length + missing.requests.length).toBe(0);
  });
});

describe("isValidLogin", () => {
  it.each(["a", "octo-dev", "Octo-Dev", "a1-b2-c3", "x".repeat(39)])("accepts %s", (login) =>
    expect(isValidLogin(login)).toBe(true),
  );
  it.each(["", "-a", "a-", "a--b", "a_b", "a.b", "x".repeat(40), "../etc"])("rejects %s", (login) =>
    expect(isValidLogin(login)).toBe(false),
  );
});
