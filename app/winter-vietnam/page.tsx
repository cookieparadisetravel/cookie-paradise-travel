import { DecemberLandingPage } from "../components/december-landing-page";
import { publicPageMetadata } from "@/lib/public-page-metadata";

export const metadata = publicPageMetadata({
  title: "Trade Winter Coats for Vietnam | December 27, 2027",
  description: "An 8-day Vietnam journey for 4–8 guests, personally hosted by an experienced tour leader. Plan with Columbus, Indiana founder Trung Le. $3,000 per person, all meals included, shared room; international airfare extra.",
  path: "/winter-vietnam",
  image: "/campaigns/winter-coffee-1280.webp",
  imageAlt: "Illustrative scene of travelers sharing Vietnamese coffee",
});

export default function WinterVietnam() {
  return <DecemberLandingPage campaign="winter_escape" />;
}
