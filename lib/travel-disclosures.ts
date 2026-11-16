// Approved customer disclosures. Provider-name disclosure is intentionally excluded.
// The date range accompanies the number; issuance is not the effective date.
export const travelDisclosures = {
  company: "Cookie Paradise Travel Company LLC",
  address: "3346 Cox Ln., Columbus, IN 47203",
  phone: "+1 (812) 508-9675",
  email: "trung@cookieparadise.co",
  registration: "CST 2176084-40",
  validity: "Registration valid November 23, 2026–November 22, 2027.",
  approval: "Registration as a seller of travel does not constitute approval by the State of California.",
  trust: "California law requires certain sellers of travel to have a trust account or bond. This business has a trust account.",
  restitution: "This Seller of Travel is not a participant in the California Travel Consumer Restitution Fund.",
  refund: "Upon cancellation of the transportation or travel services, where the passenger is not at fault and has not canceled in violation of any terms and conditions previously clearly and conspicuously disclosed and agreed to by the passenger, all sums paid to the seller of travel for services not provided will be promptly paid to the passenger, unless the passenger otherwise advises the seller of travel in writing, after cancellation. Applicable statutory exceptions and nonwaivable rights remain in effect.",
  departure: "The departure date and itinerary are stated in your personalized booking documents. Exact departure times and meeting places for included transfers and domestic travel are determined when transport schedules and reservations are confirmed; we will provide those details in writing in your final itinerary before travel.",
  url: "https://cookieparadisetravel.com/travel-disclosures",
} as const;

export function travelDisclosureText({ includeRefund = false }: { includeRefund?: boolean } = {}) {
  const d = travelDisclosures;
  return [d.company, `${d.address} | ${d.phone} | ${d.email}`, `${d.registration} · ${d.validity}`, d.approval, d.trust, d.restitution, ...(includeRefund ? [d.refund] : []), `Travel disclosures: ${d.url}`].join("\n\n");
}

export function travelDisclosureEmailHtml() {
  const d = travelDisclosures;
  return `<div data-travel-disclosures="2026-11" style="margin-top:28px;border-top:1px solid #cccccc;padding-top:16px;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#000000"><p style="margin:0 0 10px;color:#000000"><strong>${d.company}</strong><br>${d.address}<br>${d.phone} · <a style="color:#000000;text-decoration:underline" href="mailto:${d.email}">${d.email}</a></p><p style="margin:0 0 10px;color:#000000"><strong>${d.registration}</strong><br>${d.validity}<br>${d.approval}</p><p style="margin:0 0 10px;color:#000000">${d.trust}</p><p style="margin:0 0 10px;color:#000000">${d.restitution}</p><a style="color:#000000;text-decoration:underline" href="${d.url}">Travel disclosures and booking information</a></div>`;
}
