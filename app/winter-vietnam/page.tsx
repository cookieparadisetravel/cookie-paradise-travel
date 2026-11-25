import { DecemberLandingPage } from "../components/december-landing-page";
import { publicPageMetadata } from "@/lib/public-page-metadata";

export const metadata = publicPageMetadata({
  title: "Trade Winter Coats for Vietnam | December 27, 2027",
  description: "Eight days in Ho Chi Minh City, the Mekong Delta, Hue, and Hoi An, December 27, 2027 to January 3, 2028. Capped at 8 guests. $3,000 per person with every meal included. Planned with Trung Le in Columbus, Indiana.",
  path: "/winter-vietnam",
  image: "/campaigns/winter-coffee-1280.webp",
  imageAlt: "Illustrative scene of travelers sharing Vietnamese coffee",
});

export default function WinterVietnam() {
  return <DecemberLandingPage campaign="winter_escape" />;
}
