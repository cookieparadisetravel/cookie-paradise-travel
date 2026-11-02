# Consistent landing-page logo

This records the initial logo deployment. The subsequent [blended logo refinement](../unboxed-logo-review/README.md) supersedes its cream backing treatment.

Use the owner's supplied `Untitled design.png` as the common company logo on the homepage, `/vietnam` and `/fit`, including their existing referral experiences. The homepage footer uses the same artwork.

The original PNG is copied byte-for-byte to `public/cookie-paradise-travel-logo.png`. SHA-256: `7139d65c4cb621258bc42e0ec9a6ac12c49beff5f34ca6ef1f999fe3b559d72e`.

The shared `BrandLogo` component uses an SVG viewport to omit only the PNG's transparent outer canvas. The supplied mark, trademark symbol and centered black Travel Company subtitle remain intact. A cream backing keeps the black subtitle readable on the dark headers. No generated artwork or bitmap alterations were used.

All three headers use the existing mobile layout: partner branding to the right, divider/spacing between the marks, and no early header action on phones. Existing body calls to action remain available. Transactional screens retain their existing logo asset and functionality.

## Validation

- Production build and TypeScript passed.
- Changed-file lint passed with one pre-existing homepage image warning.
- Browser inspected all three referral headers at 320 CSS pixels: identical 144px-wide company logos, 27px separation before the partner panel, no horizontal overflow and hidden header actions.
- FIT page additionally checked at 375 and 430 CSS pixels: no text/link/summary or page overflow.
- Desktop FIT logo is 224px wide, has the correct source/viewBox and fits without horizontal overflow.
- Original-upload and repository PNG checksums match.

[All three mobile landing pages](mobile-landing-pages.jpg)

Browser proof uses static markup from actual page components and built CSS, with referral cookies stubbed for the example. The production Worker configuration was preserved. No inquiry, payment, email or calendar booking was submitted.
