"use client";
import { createContext, useContext } from "react";
import type { SalonPartner } from "@/lib/salon-referrals";
export const ReferralContext = createContext<SalonPartner | null>(null);
export function ReferralProvider({ partner, children }: { partner: SalonPartner | null; children: React.ReactNode }) {
  return <ReferralContext.Provider value={partner}>{children}</ReferralContext.Provider>;
}
export function ReferralBrand({ header = false }: { header?: boolean }) {
  const partner = useContext(ReferralContext);
  if (!partner) return null;
  return <div className={header ? "flex shrink-0 items-center gap-2 border-l border-white/30 pl-3" : "flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white p-3 sm:col-span-2"}>
    <div className={`flex h-16 w-24 shrink-0 items-center justify-center rounded-lg px-2 py-1 ${partner.creamSurface ? "bg-[var(--cream)]" : "bg-white"}`}>
      <img alt={`${partner.name} logo`} className="max-h-full max-w-full object-contain" src={partner.logo} />
    </div>
    {!header && <div><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted-ink)]">Referred by</p><p className="text-sm font-bold">{partner.name}</p><p className="mt-1 text-xs leading-5 text-[var(--muted-ink)]">Your salon may earn a commission for a successful referral.</p></div>}
    {header && <span className="sr-only">Referred by {partner.name}</span>}
  </div>;
}
