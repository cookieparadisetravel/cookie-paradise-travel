import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/owner-auth";
import { FlightWatchDetails } from "../workspace/flight-watch";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Vietnam flight watch | Cookie Paradise Travel",
  robots: { index: false, follow: false },
};

export default async function FlightWatchPage() {
  if (!await requireOwner("/admin/flight-watch")) notFound();
  return <FlightWatchDetails/>;
}
