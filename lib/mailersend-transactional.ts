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
      "If you did not expect this message, please contact trung@cookieparadisetravel.com.",
    ].join("\n"),
    html: `
      <p>Hello ${escapeHtml(input.toName)},</p>
      <p>Please review and electronically sign the Cookie Paradise Travel Company Traveler Agreement for <strong>${escapeHtml(input.travelerName)}</strong>.</p>
      <p><a href="${escapeHtml(input.invitationUrl)}" style="display:inline-block;border-radius:999px;background:#593412;color:#ffffff;padding:12px 20px;text-decoration:none;font-weight:700">Open secure agreement</a></p>
      <p>This one-time link expires ${escapeHtml(expires)}.</p>
      <p>After opening the link, you will be asked to request a separate verification code sent to this email address before signing.</p>
      <p>If you did not expect this message, please contact <a href="mailto:trung@cookieparadisetravel.com">trung@cookieparadisetravel.com</a>.</p>
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
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { email: fromEmail, name: fromName },
      to: [{ email: input.toEmail, name: input.toName }],
      reply_to: { email: "trung@cookieparadisetravel.com", name: "Trung Le" },
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
