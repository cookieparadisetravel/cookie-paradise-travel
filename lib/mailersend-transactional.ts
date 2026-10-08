import { env } from "cloudflare:workers";

type MailerSendAttachment = {
  content: string;
  filename: string;
  disposition: "attachment";
};

type SendEmailInput = {
  toEmail: string;
  toName: string;
  subject: string;
  html: string;
  text: string;
  attachments?: MailerSendAttachment[];
};

export type TransactionalEmailResult = {
  messageId: string | null;
  sentAt: string;
};

export async function sendTravelerListInvitationEmail(input: {
  toEmail: string;
  toName: string;
  invitationUrl: string;
  partySize: number;
  expiresAt: string;
}) {
  const expires = formatDateTime(input.expiresAt);
  return sendEmail({
    toEmail: input.toEmail,
    toName: input.toName,
    subject: "Provide the traveler details for your Vietnam booking",
    text: [
      `Hello ${input.toName},`,
      "",
      `Thank you for choosing to continue with your Discover Southern Vietnam booking for ${input.partySize} travelers.`,
      "",
      "Before we can send each traveler the required agreement, please provide the legal name and email address for every traveler in your party:",
      input.invitationUrl,
      "",
      `This secure one-time link expires ${expires}.`,
      "No payment is collected on this page.",
    ].join("\n"),
    html: `
      <p>Hello ${escapeHtml(input.toName)},</p>
      <p>Thank you for choosing to continue with your <strong>Discover Southern Vietnam</strong> booking for ${input.partySize} travelers.</p>
      <p>Before we can send each traveler the required agreement, please provide the legal name and email address for every traveler in your party.</p>
      <p><a href="${escapeHtml(input.invitationUrl)}" style="display:inline-block;border-radius:999px;background:#593412;color:#ffffff;padding:12px 20px;text-decoration:none;font-weight:700">Provide traveler details</a></p>
      <p>This secure one-time link expires ${escapeHtml(expires)}. No payment is collected on this page.</p>
    `,
  });
}

export async function sendPaymentChoiceInvitationEmail(input: {
  toEmail: string;
  toName: string;
  invitationUrl: string;
  bookingTotalCents: number;
  expiresAt: string;
}) {
  const expires = formatDateTime(input.expiresAt);
  const total = money(input.bookingTotalCents);
  return sendEmail({
    toEmail: input.toEmail,
    toName: input.toName,
    subject: "Choose how you would like to pay for your Vietnam trip",
    text: [
      `Hello ${input.toName},`,
      "",
      "All required Traveler Agreements for your booking have been completed.",
      `Confirmed booking total: ${total}`,
      "",
      "Use the secure link below to choose payment in full or the available payment plan. After you submit your choice, Square will create and email your invoice:",
      input.invitationUrl,
      "",
      `This secure one-time link expires ${expires}.`,
    ].join("\n"),
    html: `
      <p>Hello ${escapeHtml(input.toName)},</p>
      <p>All required Traveler Agreements for your booking have been completed.</p>
      <p><strong>Confirmed booking total: ${escapeHtml(total)}</strong></p>
      <p>Choose payment in full or the available payment plan. After you submit your choice, Square will create and email your invoice.</p>
      <p><a href="${escapeHtml(input.invitationUrl)}" style="display:inline-block;border-radius:999px;background:#593412;color:#ffffff;padding:12px 20px;text-decoration:none;font-weight:700">Choose payment option</a></p>
      <p>This secure one-time link expires ${escapeHtml(expires)}.</p>
    `,
  });
}

export async function sendAgreementInvitationEmail(input: {
  toEmail: string;
  toName: string;
  travelerName: string;
  invitationUrl: string;
  expiresAt: string;
}) {
  const expires = formatDateTime(input.expiresAt);
  return sendEmail({
    toEmail: input.toEmail,
    toName: input.toName,
    subject: `Review and sign the Traveler Agreement for ${input.travelerName}`,
    text: [
      `Hello ${input.toName},`,
      "",
      `Please review and electronically sign the Cookie Paradise Travel Company Traveler Agreement for ${input.travelerName}.`,
      "",
      `Secure link: ${input.invitationUrl}`,
      `This one-time link expires ${expires}.`,
      "",
      "After opening the link, you will be asked to request a separate verification code sent to this email address before signing.",
      "",
      "If you did not expect this message, please contact trung@cookieparadise.co.",
    ].join("\n"),
    html: `
      <p>Hello ${escapeHtml(input.toName)},</p>
      <p>Please review and electronically sign the Cookie Paradise Travel Company Traveler Agreement for <strong>${escapeHtml(input.travelerName)}</strong>.</p>
      <p><a href="${escapeHtml(input.invitationUrl)}" style="display:inline-block;border-radius:999px;background:#593412;color:#ffffff;padding:12px 20px;text-decoration:none;font-weight:700">Open secure agreement</a></p>
      <p>This one-time link expires ${escapeHtml(expires)}.</p>
      <p>After opening the link, you will be asked to request a separate verification code sent to this email address before signing.</p>
      <p>If you did not expect this message, please contact <a href="mailto:trung@cookieparadise.co">trung@cookieparadise.co</a>.</p>
    `,
  });
}

