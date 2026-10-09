export type SquareEnvironment = "sandbox" | "production";

type SquareRuntime = Record<string, string | undefined>;

export function getSquareEnvironment(runtime: SquareRuntime): SquareEnvironment {
  return runtime.SQUARE_ENV === "production" ? "production" : "sandbox";
}

export function getSquareBookingEnvironmentError(
  bookingEnvironment: unknown,
  runtime: SquareRuntime,
): string | null {
  if (bookingEnvironment !== "sandbox" && bookingEnvironment !== "production") {
    return "This booking's payment environment could not be verified. Please contact Cookie Paradise Travel Company.";
  }
  if (bookingEnvironment !== getSquareEnvironment(runtime)) {
    return `This booking belongs to Square ${bookingEnvironment === "sandbox" ? "Sandbox testing" : "Production"} and cannot be processed in the site's current payment environment. Please contact Cookie Paradise Travel Company. No payment changes were made.`;
  }
  return null;
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

export function getSquareWebhookSignatureKey(
  runtime: SquareRuntime,
  environment: SquareEnvironment = getSquareEnvironment(runtime),
) {
  return environment === "production"
    ? runtime.SQUARE_PRODUCTION_WEBHOOK_SIGNATURE_KEY
    : runtime.SQUARE_WEBHOOK_SIGNATURE_KEY;
}

export function getSquareWebhookValues(
  runtime: SquareRuntime,
  requestUrl: string,
) {
  const environment: SquareEnvironment = new URL(requestUrl).searchParams.get("environment") === "production"
    ? "production"
    : "sandbox";

  return {
    environment,
    signatureKey: getSquareWebhookSignatureKey(runtime, environment),
    notificationUrl: environment === "production"
      ? runtime.SQUARE_PRODUCTION_WEBHOOK_NOTIFICATION_URL
      : runtime.SQUARE_WEBHOOK_NOTIFICATION_URL,
  };
}
