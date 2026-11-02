# Mobile header spacing

The homepage mobile header shows the logo with “Travel Company” centered directly beneath it. “Book a free call” is hidden in the mobile header so the page introduces the trip before presenting that action farther down. Referral logos occupy a separate row, with extra space before the hero copy. The desktop header call button, lower-page consultation links and their destinations are preserved.

Validation: production build and whitespace checks passed. Static visual proofs rendered from the actual page components and production CSS were checked at 320px, 375px, 430px and desktop width. The mobile header call button is hidden from rendering and accessibility; the desktop call button and lower-page consultation links remain visible. Each phone view fits without horizontal overflow. Prior TypeScript and targeted lint checks passed with no errors and three existing homepage image warnings.

This is a static visual review; booking submissions and payment transactions were not exercised. Production deployment is pending owner approval.

![375px mobile header preview](phone-layouts.jpg)
