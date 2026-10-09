import type { Metadata } from "next";
import { UiGallery } from "@/ui/kit/UiGallery";

export const metadata: Metadata = {
  title: "Interface kit · CommitCity",
  robots: { index: false },
};

/** Every interface piece in one place, for reviewing art changes (ART_DIRECTION.md §16). */
export default function UiPage() {
  return <UiGallery />;
}
