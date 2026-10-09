import assert from "node:assert/strict";
import test from "node:test";
import {
  getSquareCredentialValues,
  getSquareWebhookSignatureKey,
  getSquareWebhookValues,
} from "./square-config.ts";

const runtime = {
  SQUARE_ACCESS_TOKEN: "sandbox-token",
  SQUARE_LOCATION_ID: "sandbox-location",
  SQUARE_WEBHOOK_SIGNATURE_KEY: "sandbox-signature",
  SQUARE_PRODUCTION_ACCESS_TOKEN: "production-token",
  SQUARE_PRODUCTION_LOCATION_ID: "production-location",
  SQUARE_PRODUCTION_WEBHOOK_SIGNATURE_KEY: "production-signature",
  SQUARE_WEBHOOK_NOTIFICATION_URL: "https://example.com/api/square/webhook",
  SQUARE_PRODUCTION_WEBHOOK_NOTIFICATION_URL: "https://example.com/api/square/webhook?environment=production",
};

test("Sandbox uses only Sandbox Square credentials", () => {
  assert.deepEqual(getSquareCredentialValues({ ...runtime, SQUARE_ENV: "sandbox" }), {
    environment: "sandbox",
    accessToken: "sandbox-token",
    locationId: "sandbox-location",
  });
  assert.equal(
    getSquareWebhookSignatureKey({ ...runtime, SQUARE_ENV: "sandbox" }),
    "sandbox-signature",
  );
});

test("Production uses only Production Square credentials", () => {
  assert.deepEqual(getSquareCredentialValues({ ...runtime, SQUARE_ENV: "production" }), {
    environment: "production",
    accessToken: "production-token",
    locationId: "production-location",
  });
  assert.equal(
    getSquareWebhookSignatureKey({ ...runtime, SQUARE_ENV: "production" }),
    "production-signature",
  );
});

test("Production never falls back to Sandbox credentials", () => {
  assert.deepEqual(getSquareCredentialValues({
    SQUARE_ENV: "production",
    SQUARE_ACCESS_TOKEN: "sandbox-token",
    SQUARE_LOCATION_ID: "sandbox-location",
  }), {
    environment: "production",
    accessToken: undefined,
    locationId: undefined,
  });
  assert.equal(getSquareWebhookSignatureKey({
    SQUARE_ENV: "production",
    SQUARE_WEBHOOK_SIGNATURE_KEY: "sandbox-signature",
  }), undefined);
});

test("Webhook configuration follows the notification URL environment", () => {
  assert.deepEqual(
    getSquareWebhookValues(runtime, "https://example.com/api/square/webhook"),
    {
      environment: "sandbox",
      signatureKey: "sandbox-signature",
      notificationUrl: "https://example.com/api/square/webhook",
    },
  );
  assert.deepEqual(
    getSquareWebhookValues(runtime, "https://example.com/api/square/webhook?environment=production"),
    {
      environment: "production",
      signatureKey: "production-signature",
      notificationUrl: "https://example.com/api/square/webhook?environment=production",
    },
  );
});
