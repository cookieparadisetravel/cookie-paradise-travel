CREATE TABLE IF NOT EXISTS meta_lead_sync (
  id INTEGER PRIMARY KEY CHECK(id=1),
  lease_id TEXT,
  lease_until TEXT,
  checked_at TEXT,
  last_success_at TEXT,
  result_json TEXT
);
