import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { type CityInput, parseCityInput } from "@/core/model";
import { PREVIEW_PLAQUE, PREVIEW_SIZE, cityPreview } from "@/core/raster";
import { decodePng, encodePng, readPackedAssets } from "@/data/assets";
import medium from "../../../fixtures/medium.json";

// Social preview images (ARCHITECTURE.md §3, ART_DIRECTION.md §16): the city
// drawn on the server from the packed atlas, with the interface's wooden plaque
// and fonts on top. ImageResponse only adds the text.

const INK = "#2e222f";
const PAPER = "#fdcbb0";
const GOLD = "#f9c22b";
const MUTED = "#ab947a";

const root = process.cwd();

/** Everything a preview reads from disk, loaded once per server instance. */
const resources = (async () => {
  const [assets, panel, pixel, blackletter] = await Promise.all([
    readPackedAssets(),
    readFile(join(root, "public/generated/ui/panel-wood.png")),
    readFile(join(root, "assets/fonts/PixelifySans-Regular.woff")),
    readFile(join(root, "assets/fonts/Jacquard12-Regular.woff")),
  ]);
  if (!assets?.atlas) throw new Error("preview: no packed assets; run `pnpm pack-assets`");
  return {
    assets: { ...assets, atlas: assets.atlas },
    panel: decodePng(panel),
    pixel,
    blackletter,
  };
})();

export interface PreviewText {
  /** Paper-colored text after the CommitCity mark, such as the owner. */
  title: string;
  /** Muted text at the right end of the plaque. */
  note: string;
}

/** A 1200 × 630 PNG of `input`'s city with `text` on the plaque. */
export async function previewImage(input: CityInput, text: (buildings: number) => PreviewText) {
  const { assets, panel, pixel, blackletter } = await resources;
  const { image, buildings } = cityPreview(input, assets.packed, assets.atlas, panel);
  const { title, note } = text(buildings);
  const picture = encodePng(image);
  const { x, y, width, height, border } = PREVIEW_PLAQUE;
  const shadow = `0 2px 0 ${INK}`;

  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws plain <img> only. */}
      <img
        // @ts-expect-error Satori accepts image bytes; the DOM type wants a URL.
        src={picture.buffer.slice(picture.byteOffset, picture.byteOffset + picture.byteLength)}
        width={PREVIEW_SIZE.width}
        height={PREVIEW_SIZE.height}
        alt=""
      />
      <div
        style={{
          position: "absolute",
          left: x + border,
          top: y + border - 4,
          width: width - 2 * border,
          height: height - 2 * border,
          display: "flex",
          alignItems: "center",
          gap: 20,
          textShadow: shadow,
        }}
      >
        <span style={{ fontFamily: "Jacquard", fontSize: 48, color: GOLD }}>CommitCity</span>
        <span style={{ fontFamily: "Pixelify", fontSize: 32, color: PAPER }}>{title}</span>
        <span style={{ fontFamily: "Pixelify", fontSize: 24, color: MUTED, marginLeft: "auto" }}>
          {note}
        </span>
      </div>
    </div>,
    {
      ...PREVIEW_SIZE,
      fonts: [
        { name: "Pixelify", data: pixel, style: "normal", weight: 400 },
        { name: "Jacquard", data: blackletter, style: "normal", weight: 400 },
      ],
    },
  );
}

/** The sample city from the home page, for the home card and for errors. */
export const sampleCity = parseCityInput(medium);

/** The home page's card, also used when a user's city cannot be drawn. */
export function genericPreview() {
  return previewImage(sampleCity, () => ({
    title: "Your code. Your city.",
    note: "Any GitHub user as a pixel-art town",
  }));
}
