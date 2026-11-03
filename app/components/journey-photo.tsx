const photographs = {
  skyline: {
    file: "ho-chi-minh-city", width: 1800, height: 1200,
    alt: "Ho Chi Minh City's illuminated waterfront skyline reflected in the river at night",
    place: "Ho Chi Minh City", detail: "City lights on the river",
    photographer: "Tat Linh Nguyen", source: "https://unsplash.com/photos/2z35CUCEg-Y",
  },
  mekong: {
    file: "mekong-delta", width: 1800, height: 2400,
    alt: "View from a wooden boat carrying passengers in conical hats through a palm-lined Mekong Delta waterway",
    place: "Mekong Delta", detail: "Life along the waterways",
    photographer: "Jil Beckmann", source: "https://unsplash.com/photos/eXF6L4RGjyU",
  },
  hue: {
    file: "hue-citadel", width: 1800, height: 1200,
    alt: "The Imperial Citadel in Hue, with tiled roofs above its stone walls and moat",
    place: "Hue", detail: "Layers of imperial history",
    photographer: "Nguyen Minh", source: "https://unsplash.com/photos/lzjlYsMGYXg",
  },
  street: {
    file: "hoi-an-night", width: 1800, height: 2398,
    alt: "Hoi An shopfronts and a narrow street glowing with colorful lanterns after dark",
    place: "Hoi An", detail: "Old-town evenings",
    photographer: "Juup Schram", source: "https://unsplash.com/photos/oBu2jRDmMNk",
  },
  lanterns: {
    file: "hoi-an-lanterns", width: 1800, height: 2700,
    alt: "Colorful traditional lanterns hanging above a street in Hoi An at dusk",
    place: "Hoi An", detail: "A little lantern magic",
    photographer: "Kyle Thacker", source: "https://unsplash.com/photos/IeCSFQLc-Fs",
  },
  fitBay: {
    file: "fit-ha-long-bay", width: 1800, height: 1218,
    alt: "Small boats on misty Ha Long Bay between towering limestone islands",
    place: "Ha Long Bay", detail: "Into the mist",
    photographer: "Warren", source: "https://unsplash.com/photos/boat-surrounder-by-islands--HtfdIHSbsE",
  },
  fitTerraces: {
    file: "fit-mu-cang-chai", width: 1800, height: 1201,
    alt: "Golden terraced rice fields in Mu Cang Chai with morning mist drifting over the hills",
    place: "Mu Cang Chai", detail: "Golden curves, quiet mornings",
    photographer: "Hoach Le Dinh", source: "https://unsplash.com/photos/rice-terraces-in-mu-cang-chai-PeRt3uMmjYM",
  },
  fitCafe: {
    file: "fit-hanoi-cafe", width: 1800, height: 2400,
    alt: "A Hanoi street café with warm lights, flower-covered balconies and parked scooters in the evening",
    place: "Hanoi", detail: "An evening pause",
    photographer: "Florian Schmid", source: "https://unsplash.com/photos/a-coffee-shop-with-flowers-and-lights-on-a-street-0sTDZrJ72i8",
  },
} as const;

export function JourneyPhoto({ photo, className = "", sizes = "(min-width: 1024px) 45vw, 100vw", priority = false }: {
  photo: keyof typeof photographs;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const image = photographs[photo];
  return <figure className={`journey-photo ${className}`}>
    <div className="journey-photo-frame">
      {/* Pre-sized local WebP files supply responsive images without a runtime image service. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/travel/${image.file}-1280.webp`}
        srcSet={[640, 1280, 1800].map(width => `/travel/${image.file}-${width}.webp ${width}w`).join(", ")}
        sizes={sizes} width={image.width} height={image.height}
        alt={image.alt} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} decoding="async" />
    </div>
    <figcaption>
      <span><strong>{image.place}</strong><span className="journey-photo-detail">{image.detail}</span></span>
      <a href={image.source} target="_blank" rel="noopener noreferrer" aria-label={`Photo by ${image.photographer} on Unsplash (opens in a new tab)`}>Photo: {image.photographer}</a>
    </figcaption>
  </figure>;
}
