import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://cookieparadisetravel.com"),
  title: "Cookie Paradise Travel Company | Hosted Small-Group Journeys",
  description: "Thoughtfully hosted small-group journeys from Cookie Paradise Travel Company, beginning with Vietnam in 2027.",
  openGraph: {
    type: "website",
    url: "https://cookieparadisetravel.com",
    siteName: "Cookie Paradise Travel Company",
    title: "Cookie Paradise Travel Company | Hosted Small-Group Journeys",
    description: "Thoughtfully hosted small-group journeys from Cookie Paradise Travel Company, beginning with Vietnam in 2027.",
    images: [{
      url: "/social-preview.png",
      width: 1200,
      height: 630,
      alt: "Cookie Paradise Travel Company",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cookie Paradise Travel Company | Hosted Small-Group Journeys",
    description: "Thoughtfully hosted small-group journeys from Cookie Paradise Travel Company, beginning with Vietnam in 2027.",
    images: ["/social-preview.png"],
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
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
