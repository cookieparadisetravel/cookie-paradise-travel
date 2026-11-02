# Mobile header spacing

The homepage mobile header shows the logo with “Travel Company” centered directly beneath it. A referrer's logo appears to the right, separated by generous spacing and a thin vertical divider. “Book a free call” is hidden in the mobile header so the page introduces the trip before presenting that action farther down. The desktop header call button, lower-page consultation links and their destinations are preserved.

Validation: production build and whitespace checks passed. Static visual proofs rendered from the actual page components and production CSS were checked at 320px, 375px, 430px and desktop width. The mobile header call button is hidden from rendering and accessibility; the desktop call button and lower-page consultation links remain visible. Columbus Uppercuts was checked at 320px, 375px and 430px, with Gossip Nails also checked at 375px. Referrer branding stays to the right of the company logo, with a divider and no overlap or horizontal overflow. Prior TypeScript and targeted lint checks passed with no errors and three existing homepage image warnings.

This is a static visual review; booking submissions and payment transactions were not exercised. Production deployment is pending owner approval.

![Mobile referral header previews](phone-layouts.jpg)
