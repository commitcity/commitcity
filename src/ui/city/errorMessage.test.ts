import { describe, expect, it } from "vitest";
import { errorMessage } from "./errorMessage";
import { parseViewParams, viewQuery } from "./params";

describe("errorMessage", () => {
  it("names the login that was not found", () => {
    expect(errorMessage("ghost", { kind: "not-found" }).title).toContain("ghost");
  });

  it("says when to retry after a rate limit", () => {
    const message = errorMessage("x", { kind: "rate-limited", resetAt: "2026-10-09T22:06:40Z" });
    expect(message).toMatchObject({ retry: true });
    expect(message.body).toContain("22:06");
  });

  it("offers a retry only for temporary problems", () => {
    expect(errorMessage("x", { kind: "unavailable", detail: "HTTP 502" }).retry).toBe(true);
    expect(errorMessage("x", { kind: "unauthorized" }).retry).toBe(false);
    expect(errorMessage("x", { kind: "invalid-login" }).retry).toBe(false);
  });
});

describe("view params", () => {
  it("round-trips orientation and selection", () => {
    const query = viewQuery({ orientation: 2, repo: "pixel-garden" });
    expect(query).toBe("o=2&repo=pixel-garden");
    expect(parseViewParams(Object.fromEntries(new URLSearchParams(query)))).toEqual({
      orientation: 2,
      zoom: null,
      repo: "pixel-garden",
    });
  });

  it("leaves defaults out of the URL", () => {
    expect(viewQuery({ orientation: 0, repo: null })).toBe("");
  });
});
