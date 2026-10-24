"use client";
import { createContext, useContext, useId } from "react";
import { referralCommissionPlans, type SalonPartner } from "@/lib/salon-referrals";
export const ReferralContext = createContext<SalonPartner | null>(null);
export function ReferralProvider({ partner, children }: { partner: SalonPartner | null; children: React.ReactNode }) {
  return <ReferralContext.Provider value={partner}>{children}</ReferralContext.Provider>;
}
export function ReferralBrand({ header = false }: { header?: boolean }) {
  const partner = useContext(ReferralContext);
  const darkLogoFilterId = useId();
  if (!partner) return null;
  const blendGoldLogo = header && partner.code === "columbus-uppercuts";
  const blendDarkLogo = header && partner.code === "taqueria-ramirez";
  return <div className={header ? "flex shrink-0 items-center gap-2 border-l border-white/30 pl-3" : "flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white p-3 sm:col-span-2"}>
    {blendDarkLogo && <svg width="0" height="0" aria-hidden="true" className="absolute">
      <defs><filter id={darkLogoFilterId} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  4 4 4 0 -0.1" />
      </filter></defs>
    </svg>}
    <div className={`flex h-16 w-24 shrink-0 items-center justify-center rounded-lg px-2 py-1 ${blendGoldLogo || blendDarkLogo ? "bg-transparent" : partner.creamSurface ? "bg-[var(--cream)]" : "bg-white"}`}>
      {blendGoldLogo ? <span role="img" aria-label={`${partner.name} logo`} className="block h-full w-full bg-[var(--gold)]" style={{
        maskImage: `url("${partner.logo}")`, maskMode: "luminance", maskSize: "contain", maskPosition: "center", maskRepeat: "no-repeat",
      }} /> : <img alt={`${partner.name} logo`} className="max-h-full max-w-full object-contain" style={blendDarkLogo ? { filter: `url(#${darkLogoFilterId})` } : undefined} src={partner.logo} />}
    </div>
    {!header && <div><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted-ink)]">Referred by</p><p className="text-sm font-bold">{partner.name}</p><p className="mt-1 text-xs leading-5 text-[var(--muted-ink)]">{referralCommissionPlans[partner.commissionPlan].disclosure}</p></div>}
    {header && <span className="sr-only">Referred by {partner.name}</span>}
  </div>;
}
