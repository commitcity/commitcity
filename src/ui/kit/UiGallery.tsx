"use client";

import { useState } from "react";

const CURSORS = [
  ["cursor-hand.png", "Pointer"],
  ["cursor-hand-press.png", "Clicking"],
  ["cursor-fist.png", "Dragging"],
] as const;

/** The interface kit on a sample city-colored background. */
export function UiGallery() {
  const [grabbing, setGrabbing] = useState(false);
  return (
    <main className="ui ui--large ui-gallery">
      <h1 className="ui-banner">Interface kit</h1>

      <section className="ui-panel">
        <h2>Wooden panel</h2>
        <p>Menus and the city bar sit on wood. Text is parchment colored with an ink shadow.</p>
        <div className="ui-gallery-row">
          <button className="ui-button ui-button--gold">Open city</button>
          <button className="ui-button">Settings</button>
          <button className="ui-button ui-button--icon" aria-label="Rotate left">
            ⟲
          </button>
          <button className="ui-button ui-button--icon" aria-label="Zoom in">
            +
          </button>
          <button className="ui-button" disabled>
            Disabled
          </button>
        </div>
      </section>

      <section className="ui-parchment">
        <h2>Parchment</h2>
        <p>Building cards, notes and the pages of the book use parchment.</p>
        <label htmlFor="ui-login">GitHub username</label>
        <div className="ui-gallery-row">
          <input id="ui-login" className="ui-field" placeholder="octocat" />
          <button className="ui-button ui-button--gold">Build city</button>
        </div>
      </section>

      <section className="ui-panel">
        <h2>Cursors</h2>
        <div className="ui-gallery-row">
          {CURSORS.map(([file, name]) => (
            <figure key={file}>
              {/* eslint-disable-next-line @next/next/no-img-element -- cursor images at 2x, shown at 4x */}
              <img src={`/generated/ui/${file}`} alt="" width={88} height={88} />
              <figcaption>{name}</figcaption>
            </figure>
          ))}
        </div>
        <div
          className={`ui-gallery-drag${grabbing ? " grabbing" : ""}`}
          onPointerDown={() => setGrabbing(true)}
          onPointerUp={() => setGrabbing(false)}
          onPointerLeave={() => setGrabbing(false)}
        >
          Hold the mouse button here to see the dragging hand
        </div>
      </section>
    </main>
  );
}
