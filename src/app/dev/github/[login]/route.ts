import { type GitHubError, getCityInput } from "@/data/github";

const STATUS: Record<GitHubError["kind"], number> = {
  "invalid-login": 400,
  "not-found": 404,
  "rate-limited": 429,
  unauthorized: 500,
  unavailable: 502,
};

/** Dev endpoint for milestone 5.1: the `CityInput` for a login, or its typed error, as JSON. */
export async function GET(_request: Request, { params }: { params: Promise<{ login: string }> }) {
  const result = await getCityInput((await params).login);
  return Response.json(result, { status: result.ok ? 200 : STATUS[result.error.kind] });
}
