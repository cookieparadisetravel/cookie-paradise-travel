"use client";

import { useEffect, useState } from "react";
import { ConsultationLink } from "./consultation-link";

import type { TripAvailabilityValue } from "./trip-availability";

export function MobileBookBar({ availability }: { availability: TripAvailabilityValue }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("top");
    if (!hero) return;

    const observer = new IntersectionObserver(([entry]) => {
      setVisible(!entry.isIntersecting && entry.boundingClientRect.bottom <= 0);
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/15 bg-[var(--navy)] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-white shadow-[0_-8px_24px_rgba(0,0,0,0.18)] md:hidden"
    >
      <div className="mx-auto max-w-md">
        <p className="mb-2 text-center text-xs leading-5 text-white/85">{availability?.full ? "Departure fully booked · Ask about future trips" : "June 1–8, 2027 · Free 30-minute Google Meet"}</p>
        <ConsultationLink compact className="w-full" />
      </div>
    </div>
  );
}
