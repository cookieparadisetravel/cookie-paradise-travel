import type { Metadata } from "next";
import "./globals.css";
import { WelcomeCreditPopup } from "./components/welcome-credit-popup";

export const metadata: Metadata = {
  metadataBase: new URL("https://cookieparadisetravel.com"),
  title: "Vietnam Tours & Private Trips | Cookie Paradise Travel",
  description: "Small-group tours and private trips to Vietnam, planned with Trung Le in Columbus, Indiana. Explore local food, culture and everyday life at a pace that fits you.",
  openGraph: {
    type: "website",
    url: "https://cookieparadisetravel.com",
    siteName: "Cookie Paradise Travel Company",
    title: "Vietnam Tours & Private Trips | Cookie Paradise Travel",
    description: "Small-group tours and private trips to Vietnam, planned with Trung Le in Columbus, Indiana. Explore local food, culture and everyday life at a pace that fits you.",
    images: [{
      url: "/social-preview.png?v=2",
      width: 1200,
      height: 630,
      alt: "Cookie Paradise Travel Company",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vietnam Tours & Private Trips | Cookie Paradise Travel",
    description: "Small-group tours and private trips to Vietnam, planned with Trung Le in Columbus, Indiana. Explore local food, culture and everyday life at a pace that fits you.",
    images: ["/social-preview.png?v=2"],
  },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png", sizes: "256x256" }],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-US">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* The App Router root layout is the document-wide location for this stylesheet. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..800;1,400..800&family=Valley+Sans:ital,wght@0,400..800;1,400..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}<WelcomeCreditPopup /></body>
    </html>
  );
}
