declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    AUTOMATED_BOOKING_ENABLED?: string;
    SQUARE_ENV?: string;
    SQUARE_APPLICATION_ID?: string;
    SQUARE_LOCATION_ID?: string;
    SQUARE_ACCESS_TOKEN?: string;
    SQUARE_WEBHOOK_SIGNATURE_KEY?: string;
    SQUARE_PRODUCTION_LOCATION_ID?: string;
    SQUARE_PRODUCTION_ACCESS_TOKEN?: string;
    SQUARE_PRODUCTION_WEBHOOK_SIGNATURE_KEY?: string;
    SQUARE_WEBHOOK_NOTIFICATION_URL?: string;
    CF_ACCESS_TEAM_DOMAIN?: string;
    CF_ACCESS_AUD?: string;
    ADMIN_OWNER_EMAIL?: string;
    TURNSTILE_SECRET_KEY?: string;
    ACCEPTANCE_IP_HASH_KEY?: string;
  }
}
