import { genericPreview } from "./_preview/preview";

export const alt = "CommitCity: a GitHub account's public repositories as a pixel-art city";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The shared card for the home page, drawn at build time. */
export default function Image() {
  return genericPreview();
}
