# Blended logo treatment

Prepared against production commit `76f8570fe5f1e201c67737e015a609ba7d4b3ebd`.

Remove the cream backing and corner treatment from the shared company logo. Keep the supplied orange/brown wordmark and trademark unchanged, and recolor only the Travel Company subtitle: white for dark surfaces, black for light surfaces.

The shared component defaults to a light surface. The homepage, Vietnam landing page, FIT landing page and homepage footer explicitly select the dark-surface variant. Two clipped SVG viewports use the original supplied PNG: the upper wordmark is unfiltered, while only the subtitle is recolored. The original PNG is unchanged. No generated artwork, new bitmap assets, duplicated subtitle text or unique SVG IDs are needed.

## Validation

- Production build, TypeScript and changed-file lint passed. Lint retains one existing homepage image warning.
- Browser confirmed transparent logo backgrounds and zero corner radius.
- Compared the actual component on dark and white surfaces; subtitle is white and black respectively, and the upper wordmark retains its colors.
- Checked all three referral headers at 320 CSS pixels: no horizontal page overflow, 27px separation before the partner panel, transparent logo surfaces and white subtitle treatment.
- Existing hidden mobile header actions remain hidden.

Visual proofs use markup rendered from actual components and built CSS. The comparison's large dark and white panels represent the surrounding surfaces; they are not backgrounds added to the logo. The full Worker compatibility date is unavailable in this preview runtime; production settings were preserved. No booking or payment transactions were submitted. No deployment has been performed for this refinement.

- [Dark and white background comparison](backgrounds.jpg)
- [All three phone referral headers](mobile.jpg)
