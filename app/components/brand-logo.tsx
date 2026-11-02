/** Display the supplied artwork unchanged, cropping only its transparent canvas. */
export function BrandLogo({ footer = false }: { footer?: boolean }) {
  return <svg
    className={`company-logo${footer ? " company-logo--footer" : ""}`}
    viewBox="25 187 1230 279" width={1230} height={279}
    role="img" aria-label="Cookie Paradise Travel Company"
  >
    <image href="/cookie-paradise-travel-logo.png" width={1280} height={648} />
  </svg>;
}
