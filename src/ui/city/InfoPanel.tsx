import type { MonthInput, RepoInput } from "@/core/model";

const dateFormat = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const formatDate = (iso: string | null) => (iso ? dateFormat.format(new Date(iso)) : "never");

/** The selected repository's record card, on parchment. */
export function InfoPanel({
  owner,
  repo,
  onClose,
}: {
  owner: string;
  repo: RepoInput;
  onClose: () => void;
}) {
  const url = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo.name)}`;
  const flags = [repo.isFork && "Fork", repo.isArchived && "Archived"].filter(Boolean);
  return (
    <aside
      className="city-card ui-parchment"
      aria-label="Selected repository"
      aria-live="polite"
      data-testid="info-panel"
    >
      <header className="city-card-head">
        <h2>{repo.name}</h2>
        <button
          type="button"
          className="ui-button ui-button--icon"
          onClick={onClose}
          aria-label="Close (Escape)"
          data-cuelume-close
        >
          <span className="ui-icon ui-icon--close" aria-hidden="true" />
        </button>
      </header>
      {flags.length > 0 && <p className="city-card-flags">{flags.join(" · ")}</p>}
      <p className="city-card-description">{repo.description ?? <i>No description</i>}</p>
      <dl>
        <dt>Language</dt>
        <dd>{repo.primaryLanguage ?? "—"}</dd>
        <dt>Stars</dt>
        <dd>{repo.stars.toLocaleString("en")}</dd>
        <dt>Commits</dt>
        <dd>{repo.commitCount === null ? "unknown" : repo.commitCount.toLocaleString("en")}</dd>
        <dt>Founded</dt>
        <dd>{formatDate(repo.createdAt)}</dd>
        <dt>Last activity</dt>
        <dd>{formatDate(repo.pushedAt)}</dd>
      </dl>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="ui-button ui-button--gold"
        data-cuelume-navigate
      >
        Open on GitHub
      </a>
    </aside>
  );
}

const monthFormat = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** "March 2024" for "2024-03". */
export const monthName = (month: string) => monthFormat.format(new Date(`${month}-01T00:00:00Z`));

/** One line for a house of the contribution calendar, for the hover tip. */
export function monthSummary(m: MonthInput): string {
  const n = m.contributions.toLocaleString("en");
  return `${monthName(m.month)}: ${n} ${m.contributions === 1 ? "contribution" : "contributions"}`;
}

/** The record card of a house: one month of the owner's contributions. */
export function MonthPanel({ month, onClose }: { month: MonthInput; onClose: () => void }) {
  return (
    <aside
      className="city-card ui-parchment"
      aria-label="Selected month"
      aria-live="polite"
      data-testid="info-panel"
    >
      <header className="city-card-head">
        <h2>{monthName(month.month)}</h2>
        <button
          type="button"
          className="ui-button ui-button--icon"
          onClick={onClose}
          aria-label="Close (Escape)"
          data-cuelume-close
        >
          <span className="ui-icon ui-icon--close" aria-hidden="true" />
        </button>
      </header>
      <p className="city-card-description">
        A house of the contribution calendar: every month with contributions is one.
      </p>
      <dl>
        <dt>Contributions</dt>
        <dd>{month.contributions.toLocaleString("en")}</dd>
        <dt>In private repositories</dt>
        <dd>{month.privateContributions.toLocaleString("en")}</dd>
      </dl>
    </aside>
  );
}
