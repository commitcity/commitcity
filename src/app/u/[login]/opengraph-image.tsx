import { cacheLife, cacheTag } from "next/cache";
import { cityTag, getCityInput } from "@/data/github";
import { genericPreview, previewImage } from "../../_preview/preview";

export const alt = "A GitHub account's public repositories as an isometric pixel-art city";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The shared card for `/u/<login>`: that city, or the generic card if it cannot be drawn. */
export default async function Image({ params }: { params: Promise<{ login: string }> }) {
  const { login } = await params;
  return new Response(await card(login.toLowerCase()), {
    headers: { "Content-Type": contentType },
  });
}

/** The PNG bytes, cached with the city data so crawlers do not redraw it. */
async function card(login: string): Promise<Uint8Array<ArrayBuffer>> {
  "use cache: remote";
  cacheTag(cityTag(login));
  const result = await getCityInput(login);
  if (!result.ok) {
    cacheLife("minutes");
    return bytes(await genericPreview());
  }
  cacheLife("days");
  const image = await previewImage(result.input, (buildings) => ({
    title: result.input.owner,
    note: `${buildings} ${buildings === 1 ? "building" : "buildings"}`,
  }));
  return bytes(image);
}

const bytes = async (response: Response) => new Uint8Array(await response.arrayBuffer());
