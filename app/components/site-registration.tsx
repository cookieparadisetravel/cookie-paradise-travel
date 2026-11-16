"use client";

import { usePathname } from "next/navigation";
import { travelDisclosures as d } from "@/lib/travel-disclosures";

export function SiteRegistration() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return <aside aria-label="Seller of travel registration" className="border-t border-black/15 bg-[#faf8f3] px-5 pt-6 pb-28 text-black md:pb-6">
    <div className="mx-auto max-w-6xl text-sm leading-6">
      <p>California Seller of Travel Registration number <strong>{d.registration}</strong> · {d.validity.replace("Registration valid", "Valid")}</p>
      <p className="mt-1">{d.approval}</p>
      <p className="mt-1">{d.restitution}</p>
      <p className="mt-3"><a className="font-semibold underline underline-offset-4" href="/travel-disclosures">Travel disclosures &amp; booking information</a><span className="mx-3" aria-hidden="true">·</span><a className="underline underline-offset-4" href="/california-seller-of-travel-certificate.pdf" target="_blank" rel="noreferrer">Registration certificate</a></p>
    </div>
  </aside>;
}
