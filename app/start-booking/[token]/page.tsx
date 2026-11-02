import { env } from "cloudflare:workers";
import { getSalesBookingInvitation } from "@/lib/inquiry-booking-invitations";
import { BookingDialog } from "@/app/components/booking-dialog";
import { consultationBookingUrl } from "@/lib/consultation";

export const dynamic="force-dynamic";
export const metadata={title:"Continue your booking | Cookie Paradise Travel",robots:{index:false,follow:false},referrer:"no-referrer"};
export default async function StartBookingPage({params}:{params:Promise<{token:string}>}) {
  const {token}=await params;
  const invitation=await getSalesBookingInvitation(token);
  let trip:{departure:string;room:string;partySize:number;sellerOfTravelStateResident?:boolean;residenceState?:string}|undefined;
  if (invitation?.sale.bookingId && !invitation.completedAt) {
    trip=await env.DB!.prepare("SELECT departure,room_preference AS room,party_size AS partySize,seller_of_travel_state_resident AS sellerOfTravelStateResident,residence_state AS residenceState FROM booking_requests WHERE id=?")
      .bind(invitation.sale.bookingId).first<typeof trip>() ?? undefined;
  }
  return <main className="min-h-screen bg-[var(--sand)] px-5 py-16 text-[var(--ink)]"><section className="mx-auto max-w-2xl rounded-3xl border border-[var(--line)] bg-white p-7 sm:p-10">
    <p className="text-xs font-bold uppercase tracking-widest text-[var(--orange)]">Cookie Paradise Travel Company</p>
    <h1 className="mt-4 font-serif text-4xl">{invitation?.completedAt ? "Your booking request has been received" : invitation ? "Continue your Vietnam booking" : "This booking link is unavailable"}</h1>
    {invitation && !invitation.completedAt ? <><p className="mt-5 leading-7">Review your saved contact details and complete the remaining trip selections. Submitting the form starts your next booking step. No payment is collected here, and your reservation is not yet confirmed.</p><div className="mt-7"><BookingDialog triggerLabel="Continue my booking" initialOpen bookingInvitationToken={token} initialContact={{name:invitation.sale.name,email:invitation.sale.email,phone:invitation.sale.phone}} initialTrip={trip} /></div></> : <p className="mt-5 leading-7">{invitation?.completedAt ? "Trung will help you with the next steps. No payment was collected by this form, and your reservation is not yet confirmed." : "The link may have expired or been replaced. Contact Trung for a new link, or book a free call below."}</p>}
    <a className="mt-7 inline-flex min-h-11 items-center font-semibold underline" href={consultationBookingUrl}>Book a free 30-minute call with Trung →</a>
  </section></main>;
}
