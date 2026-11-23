export type VisaEmailTraveler = { first_name: string; last_name: string; traveler_type: string | null; guardian_legal_name: string | null };
export function visaEmailCopy(traveler: VisaEmailTraveler) {
  const minor = traveler.traveler_type === "minor";
  const name = minor ? traveler.guardian_legal_name?.trim() || "there" : traveler.first_name.trim() || "there";
  return {
    subject: "Your Vietnam e-visa information",
    greeting: `Hi ${name},`,
    intro: `Please fill out this form when you can! I’ll use the information you provide to apply for ${minor ? `${traveler.first_name}’s` : "your"} Vietnam e-visa. The link expires in two weeks.`,
    button: "Complete visa information form",
    photos: `You’ll need a photo of ${minor ? `${traveler.first_name}’s` : "your"} passport information page and a recent portrait in 2:3 proportions (4 × 6 cm), taken against a plain white background. ${minor ? "The traveler should face" : "Face"} the camera straight on without glasses.`,
  };
}
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function buildVisaEmail(traveler: VisaEmailTraveler, url: string) {
  const link = new URL(url);
  if (link.origin !== "https://cookieparadisetravel.com" || link.pathname !== "/visa-information" || !/^#token=[a-f0-9]{64}$/.test(link.hash) || link.search) throw new Error("Invalid visa request URL.");
  const copy = visaEmailCopy(traveler);
  return {
    subject: copy.subject,
    html: `<p>${escape(copy.greeting)}</p><p>${escape(copy.intro)}</p><p style="margin:28px 0"><a href="${escape(url)}" style="display:inline-block;background:#d5a652;color:#000000!important;padding:14px 22px;border-radius:6px;text-decoration:none;font-weight:bold">${escape(copy.button)}</a></p><p>${escape(copy.photos)}</p><p>Thank you!<br>Trung</p>`,
    text: `${copy.greeting}\n\n${copy.intro}\n\n${copy.button}: ${url}\n\n${copy.photos}\n\nThank you!\nTrung`,
  };
}
