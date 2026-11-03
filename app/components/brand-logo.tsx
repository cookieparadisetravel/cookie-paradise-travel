"use client";
import { useId } from "react";

/** Keep the supplied wordmark; recolor only its subtitle for the surrounding surface. */
export function BrandLogo({ footer = false, surface = "light" }: { footer?: boolean; surface?: "light" | "dark" }) {
  const filterId = `company-logo-subtitle-${useId().replace(/:/g, "")}`;
  const ink = surface === "dark" ? "1" : "0";
  return <span className={`company-logo${footer ? " company-logo--footer" : ""}`} role="img" aria-label="Cookie Paradise Travel Company">
    <svg width={0} height={0} aria-hidden="true" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}>
      <defs><filter id={filterId} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
        <feColorMatrix type="matrix" values={`0 0 0 0 ${ink}  0 0 0 0 ${ink}  0 0 0 0 ${ink}  0 0 0 1 0`} />
      </filter></defs>
    </svg>
    <svg className="company-logo-part" viewBox="25 187 1230 193" width={1230} height={193} overflow="hidden" aria-hidden="true">
      <image href="/cookie-paradise-travel-logo.png" width={1280} height={648} />
    </svg>
    <span className="company-logo-part" style={{ filter: `url(#${filterId})` }}>
      <svg viewBox="25 380 1230 86" width={1230} height={86} overflow="hidden" aria-hidden="true">
        <image href="/cookie-paradise-travel-logo.png" width={1280} height={648} />
      </svg>
    </span>
  </span>;
}
