import { env } from "cloudflare:workers";
import type { AgreementAcceptanceSnapshot } from "@/lib/agreement-acceptance-record";
import type { AgreementDocument } from "@/lib/traveler-agreement";

type BrowserRunBinding = {
  quickAction(action: "pdf", input: Record<string, unknown>): Promise<Response>;
};

export async function generateAgreementPdf(input: {
  agreement: AgreementDocument;
  snapshot?: AgreementAcceptanceSnapshot;
}) {
  const runtime = env as unknown as { BROWSER?: BrowserRunBinding };
  if (!runtime.BROWSER) throw new Error("Agreement PDF generation is not configured.");

  const html = renderAgreementHtml(input.agreement, input.snapshot);
  const response = await runtime.BROWSER.quickAction("pdf", {
    html,
    pdfOptions: {
      format: "letter",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div style="width:100%;font-size:8px;color:#6b4a2b;padding:0 36px;text-align:center">Cookie Paradise Travel Company</div>',
      footerTemplate: '<div style="width:100%;font-size:8px;color:#777;padding:0 36px;text-align:center">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
      margin: { top: "52px", bottom: "52px", left: "48px", right: "48px" },
    },
  });
  if (!response.ok) {
    throw new Error(`Agreement PDF could not be generated (${response.status}).`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error("Agreement PDF generation returned an empty file.");
  return bytes;
}

export function pdfBytesToBase64(bytes: Uint8Array) {
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export function agreementPdfFilename(travelerName: string, signed: boolean) {
  const safeName = travelerName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^A-Za-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80) || "traveler";
  return `${signed ? "signed" : "unsigned"}-traveler-agreement-${safeName}.pdf`;
}

function renderAgreementHtml(agreement: AgreementDocument, snapshot?: AgreementAcceptanceSnapshot) {
  const sections = agreement.sections.map((section) => `
    <section>
      <h${section.level === 1 ? "2" : "3"}>${escapeHtml(section.heading)}</h${section.level === 1 ? "2" : "3"}>
      ${section.blocks.map((block) => block.type === "paragraph"
        ? `<p>${block.segments.map((segment) => {
            const text = agreementTextForPdf(segment.text, snapshot);
            return segment.strong ? `<strong>${escapeHtml(text)}</strong>` : escapeHtml(text);
          }).join("")}</p>`
        : `<table><thead><tr>${block.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${block.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`).join("")}
    </section>
  `).join("");
  const signing = snapshot ? `
    <section class="signature">
      <h2>Electronic Acceptance Record</h2>
      <dl>
        <dt>Traveler</dt><dd>${escapeHtml(snapshot.travelerName)}</dd>
        <dt>Signer</dt><dd>${escapeHtml(snapshot.signerLegalName)}</dd>
        <dt>Signer type</dt><dd>${escapeHtml(snapshot.signerType)}</dd>
        <dt>Email verified</dt><dd>${escapeHtml(formatDateTime(snapshot.emailVerifiedAt))} · ${escapeHtml(snapshot.signerEmail)}</dd>
        ${snapshot.minorDateOfBirth ? `<dt>Minor date of birth</dt><dd>${escapeHtml(snapshot.minorDateOfBirth)}</dd>` : ""}
        ${snapshot.guardianRelationship ? `<dt>Guardian relationship</dt><dd>${escapeHtml(snapshot.guardianRelationship)}</dd>` : ""}
        <dt>Traveler/guardian initials</dt><dd>${escapeHtml(snapshot.travelerInitials)}</dd>
        <dt>Signed</dt><dd>${escapeHtml(formatDateTime(snapshot.acceptedAt))}</dd>
        <dt>Company acceptance</dt><dd>${escapeHtml(formatDateTime(snapshot.companyAcceptedAt))} · ${escapeHtml(snapshot.companyAcceptedBy)}</dd>
        <dt>Agreement version</dt><dd>${escapeHtml(snapshot.agreementVersion)}</dd>
        <dt>Document SHA-256</dt><dd class="hash">${escapeHtml(snapshot.agreementDocumentHash)}</dd>
      </dl>
      <h3>Separate acknowledgments</h3>
      <ul>
        <li>Electronic signature and electronic-record disclosure: accepted</li>
        <li>Entire Traveler Agreement: accepted</li>
        <li>$500 per traveler nonrefundable reservation deposit: acknowledged</li>
        <li>Cancellation terms: acknowledged</li>
        <li>Completed Schedule 1: acknowledged</li>
        <li>Health and ability to participate: acknowledged</li>
        <li>Travel-insurance decision: ${escapeHtml(snapshot.insuranceSelection.replaceAll("_", " "))}</li>
        <li>Section 20A ordinary-negligence release: acknowledged</li>
        <li>Section 20B limitation of liability: acknowledged</li>
        <li>Appendix C Vietnam Traveler Safety Briefing: acknowledged</li>
        <li>Optional photo and media permission: ${snapshot.photoMediaOptIn ? "granted" : "not granted"}</li>
      </ul>
      <p class="notice">The signer typed the legal name shown above and selected “Accept and sign agreement” after verifying the recorded email address.</p>
    </section>
  ` : `
    <section class="signature">
      <h2>Paper acceptance</h2>
      <p>Use this section only when signing the complete personalized Agreement by hand on paper.</p>
      <p><strong>Adult traveler legal name:</strong> ______________________________________________</p>
      <p><strong>Email or mailing address used to deliver this Agreement:</strong> ______________________________________________</p>
      <p><strong>Traveler (or parent/guardian) initials for each required acknowledgment:</strong> __________</p>
      <p><strong>Traveler signature:</strong> ____________________________________ <strong>Date:</strong> __________________</p>
      <h3>Parent or guardian acceptance for a minor</h3>
      <p><strong>Minor’s legal name and date of birth:</strong> ______________________________________________</p>
      <p><strong>Parent/guardian legal name and relationship:</strong> ______________________________________________</p>
      <p>I confirm that I am authorized to consent for this minor and sign this Agreement on the minor’s behalf and in my own name as provided in Section 28.</p>
      <p><strong>Parent/guardian signature:</strong> ______________________________ <strong>Date:</strong> __________________</p>
      <h3>Optional photo and media permission</h3>
      <p>☐ I opt in to the photo and media permission in Section 30.</p>
      <p><strong>Company representative:</strong> ______________________________ <strong>Date:</strong> __________________</p>
    </section>
  `;

  return `<!doctype html>
  <html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(agreement.title)}</title>
  <style>
    *{box-sizing:border-box} body{font-family:Arial,"Noto Sans",sans-serif;color:#2f2117;font-size:11px;line-height:1.55;margin:0}
    header{border-bottom:3px solid #f7b658;padding-bottom:16px;margin-bottom:22px} h1{color:#593412;font-size:25px;margin:0 0 6px} h2{color:#593412;font-size:16px;margin:22px 0 8px;page-break-after:avoid} h3{color:#593412;font-size:13px;margin:16px 0 6px} p{margin:0 0 9px;white-space:pre-wrap} .meta{color:#6b5a4c;font-weight:700}.signature{margin-top:28px;border:2px solid #593412;border-radius:10px;padding:18px;page-break-inside:avoid}.signature dl{display:grid;grid-template-columns:145px 1fr;gap:5px 12px;margin:0}.signature dt{font-weight:700}.signature dd{margin:0}.hash{font-family:monospace;font-size:8px;overflow-wrap:anywhere}.notice{margin-top:14px;background:#fff4df;border-left:4px solid #f7b658;padding:10px} ul{padding-left:20px} li{margin-bottom:5px}
    table{width:100%;border-collapse:collapse;margin:10px 0 16px;page-break-inside:avoid} th,td{border:1px solid #cdbda9;padding:7px;text-align:left;vertical-align:top} th{background:#f7efdf;color:#593412;font-weight:700}
  </style></head><body>
    <header><h1>${escapeHtml(agreement.title)}</h1><div class="meta">Cookie Paradise Travel Company · Version ${escapeHtml(agreement.version)} · Effective ${escapeHtml(agreement.effectiveDate)}</div></header>
    ${sections}${signing}
  </body></html>`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "long",
    timeZone: "America/Indiana/Indianapolis",
  });
}

function agreementTextForPdf(value: string, snapshot?: AgreementAcceptanceSnapshot) {
  if (!snapshot) return value;
  return value
    .replace(/_{4,}/gu, snapshot.travelerInitials)
    .replace("☐ I will purchase travel insurance.", `${snapshot.insuranceSelection === "will_purchase" ? "☒" : "☐"} I will purchase travel insurance.`)
    .replace("☐ I understand that travel insurance is strongly recommended, but I decline it at this time.", `${snapshot.insuranceSelection === "declined" ? "☒" : "☐"} I understand that travel insurance is strongly recommended, but I decline it at this time.`);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
