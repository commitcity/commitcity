import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  cacheComponents: true,
  partialPrefetching: true,
  // Social preview images read the packed atlas, the wooden panel and the fonts
  // from disk (src/app/_preview), which tracing cannot see.
  outputFileTracingIncludes: {
    "/**/*-image": [
      "./public/generated/assets/**/*",
      "./public/generated/ui/panel-wood.png",
      "./assets/fonts/*.woff",
    ],
  },
};

export default nextConfig;
