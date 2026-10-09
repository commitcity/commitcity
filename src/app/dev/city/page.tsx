import type { Metadata } from "next";
import { parseCityParams } from "@/ui/city/params";
import { CityView } from "@/ui/city/CityView";

export const metadata: Metadata = {
  title: "City preview · CommitCity",
  robots: { index: false },
};

export default async function CityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CityView initial={parseCityParams(await searchParams)} />;
}
