import type { Metadata } from "next";
import { parseSpikeParams } from "@/ui/spike/params";
import { SpikeView } from "@/ui/spike/SpikeView";

export const metadata: Metadata = {
  title: "Rendering spike · CommitCity",
  robots: { index: false },
};

export default async function SpikePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <SpikeView initial={parseSpikeParams(await searchParams)} />;
}
