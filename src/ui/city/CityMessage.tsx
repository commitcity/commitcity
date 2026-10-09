import Link from "next/link";
import type { ReactNode } from "react";

/** Full-page message in place of a city: loading, empty, or an error. */
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
    <main className="message">
      <h1>{title}</h1>
      {children && <p>{children}</p>}
      <nav>
        {retryHref && <a href={retryHref}>Try again</a>}
        <Link href="/">Build another city</Link>
      </nav>
    </main>
  );
}
