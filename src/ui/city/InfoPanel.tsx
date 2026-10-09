import type { RepoInput } from "@/core/model";

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
      <a href={url} target="_blank" rel="noreferrer" className="ui-button ui-button--gold">
        Open on GitHub
      </a>
    </aside>
  );
}
