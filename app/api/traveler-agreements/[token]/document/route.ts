import { agreementPdfFilename, generateAgreementPdf } from "@/lib/agreement-pdf";
import { getAgreementInvitation } from "@/lib/agreement-invitation";
import { currentTravelerAgreement } from "@/lib/traveler-agreement";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  if (!currentTravelerAgreement) {
    return Response.json({ error: "Traveler agreement acceptance is not active." }, { status: 503 });
  }

  const { token } = await context.params;
  const result = await getAgreementInvitation(token);
  if (result.status !== "ready") {
    const status = result.status === "expired" ? 410 : result.status === "accepted" ? 409 : 404;
    return Response.json({ error: "This agreement link is invalid or unavailable." }, { status });
  }

  try {
    const pdf = await generateAgreementPdf({ agreement: currentTravelerAgreement });
    const travelerName = `${result.invitation.firstName} ${result.invitation.lastName}`;
    return new Response(pdf, {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="${agreementPdfFilename(travelerName, false)}"`,
        "content-type": "application/pdf",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (cause) {
    console.error("Traveler agreement PDF generation failed", {
      invitationId: result.invitation.invitationId,
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return Response.json({
      error: "We couldn't prepare the agreement document right now. Please try again in a few minutes.",
    }, { status: 503 });
  }
}
