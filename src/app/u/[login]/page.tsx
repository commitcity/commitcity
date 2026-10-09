import type { Metadata } from "next";
import { Suspense } from "react";
import { getCityInput } from "@/data/github";
import { CityMessage } from "@/ui/city/CityMessage";
import { PublicCityView } from "@/ui/city/PublicCityView";
import { errorMessage } from "@/ui/city/errorMessage";
import { parseViewParams } from "@/ui/city/params";

type Params = Promise<{ login: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { login } = await params;
  return {
    title: `${login} · CommitCity`,
    description: `The public GitHub repositories of ${login}, as an isometric pixel-art city.`,
  };
}

export default function UserCityPage(props: { params: Params; searchParams: SearchParams }) {
  return (
    <Suspense fallback={<CityMessage title="Building the city…" />}>
      <UserCity {...props} />
    </Suspense>
  );
}

async function UserCity({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { login } = await params;
  const result = await getCityInput(login);
  if (!result.ok) {
    const message = errorMessage(login, result.error);
    return (
      <CityMessage
        title={message.title}
        retryHref={message.retry ? `/u/${encodeURIComponent(login)}` : undefined}
      >
        {message.body}
      </CityMessage>
    );
  }
  return <PublicCityView input={result.input} initial={parseViewParams(await searchParams)} />;
}
