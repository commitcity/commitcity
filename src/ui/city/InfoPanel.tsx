import type { RepoInput } from "@/core/model";

const dateFormat = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Details of the selected repository. Dev styling only; the product UI comes later. */
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
  const flags = [repo.isFork && "fork", repo.isArchived && "archived"].filter(Boolean);
  return (
    <aside
      aria-label="Selected repository"
      aria-live="polite"
      data-testid="info-panel"
      style={{
        position: "absolute",
        right: 8,
        bottom: 8,
        width: "min(320px, calc(100% - 16px))",
        padding: 12,
        background: "rgba(0, 0, 0, 0.8)",
        color: "#fff",
        lineHeight: 1.5,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 15, overflowWrap: "anywhere" }}>{repo.name}</h2>
        <button onClick={onClose} aria-label="Close (Escape)">
          ×
        </button>
      </div>
      {flags.length > 0 && <div style={{ color: "#f5c542" }}>{flags.join(" · ")}</div>}
      <p style={{ margin: "6px 0" }}>{repo.description ?? <i>No description</i>}</p>
      <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0 12px", margin: 0 }}>
        <dt>Language</dt>
        <dd style={{ margin: 0 }}>{repo.primaryLanguage ?? "—"}</dd>
        <dt>Stars</dt>
        <dd style={{ margin: 0 }}>{repo.stars.toLocaleString("en")}</dd>
        <dt>Last activity</dt>
        <dd style={{ margin: 0 }}>
          {repo.pushedAt ? dateFormat.format(new Date(repo.pushedAt)) : "never"}
        </dd>
      </dl>
      <a href={url} target="_blank" rel="noreferrer" style={{ color: "#8cc8ff" }}>
        Open on GitHub ↗
      </a>
    </aside>
  );
}
