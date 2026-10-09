"use client";

import { useMemo } from "react";
import { parseCityInput } from "@/core/model";
import medium from "../../../fixtures/medium.json";
import { useCity } from "../city/useCity";

/** A sample city drifting behind the landing page. Decorative only. */
export function BackdropCity() {
  const input = useMemo(() => parseCityInput(medium), []);
  const { hostRef } = useCity(input, { orientation: 0, zoom: null, repo: null, passive: true });
  return <div ref={hostRef} className="backdrop-city" aria-hidden="true" />;
}
