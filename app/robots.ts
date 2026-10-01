import type { MetadataRoute } from "next";

const siteUrl = "https://cookieparadisetravel.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/traveler-agreement", "/traveler-list"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
