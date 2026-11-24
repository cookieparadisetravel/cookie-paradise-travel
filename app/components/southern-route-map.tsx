export function SouthernRouteMap() {
  return <figure className="mx-auto max-w-4xl">
    <a href="/travel/southern-vietnam-route.svg" target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-3xl border border-black/15 focus-visible:outline-2 focus-visible:outline-offset-4" aria-label="Open the Southern Vietnam route map at full size">
      <img src="/travel/southern-vietnam-route.svg" width={1000} height={950} loading="lazy" decoding="async" className="h-auto w-full" alt="Eight-day Vietnam route: start in Ho Chi Minh City, take a return day trip to the Mekong Delta, fly to Hue, travel via Hai Van Pass to Hoi An, and depart from Da Nang airport." />
    </a>
    <figcaption className="mt-4 flex flex-wrap items-start justify-between gap-3 text-sm leading-6 text-[var(--muted-ink)]">
      <p className="max-w-xl">Ho Chi Minh City &amp; the Mekong Delta → Hue → Hoi An → Da Nang airport.</p>
      <a href="/travel/southern-vietnam-route.png" download className="font-semibold text-[#805018] underline underline-offset-4">Download the route map</a>
    </figcaption>
  </figure>;
}
