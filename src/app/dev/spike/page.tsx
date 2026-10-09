import { Suspense } from "react";
import type { Metadata } from "next";
import { parseSpikeParams } from "@/ui/spike/params";
import { SpikeView } from "@/ui/spike/SpikeView";

export const metadata: Metadata = {
  title: "Rendering spike · CommitCity",
  robots: { index: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// The query string is only known at request time, so the view renders inside
// Suspense and the rest of the page can still be prerendered (cacheComponents).
export default function SpikePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense>
      <View searchParams={searchParams} />
    </Suspense>
  );
}

async function View({ searchParams }: { searchParams: SearchParams }) {
  return <SpikeView initial={parseSpikeParams(await searchParams)} />;
}
