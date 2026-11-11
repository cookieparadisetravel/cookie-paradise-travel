CREATE TABLE IF NOT EXISTS owner_workspace_photos (
  id text PRIMARY KEY NOT NULL,
  title text NOT NULL,
  alt text NOT NULL,
  position text NOT NULL,
  mime text NOT NULL,
  bytes blob NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
