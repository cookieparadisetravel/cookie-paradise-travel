# FIT wording and northern Vietnam photo options

Prepared November 3, 2026 from clean main commit `cc49439d06ed3c6e1e1f30af2be21b7af8cdca59`. No `AGENTS.md` was found.

## Copy changes

- The shared Vietnam landing-page introduction now says **From America to Vietnam**. The prior slogan had one occurrence in tracked website source. Referral variants use this same page. The public trip-guide PDF did not contain the old slogan.
- The FIT FAQ now starts **Here, FIT (Free Independent Travel) means…**, retaining the rest of the requested paragraph.

Production build, TypeScript, affected-page ESLint, and `git diff --check` passed. The two changes were also reviewed in a static browser proof generated from the actual page components and built CSS; the FIT FAQ was opened to confirm the complete answer is visible. This preview stubs availability and does not submit forms. No new tests were added for these two text edits.

![Draft wording changes](copy-review.jpg)

## Photo shortlist

The owner selected **C, M1 and H6** from this board and the [second round](round-two/README.md). Those selections are now implemented in the private-trip page draft, with matching captions, trip ideas and a new social-preview image. The group-trip homepage imagery remains unchanged. See the [selected-photo review](../fit-selected-review/README.md) for the final placement and validation.

| ID | Destination | Photo | Photographer | Source |
| --- | --- | --- | --- | --- |
| A | Ha Giang | Winding mountain road | Phuong Anh | [Unsplash](https://unsplash.com/photos/a-winding-road-in-the-middle-of-a-mountain-l47jbeR9AVk) |
| B | Ha Giang | Nho Que River canyon | Harry Le | [Unsplash](https://unsplash.com/photos/boats-travel-on-a-turquoise-river-through-a-mountain-gorge-FnNbDYuofmQ) |
| C | Ha Long Bay | Misty limestone islands | Warren | [Unsplash](https://unsplash.com/photos/boat-surrounder-by-islands--HtfdIHSbsE) |
| D | Ha Long Bay | Cruise boat and blue water | Adam Young | [Unsplash](https://unsplash.com/photos/a-boat-sails-through-a-bay-with-limestone-karsts-5RjpoBtb54o) |
| E | Hanoi | Quiet alley with a Vietnamese flag | GVZ 42 | [Unsplash](https://unsplash.com/photos/narrow-alleyway-with-vietnamese-flag-and-shops-8TFVKRr-ngQ) |
| F | Hanoi | Hoan Kiem Lake at night | Giang Nguyen | [Unsplash](https://unsplash.com/photos/a-night-view-of-a-city-with-a-lake-in-front-of-it-Pem-EwQYeD4) |

Each source page was opened and lists the image as **Download free** and free under the standard [Unsplash License](https://unsplash.com/license), which permits commercial use. Photographer names, location descriptions, and original source URLs are recorded in `options.json`. The board shows the actual downloaded photos in full composition, resized for comparison. All are distinct from the photos currently used on the group-trip homepage.

The initial recommendation was B, C and E; the final owner selections are **C, M1 and H6**. This board is retained as the original reference. The live website has not been changed by this branch; deployment approval is pending.

![Six stock-photo options](photo-options.jpg)
