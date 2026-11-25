import { DecemberLandingPage } from "../components/december-landing-page";
import { publicPageMetadata } from "@/lib/public-page-metadata";

export const metadata = publicPageMetadata({
  title: "Give Them Vietnam | A Meaningful Trip for Parents",
  description: "Give your parents a Vietnam experience to look forward to. $3,000 per person, all meals included; shared room, international airfare extra. December 27, 2027–January 3, 2028. 4–8 guests, an experienced tour leader, and planning with Columbus, Indiana founder Trung Le.",
  path: "/give-vietnam",
  image: "/campaigns/gift-hoi-an-1280.webp",
  imageAlt: "Illustrative scene of a couple enjoying lantern-lit Hoi An",
});

export default function GiveVietnam() {
  return <DecemberLandingPage campaign="gift_for_parents" />;
}
