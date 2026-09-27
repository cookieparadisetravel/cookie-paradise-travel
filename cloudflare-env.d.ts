declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    SQUARE_ENV?: string;
    SQUARE_APPLICATION_ID?: string;
    SQUARE_LOCATION_ID?: string;
    SQUARE_ACCESS_TOKEN?: string;
    CF_ACCESS_TEAM_DOMAIN?: string;
    CF_ACCESS_AUD?: string;
    ADMIN_OWNER_EMAIL?: string;
    TURNSTILE_SECRET_KEY?: string;
  }
}
