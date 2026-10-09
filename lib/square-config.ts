export type SquareEnvironment = "sandbox" | "production";

type SquareRuntime = Record<string, string | undefined>;

export function getSquareEnvironment(runtime: SquareRuntime): SquareEnvironment {
  return runtime.SQUARE_ENV === "production" ? "production" : "sandbox";
}

export function getSquareCredentialValues(runtime: SquareRuntime) {
  const environment = getSquareEnvironment(runtime);
  return {
    environment,
    accessToken: environment === "production"
      ? runtime.SQUARE_PRODUCTION_ACCESS_TOKEN
      : runtime.SQUARE_ACCESS_TOKEN,
    locationId: environment === "production"
      ? runtime.SQUARE_PRODUCTION_LOCATION_ID
      : runtime.SQUARE_LOCATION_ID,
  };
}

export function getSquareWebhookSignatureKey(runtime: SquareRuntime) {
  return getSquareEnvironment(runtime) === "production"
    ? runtime.SQUARE_PRODUCTION_WEBHOOK_SIGNATURE_KEY
    : runtime.SQUARE_WEBHOOK_SIGNATURE_KEY;
}
