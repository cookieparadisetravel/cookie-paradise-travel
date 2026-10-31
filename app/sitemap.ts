import type { MetadataRoute } from "next";

const siteUrl = "https://cookieparadisetravel.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/vietnam`, changeFrequency: "weekly", priority: 0.9 },
    {
      url: siteUrl,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
