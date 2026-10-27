# Approved Vietnam hero video

The homepage uses the owner's approved 15-second Runway video, task
`a5a671f7-9300-44c9-9ffc-993c565f6c5a` (approved October 27, 2026).
Its scenes are Ho Chi Minh City Hall, a Mekong Delta palm canal, Minh Mạng's
tomb in Huế, and Hội An at night. No further generation was used for this change.

## Delivery

- `public/vietnam-hero.mp4`: 1920 × 1080 H.264, 30 fps, no audio.
- `public/vietnam-hero-mobile.mp4`: 1280 × 720 H.264, 30 fps, no audio;
  selected by the browser at widths up to 767 px.
- `public/vietnam-hero-poster.webp`: the opening frame, used during loading,
  when playback fails or JavaScript is disabled, and for reduced motion/data saving.
- Both MP4 files have their metadata at the front for progressive playback.
- Assets are served from the site's own `public` directory; no expiring Runway
  URL or third-party video player is used by visitors.

`HeroVideo` renders only its poster on the server. After hydration it checks
`prefers-reduced-motion` and the browser's data-saving preference before mounting
the video or its sources. Preference changes are observed. The video plays muted,
inline and looping, with a visible keyboard-accessible pause/play button. Playback
errors retain the poster. The existing hero text, overlay, availability and booking
controls are unchanged.

## Visual references used during generation

The video was generated with photo references, rather than using source photos
as public website assets. Reference pages and credits are retained here:

- City Hall facade: Vietnam Tourism, “7 must-see attractions in HCMC”,
  photo by Aaron Joel Santos:
  https://vietnam.travel/things-to-do/7-must-see-attractions-hcmc/
- City Hall lighting: “Ho Chi Minh City Hall at dusk”, GiveMeMollusks, CC0 1.0:
  https://commons.wikimedia.org/wiki/File:Ho_Chi_Minh_City_Hall_at_dusk.jpg
- Ben Tre canal: Vietnam Tourism, “Day-tripping in the Mekong Delta”:
  https://vietnam.travel/things-to-do/day-tripping-mekong-delta/
- Minh Mạng tomb: Vietnam Tourism, “An inside guide to the Hue Tombs”:
  https://vietnam.travel/things-to-do/an-inside-guide-hue-tombs/
- Hội An riverfront: Vietnam Tourism, “The best ways to explore the ancient town
  of Hoi An”, image credited in its URL to tmluong50:
  https://vietnam.travel/things-to-do/the-best-ways-to-explore-the-ancient-town-of-hoi-an/

## Validation

Run the existing tests, TypeScript check, lint and production build. Check the
desktop and mobile hero, pause/resume, reduced-motion preference, and failed or
blocked autoplay. Confirm the poster and MP4 URLs return successfully after deploy.
No database migration or application-secret change is required.
