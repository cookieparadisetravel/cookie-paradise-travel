CREATE TABLE IF NOT EXISTS booking_meal_preferences (
  booking_request_id integer PRIMARY KEY NOT NULL REFERENCES booking_requests(id) ON DELETE cascade,
  all_meals_included integer NOT NULL DEFAULT 0 CHECK (all_meals_included IN (0,1))
);
