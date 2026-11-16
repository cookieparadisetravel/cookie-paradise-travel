"use client";

import { useEffect, type ReactNode } from "react";

export function TripSectionLink({ children, className }: { children: ReactNode; className?: string }) {
  return <button type="button" className={`cursor-pointer ${className ?? ""}`} onClick={() => {
    const section = document.getElementById("trip-highlights");
    section?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    section?.focus({ preventScroll: true });
  }}>{children}</button>;
}

export function LegacyJourneyCleanup() {
  useEffect(() => {
    const cleanLegacyLink = () => {
      if (window.location.hash !== "#journey") return;
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    };
    cleanLegacyLink();
    window.addEventListener("hashchange", cleanLegacyLink);
    return () => window.removeEventListener("hashchange", cleanLegacyLink);
  }, []);
  return null;
}
