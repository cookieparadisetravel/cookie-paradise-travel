declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    SQUARE_ENV?: string;
    SQUARE_APPLICATION_ID?: string;
    SQUARE_LOCATION_ID?: string;
    SQUARE_ACCESS_TOKEN?: string;
  }
}
