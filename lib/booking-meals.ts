import { env } from "cloudflare:workers";

// Additive storage keeps existing bookings and signed agreement snapshots unchanged.
export const bookingMealsStorageSql = `CREATE TABLE IF NOT EXISTS booking_meal_preferences (
  booking_request_id integer PRIMARY KEY NOT NULL REFERENCES booking_requests(id) ON DELETE cascade,
  all_meals_included integer NOT NULL DEFAULT 0 CHECK (all_meals_included IN (0,1))
)`;

export async function ensureBookingMealsStorage() {
  await env.DB!.prepare(bookingMealsStorageSql).run();
}

export async function bookingIncludesAllMeals(bookingId: number) {
  await ensureBookingMealsStorage();
  const row = await env.DB!.prepare("SELECT all_meals_included FROM booking_meal_preferences WHERE booking_request_id=?")
    .bind(bookingId).first<{ all_meals_included: number }>();
  return row?.all_meals_included === 1;
}
