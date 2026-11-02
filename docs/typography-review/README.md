# Editorial typography review

Prepared against production main commit `2af587a1be1a3209d081946abd37725c98046da4`.

The shared document stylesheet now loads Playfair Display and Valley Sans from Google Fonts, with normal and italic variable weights 400–800 and `display=swap`. Existing serif headlines and editorial photo captions use Playfair Display; body copy, navigation, controls and itinerary times use Valley Sans. Existing fallback fonts remain.

## Validation

- `npm run build`: passed.
- `npx tsc --noEmit`: passed.
- `npx eslint app/layout.tsx`: passed.
- `git diff --check`: passed.
- Browser confirmed both requested fonts load and the body/headline computed font families are correct.
- Homepage: checked desktop and 320, 375 and 430 CSS-pixel phone widths. No horizontal page or text/control overflow.
- Referral homepage: checked 375 CSS-pixel phone width, including logo separation and hidden mobile header call action.
- `/vietnam`: checked desktop and 320/375 CSS-pixel phone widths. No horizontal page or text/control overflow.

Screenshots show static visual proofs rendered from the actual page components and production CSS. Server-side availability and cookies are stubbed for this proof; the referral proof explicitly selects Columbus Uppercuts. Interactive scripts are omitted, so these screenshots do not verify form submissions, payments or referral persistence. This change touches only shared font loading and CSS; no transaction or referral code was modified. No deployment was performed.

- [Desktop hero](desktop-hero.jpg)
- [Desktop journey section](desktop-journey.jpg)
- [Mobile and referral comparison](mobile.jpg)
