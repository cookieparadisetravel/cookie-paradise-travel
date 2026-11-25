import { DecemberLandingPage } from "../components/december-landing-page";
import { publicPageMetadata } from "@/lib/public-page-metadata";

export const metadata = publicPageMetadata({
  title: "Give Them Vietnam | A Meaningful Trip for Parents",
  description: "Give your parents a Vietnam experience they can treasure, with no more than 8 guests. December 27, 2027 to January 3, 2028. $3,000 per person with every meal included. Plan it with Trung Le in Columbus, Indiana.",
  path: "/give-vietnam",
  image: "/campaigns/gift-hoi-an-1280.webp",
  imageAlt: "Illustrative scene of a couple enjoying lantern-lit Hoi An",
});

export default function GiveVietnam() {
  return <DecemberLandingPage campaign="gift_for_parents" />;
}