export async function sendAgreementVerificationCodeEmail(input: {
  toEmail: string;
  toName: string;
  code: string;
  expiresInMinutes: number;
}) {
  return sendEmail({
    toEmail: input.toEmail,
    toName: input.toName,
    subject: "Your Cookie Paradise Travel verification code",
    text: [
      `Hello ${input.toName},`,
      "",
      `Your verification code is: ${input.code}`,
      "",
      `This code expires in ${input.expiresInMinutes} minutes. Do not share it with anyone.`,
      "",
      "Cookie Paradise Travel Company will never ask for this code by phone or text message.",
    ].join("\n"),
    html: `
      <p>Hello ${escapeHtml(input.toName)},</p>
      <p>Your verification code is:</p>
      <p style="font-size:28px;font-weight:800;letter-spacing:0.2em;color:#593412">${escapeHtml(input.code)}</p>
      <p>This code expires in ${input.expiresInMinutes} minutes. Do not share it with anyone.</p>
      <p>Cookie Paradise Travel Company will never ask for this code by phone or text message.</p>
    `,
  });
}

export async function sendSignedAgreementEmail(input: {
  toEmail: string;
  toName: string;
  travelerName: string;
  acceptedAt: string;
  pdfBase64: string;
  filename: string;
}) {
  const accepted = formatDateTime(input.acceptedAt);
  return sendEmail({
    toEmail: input.toEmail,
    toName: input.toName,
    subject: `Signed Traveler Agreement for ${input.travelerName}`,
    text: [
      `Hello ${input.toName},`,
      "",
      `Attached is your signed Cookie Paradise Travel Company Traveler Agreement for ${input.travelerName}.`,
      `It was electronically accepted on ${accepted}.`,
      "",
      "Please retain this PDF for your records.",
    ].join("\n"),
    html: `
      <p>Hello ${escapeHtml(input.toName)},</p>
      <p>Attached is your signed Cookie Paradise Travel Company Traveler Agreement for <strong>${escapeHtml(input.travelerName)}</strong>.</p>
      <p>It was electronically accepted on ${escapeHtml(accepted)}.</p>
      <p>Please retain this PDF for your records.</p>
    `,
    attachments: [{ content: input.pdfBase64, filename: input.filename, disposition: "attachment" }],
  });
}

