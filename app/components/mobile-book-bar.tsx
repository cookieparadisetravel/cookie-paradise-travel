"use client";

import { useEffect, useState } from "react";
import { BookingDialog } from "./booking-dialog";

export function MobileBookBar() {
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
      <div className="mx-auto flex max-w-md items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="whitespace-nowrap text-sm font-bold text-[var(--gold)]">From $2,500 / person</p>
          <p className="mt-0.5 text-xs text-white/70">8 days · 2027</p>
        </div>
        <BookingDialog triggerLabel="Request a spot" />
      </div>
    </div>
  );
}
