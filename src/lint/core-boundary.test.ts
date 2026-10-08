import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint();

async function ruleIdsFor(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((message) => message.ruleId ?? "");
}

describe("src/core import boundary", () => {
  it.each([
    'import { Application } from "pixi.js";',
    'import { useState } from "react";',
    'import Link from "next/link";',
    'import { draw } from "@/renderer/draw";',
  ])("rejects %s in src/core", async (code) => {
    const ruleIds = await ruleIdsFor(`${code}\nexport {};\n`, "src/core/example.ts");
    expect(ruleIds).toContain("no-restricted-imports");
  });

  it("rejects Math.random and Date.now in src/core", async () => {
    const code = "export const a = Math.random();\nexport const b = Date.now();\n";
    const ruleIds = await ruleIdsFor(code, "src/core/example.ts");
    expect(ruleIds.filter((id) => id === "no-restricted-properties")).toHaveLength(2);
  });

  it("allows PixiJS outside src/core", async () => {
    const code = 'import { Application } from "pixi.js";\nexport const app = Application;\n';
    const ruleIds = await ruleIdsFor(code, "src/renderer/example.ts");
    expect(ruleIds).not.toContain("no-restricted-imports");
  });
});
