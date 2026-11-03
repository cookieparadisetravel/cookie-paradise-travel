import { travelCompanyPath } from "./brand-logo-subtitle";

/** Preserve the supplied wordmark and use a solid subtitle color for its surface. */
export function BrandLogo({ footer = false, surface = "light" }: { footer?: boolean; surface?: "light" | "dark" }) {
  return <svg
    className={`company-logo${footer ? " company-logo--footer" : ""}`}
    viewBox="25 187 1230 279" width={1230} height={279}
    role="img" aria-label="Cookie Paradise Travel Company"
  >
    <svg x={25} y={187} width={1230} height={193} viewBox="25 187 1230 193" overflow="hidden" aria-hidden="true">
      <image href="/cookie-paradise-travel-logo.png" width={1280} height={648} />
    </svg>
    <path d={travelCompanyPath} fill={surface === "dark" ? "#ffffff" : "#000000"} fillRule="evenodd" aria-hidden="true" />
  </svg>;
}
