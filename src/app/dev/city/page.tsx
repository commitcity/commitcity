import { Suspense } from "react";
import type { Metadata } from "next";
import { parseCityParams } from "@/ui/city/params";
import { CityView } from "@/ui/city/CityView";

export const metadata: Metadata = {
  title: "City preview · CommitCity",
  robots: { index: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// The query string is only known at request time, so the view renders inside
// Suspense and the rest of the page can still be prerendered (cacheComponents).
export default function CityPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense>
      <View searchParams={searchParams} />
    </Suspense>
  );
}

async function View({ searchParams }: { searchParams: SearchParams }) {
  return <CityView initial={parseCityParams(await searchParams)} />;
}
