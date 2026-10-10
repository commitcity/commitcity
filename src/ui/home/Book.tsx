"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

type State = "closed" | "opening" | "open";
type Page = "left" | "right";

/**
 * A leather book that opens when clicked: the cover turns on its spine and
 * shows two pages. Without motion (prefers-reduced-motion) it opens at once.
 * On narrow screens one page shows at a time, starting with the right one.
 */
export function Book({
  title,
  subtitle,
  left,
  right,
  leftLabel,
  rightLabel,
}: {
  title: string;
  subtitle: string;
  left: ReactNode;
  right: ReactNode;
  /** Names of the pages, for the buttons that turn to them on narrow screens. */
  leftLabel: string;
  rightLabel: string;
}) {
  const [state, setState] = useState<State>("closed");
  const [page, setPage] = useState<Page>("right");
  const rightRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (state === "open") rightRef.current?.querySelector<HTMLElement>("input")?.focus();
  }, [state]);

  const open = () => {
    if (state !== "closed") return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setState(still ? "open" : "opening");
  };

  return (
    <div className="book" data-state={state} data-page={page}>
      <div className="book-spread">
        <section className="book-page book-page--left" aria-hidden={state !== "open"}>
          {left}
          <button
            type="button"
            className="book-turn"
            onClick={() => setPage("right")}
            data-cuelume-navigate
          >
            {rightLabel} ›
          </button>
        </section>
        <section
          ref={rightRef}
          className="book-page book-page--right"
          aria-hidden={state === "closed"}
        >
          {right}
          <button
            type="button"
            className="book-turn"
            onClick={() => setPage("left")}
            data-cuelume-navigate
          >
            ‹ {leftLabel}
          </button>
        </section>
      </div>
      {state !== "open" && (
        <button
          type="button"
          className="book-cover"
          onClick={open}
          onTransitionEnd={(e) => {
            if (e.propertyName === "transform" && state === "opening") setState("open");
          }}
          aria-label={`${title}: open the book`}
          data-cuelume-open
          data-cuelume-emphasis="strong"
        >
          <span className="book-face book-face--front">
            <span className="book-title">{title}</span>
            <span className="book-subtitle">{subtitle}</span>
          </span>
          <span className="book-face book-face--back" />
        </button>
      )}
      {state === "closed" && (
        <p className="book-hint" aria-hidden="true">
          Click the book to open it
        </p>
      )}
    </div>
  );
}
