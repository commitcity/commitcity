import type { GitHubError } from "@/data/github/fetchCityInput";

export interface Message {
  title: string;
  body: string;
  /** Offer to try the same page again (the problem may be temporary). */
  retry: boolean;
}

const timeFormat = new Intl.DateTimeFormat("en", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
  timeZoneName: "short",
});

/** What the public page says when a city cannot be built. */
export function errorMessage(login: string, error: GitHubError): Message {
  switch (error.kind) {
    case "invalid-login":
      return {
        title: "That is not a GitHub username",
        body: "Usernames use letters, numbers and single hyphens, up to 39 characters.",
        retry: false,
      };
    case "not-found":
      return {
        title: `No GitHub account called “${login}”`,
        body: "Check the spelling, or try another user or organization.",
        retry: false,
      };
    case "rate-limited":
      return {
        title: "GitHub needs a short break",
        body: error.resetAt
          ? `Too many cities were built recently. Try again after ${timeFormat.format(new Date(error.resetAt))}.`
          : "Too many cities were built recently. Try again in a few minutes.",
        retry: true,
      };
    case "unauthorized":
      return {
        title: "This server cannot reach GitHub",
        body: "Its GitHub token is missing or expired. If you run this site, see docs/DEPLOYMENT.md.",
        retry: false,
      };
    case "unavailable":
      return {
        title: "GitHub did not answer",
        body: "It may be a short outage. Try again in a moment.",
        retry: true,
      };
  }
}
