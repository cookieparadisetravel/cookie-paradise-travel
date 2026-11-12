import type { Metadata } from "next";

const siteUrl = "https://cookieparadisetravel.com";

/** Keep search and sharing descriptions specific to each public page. */
export function publicPageMetadata({ title, description, path, image = "/social-preview.png?v=2", imageAlt = "Cookie Paradise Travel Company — Vietnam tours and private trips" }: {
  title: string;
  description: string;
  path: string;
  image?: string;
  imageAlt?: string;
}): Metadata {
  const url = new URL(path, siteUrl).href;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "Cookie Paradise Travel Company",
      title,
      description,
      url,
      images: [{ url: image, alt: imageAlt }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
