/** Keep the supplied wordmark; recolor only its subtitle for the surrounding surface. */
export function BrandLogo({ footer = false, surface = "light" }: { footer?: boolean; surface?: "light" | "dark" }) {
  return <svg
    className={`company-logo${footer ? " company-logo--footer" : ""}`}
    viewBox="25 187 1230 279" width={1230} height={279}
    role="img" aria-label="Cookie Paradise Travel Company"
  >
    <svg x={25} y={187} width={1230} height={193} viewBox="25 187 1230 193" overflow="hidden" aria-hidden="true">
      <image href="/cookie-paradise-travel-logo.png" width={1280} height={648} />
    </svg>
    <svg x={25} y={380} width={1230} height={86} viewBox="25 380 1230 86" overflow="hidden" aria-hidden="true">
      <image href="/cookie-paradise-travel-logo.png" width={1280} height={648}
        style={{ filter: surface === "dark" ? "brightness(0) invert(1)" : "brightness(0)" }} />
    </svg>
  </svg>;
}
