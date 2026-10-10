import Link from "next/link";
import type { ReactNode } from "react";
import { BackdropCity } from "@/ui/home/BackdropCity";

/** Full-page message in place of a city: loading, empty, or an error, on a nailed note. */
export function CityMessage({
  title,
  children,
  retryHref,
}: {
  title: string;
  children?: ReactNode;
  /** Shown as "Try again" when the problem may be temporary. */
  retryHref?: string;
}) {
  return (
    <main className="message ui ui--large">
      <BackdropCity />
      <div className="message-note ui-note ui-parchment">
        <h1>{title}</h1>
        {children && <p>{children}</p>}
        <nav>
          {retryHref && (
            <a href={retryHref} className="ui-button" data-cuelume-tap>
              Try again
            </a>
          )}
          <Link href="/" className="ui-button ui-button--gold" data-cuelume-navigate>
            Build another city
          </Link>
        </nav>
      </div>
    </main>
  );
}
