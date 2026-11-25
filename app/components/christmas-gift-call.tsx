"use client";

import { useEffect, useState } from "react";
import { consultationBookingUrl } from "@/lib/consultation";

// End of December 20, 2026 in Indiana. Keep the seasonal prompt out of later ads.
const giftCallDeadline = Date.parse("2026-12-21T00:00:00-05:00");

export function ChristmasGiftCall() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const refresh = () => setVisible(Date.now() < giftCallDeadline);
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!visible) return null;
  return <p><a href={consultationBookingUrl} target="_blank" rel="noopener noreferrer">Book a free call</a> by December 20, 2026, and we’ll help you have it ready to give at Christmas.</p>;
}
