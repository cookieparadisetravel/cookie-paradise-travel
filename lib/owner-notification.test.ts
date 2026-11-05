import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "../test-support/lead-fixture.ts";

const inquiry = {
  id: 42, fullName: "Travel & Friends", email: "customer@example.test", phone: "",
  departure: "2027-06-01", room: "twin", partySize: 2, notes: "",
  contactConsent: true, sellerOfTravelStateResident: false, residenceState: null,
  bookingIntent: "needs_information" as const,
};

test("new website inquiries email the owner directly and preserve the webhook fallback", async t => {
  const runtime = {
    SQUARE_ENV: "production",
    ADMIN_OWNER_EMAIL: "owner@example.test",
    MAILERSEND_API_TOKEN: "test",
    MAILERSEND_FROM_EMAIL: "travel@example.test",
    OWNER_NOTIFICATION_WEBHOOK_URL: "https://example.test/owner-alert",
  };
  const email = await loadModule<typeof import("./mailersend-transactional")>("lib/mailersend-transactional.ts", {
    "cloudflare:workers": { env: runtime },
    "./consultation": { consultationBookingUrl: "https://example.test/consultation" },
  });
  const { sendOwnerInquiryNotification } = await loadModule<typeof import("./owner-notification")>("lib/owner-notification.ts", {
    "cloudflare:workers": { env: runtime },
    "./mailersend-transactional": { sendOwnerInquiryEmail: email.sendOwnerInquiryEmail },
  });
  const deliveries: { url: string; body: Record<string, unknown> }[] = [];
  let responseStatus = 202;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    deliveries.push({ url, body: JSON.parse(String(init.body)) });
    return new Response(null, { status: responseStatus });
  });

  assert.equal(await sendOwnerInquiryNotification(inquiry), "sent");
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].url, "https://api.mailersend.com/v1/email");
  assert.deepEqual(deliveries[0].body.to, [{ email: "owner@example.test", name: "Trung" }]);
  assert.equal(deliveries[0].body.subject, "New Vietnam trip inquiry");
  assert.match(String(deliveries[0].body.html), /Travel &amp; Friends/);
  assert.match(String(deliveries[0].body.html), /cookieparadisetravel\.com\/admin\/inquiries\/42/);

  responseStatus = 503;
  assert.equal(await sendOwnerInquiryNotification(inquiry), "error");
  assert.equal(deliveries.length, 2);
  assert.equal(deliveries[1].url, "https://api.mailersend.com/v1/email");

  runtime.MAILERSEND_API_TOKEN = "";
  responseStatus = 202;
  assert.equal(await sendOwnerInquiryNotification(inquiry), "sent");
  assert.equal(deliveries[2].url, runtime.OWNER_NOTIFICATION_WEBHOOK_URL);
  assert.equal(deliveries[2].body.event, "travel_inquiry.created");
});
