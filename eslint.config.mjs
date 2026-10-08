import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * `src/core` must stay pure: no UI or rendering libraries, no global randomness,
 * no clock. See docs/decisions/0001-separate-generation-from-rendering.md.
 */
const coreBoundary = {
  files: ["src/core/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["react", "react/*", "react-dom", "react-dom/*"],
            message: "src/core must not depend on React (ADR 0001).",
          },
          {
            group: ["next", "next/*"],
            message: "src/core must not depend on Next.js (ADR 0001).",
          },
          {
            group: ["pixi.js", "pixi.js/*", "@pixi/*"],
            message: "src/core must not depend on PixiJS (ADR 0001).",
          },
          {
            group: ["@/renderer/*", "@/ui/*", "@/app/*", "@/data/*"],
            message: "src/core must not import from higher layers (ARCHITECTURE.md §3).",
          },
        ],
      },
    ],
    "no-restricted-properties": [
      "error",
      {
        object: "Math",
        property: "random",
        message: "Use the seeded PRNG from src/core/random (ARCHITECTURE.md §5).",
      },
      {
        object: "Date",
        property: "now",
        message: "Generation must not read the clock (ARCHITECTURE.md §5).",
      },
    ],
  },
};

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  coreBoundary,
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
