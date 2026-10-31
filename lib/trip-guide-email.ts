import { consultationBookingUrl } from "./consultation";
import { tripGuideUrl, type LeadTiming } from "./trip-guide";
import { sendTripGuideEmailMessage } from "./mailersend-transactional";

const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const bodyStyle = "font-family:Arial,sans-serif;font-size:16px;line-height:1.65;color:#000000";
export function buildTripGuideEmail(input: { firstName: string; timing: LeadTiming; stopToken: string }) {
  const stopUrl = `https://cookieparadisetravel.com/trip-guide/stop/${encodeURIComponent(input.stopToken)}`;
  const timing = input.timing === "future"
    ? "You mentioned a future departure. This guide describes our June 1-8, 2027 trip; future dates have not been announced. You can still book a call to discuss your interests."
    : "Our next departure is June 1-8, 2027: eight days and seven nights through Ho Chi Minh City, the Mekong Delta, Hue and Hoi An.";
  const price = "The shared-room price is US$2,875 per traveler at eight travelers and decreases as the confirmed group grows. International airfare is not included.";
  const assurance = "This is an information request. No payment was collected and no reservation has been confirmed.";
  return {
    subject: "Your Discover Southern Vietnam trip guide",
    text: [`Hello ${input.firstName},`, "", "Thank you for your interest in Vietnam! Here is the trip guide you requested:", tripGuideUrl, "", timing, "", price, "", "Questions about flights, rooms or the itinerary? Book a free 30-minute Google Meet with me:", consultationBookingUrl, "", "You can also reply to this email with your questions.", "", assurance, "", "If you have not booked a consultation, we may send reminders three and seven days after this request. Stop these reminders:", stopUrl, "", "Trung Le", "Cookie Paradise Travel Company"].join("\n"),
    html: `<div style="max-width:600px;${bodyStyle}"><p style="${bodyStyle}">Hello ${escape(input.firstName)},</p><h1 style="font-size:25px;color:#000000">Your Vietnam trip guide is ready</h1><p style="${bodyStyle}">Thank you for your interest! Explore the itinerary, what's included and pricing in the guide you requested.</p><p style="${bodyStyle}"><a href="${tripGuideUrl}" style="display:inline-block;background:#593412;color:white;padding:12px 20px;border-radius:24px;text-decoration:none">Open your trip guide</a></p><p style="${bodyStyle}">${timing}</p><p style="${bodyStyle}">${price}</p><h2 style="font-size:20px;color:#000000">Let's talk through your questions</h2><p style="${bodyStyle}">Book a free 30-minute Google Meet with me to discuss flights, rooms and the experience. You do not need to be ready to book the trip.</p><p style="${bodyStyle}"><a href="${consultationBookingUrl}" style="display:inline-block;background:#f7b658;color:#38281e;padding:12px 20px;border-radius:24px;text-decoration:none">Book a free consultation</a></p><p style="${bodyStyle}">You can also reply with your questions.</p><p style="${bodyStyle}">${assurance}</p><p style="${bodyStyle}">Trung Le<br>Cookie Paradise Travel Company</p></div>`,
  };
}
export async function sendTripGuideEmail(input: { toEmail: string; firstName: string; timing: LeadTiming; stopToken: string }) {
  const message = buildTripGuideEmail(input);
  const stopUrl = `https://cookieparadisetravel.com/trip-guide/stop/${encodeURIComponent(input.stopToken)}`;
  message.html += `<p style="${bodyStyle}">If you have not booked a consultation, we may send reminders three and seven days after your request. <a href="${stopUrl}" style="color:#000000">Stop these reminders</a>.</p>`;
  return sendTripGuideEmailMessage({ toEmail: input.toEmail, toName: input.firstName, ...message });
}