export async function sendTravelInsuranceReferralEmail(input: {
  toEmail: string;
  toName: string;
  paymentPreference: "payment_plan" | "full" | null;
}) {
  const affiliateUrl = "https://purchase.sevencorners.com/product/u/0/ecf1f871-6681-4c8c-b6fc-2017e2ffa317";
  const paymentAcknowledgment = input.paymentPreference === "full"
    ? "Thank you for paying for your Cookie Paradise Travel Company trip in full."
    : input.paymentPreference === "payment_plan"
      ? "Thank you for making your reservation deposit toward your Cookie Paradise Travel Company trip."
      : "Thank you for making a payment toward your Cookie Paradise Travel Company trip.";
  return sendEmail({
    toEmail: input.toEmail,
    toName: input.toName,
    subject: "Consider travel insurance for your Vietnam trip",
    text: [
      `Hello ${input.toName},`,
      "",
      paymentAcknowledgment,
      "",
      "Travel insurance is not included in your trip price. We encourage you to consider whether travel insurance is appropriate for you. You may review available Seven Corners options using our referral link:",
      affiliateUrl,
      "",
      "Why consider Seven Corners? Seven Corners is a privately held travel insurance and healthcare company founded in 1993 and headquartered in Carmel, Indiana. It is BBB Accredited with an A+ rating and has an in-house 24/7 travel assistance team with live translation support in more than 130 languages. You can also speak with a licensed live agent before purchasing to compare available benefits, limits, exclusions, and optional coverage for your needs.",
      "",
      "Affiliate disclosure: Cookie Paradise Travel Company may receive marketing referral compensation if you purchase through this link. You are not required to purchase from Seven Corners, and you may choose any insurance provider.",
      "",
      "For questions about Seven Corners coverage, benefits, exclusions, or purchasing, contact Lakita Brewington at 317-455-3634 or Lakita.Brewington@sevencorners.com.",
      "",
      "Cookie Paradise Travel Company does not determine eligibility for coverage or provide advice about which policy is right for you.",
    ].join("\n"),
    html: `
      <p>Hello ${escapeHtml(input.toName)},</p>
      <p>${escapeHtml(paymentAcknowledgment)}</p>
      <p>Travel insurance is not included in your trip price. We encourage you to consider whether travel insurance is appropriate for you.</p>
      <p><a href="${affiliateUrl}" style="display:inline-block;border-radius:999px;background:#593412;color:#ffffff;padding:12px 20px;text-decoration:none;font-weight:700">Review Seven Corners options</a></p>
      <p><strong>Why consider Seven Corners?</strong> Seven Corners is a privately held travel insurance and healthcare company founded in 1993 and headquartered in Carmel, Indiana. It is BBB Accredited with an A+ rating and has an in-house 24/7 travel assistance team with live translation support in more than 130 languages. You can also speak with a licensed live agent before purchasing to compare available benefits, limits, exclusions, and optional coverage for your needs.</p>
      <p style="font-size:13px;line-height:1.6;color:#5f5145"><strong>Affiliate disclosure:</strong> Cookie Paradise Travel Company may receive marketing referral compensation if you purchase through this link. You are not required to purchase from Seven Corners, and you may choose any insurance provider.</p>
      <p>For questions about Seven Corners coverage, benefits, exclusions, or purchasing, contact Lakita Brewington at <a href="tel:+13174553634">317-455-3634</a> or <a href="mailto:Lakita.Brewington@sevencorners.com">Lakita.Brewington@sevencorners.com</a>.</p>
      <p>Cookie Paradise Travel Company does not determine eligibility for coverage or provide advice about which policy is right for you.</p>
    `,
  });
}

export async function sendAutopayAuthorizationInvitationEmail(input: {
  toEmail: string;
  toName: string;
  authorizationUrl: string;
  expiresAt: string;
}) {
  const expires = formatDateTime(input.expiresAt);
  return sendEmail({
    toEmail: input.toEmail,
    toName: input.toName,
    subject: "Optional automatic installments for your Vietnam trip",
    text: [
      `Hello ${input.toName},`,
      "",
      "Thank you for making your reservation deposit for Discover Southern Vietnam.",
      "",
      "Automatic installments are optional. If you saved your card securely with Square and would like Square to charge the remaining installments automatically, use the secure link below. The page will show the exact remaining amounts and due dates before you authorize anything:",
      input.authorizationUrl,
      "",
      `This secure one-time link expires ${expires}.`,
      "If you prefer to make each installment manually, no action is required.",
    ].join("\n"),
    html: `
      <p>Hello ${escapeHtml(input.toName)},</p>
      <p>Thank you for making your reservation deposit for <strong>Discover Southern Vietnam</strong>.</p>
      <p>Automatic installments are optional. If you saved your card securely with Square and would like Square to charge the remaining installments automatically, use the secure link below. The page will show the exact remaining amounts and due dates before you authorize anything.</p>
      <p><a href="${escapeHtml(input.authorizationUrl)}" style="display:inline-block;border-radius:999px;background:#593412;color:#ffffff;padding:12px 20px;text-decoration:none;font-weight:700">Review automatic installments</a></p>
      <p>This secure one-time link expires ${escapeHtml(expires)}. If you prefer to make each installment manually, no action is required.</p>
    `,
  });
}

async function sendEmail(input: SendEmailInput): Promise<TransactionalEmailResult> {
  const runtime = env as unknown as Record<string, string | undefined>;
  const token = runtime.MAILERSEND_API_TOKEN?.trim();
  const fromEmail = runtime.MAILERSEND_FROM_EMAIL?.trim();
  const fromName = runtime.MAILERSEND_FROM_NAME?.trim() || "Cookie Paradise Travel Company";
  if (!token || !fromEmail) {
    throw new Error("Transactional email is not configured.");
  }

  const response = await fetch("https://api.mailersend.com/v1/email", {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { email: fromEmail, name: fromName },
      to: [{ email: input.toEmail, name: input.toName }],
      reply_to: { email: "trung@cookieparadise.co", name: "Trung Le" },
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: input.attachments,
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Transactional email could not be sent (${response.status}). ${detail}`.trim());
  }

  return {
    messageId: response.headers.get("x-message-id"),
    sentAt: new Date().toISOString(),
  };
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("en-US", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "America/Indiana/Indianapolis",
      })
    : value;
}

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
