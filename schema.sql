CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  dates TEXT DEFAULT '["2026-04-01","2026-04-02","2026-04-03","2026-04-04","2026-04-05"]',
  movie_slug TEXT DEFAULT 'project-hail-mary-76779',
  movie_title TEXT DEFAULT 'Project Hail Mary',
  theater_slugs TEXT DEFAULT NULL,
  phone_number TEXT DEFAULT NULL,
  notification_channel TEXT DEFAULT 'email',
  subscribed_at TEXT DEFAULT (datetime('now')),
  notified_at TEXT,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS showtime_cache (
  date TEXT PRIMARY KEY,
  data TEXT,
  checked_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  host_name TEXT NOT NULL,
  host_email TEXT,
  movie_slug TEXT DEFAULT 'project-hail-mary-76779',
  movie_title TEXT DEFAULT 'Project Hail Mary',
  theater_slugs TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS group_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL REFERENCES groups(id),
  member_name TEXT NOT NULL,
  voted_showtimes TEXT DEFAULT '[]',
  joined_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scraper_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  duration_ms INTEGER,
  movies_checked INTEGER DEFAULT 0,
  theaters_checked INTEGER DEFAULT 0,
  formats_checked INTEGER DEFAULT 0,
  total_new_showtimes INTEGER DEFAULT 0,
  total_notified INTEGER DEFAULT 0,
  error_message TEXT DEFAULT NULL,
  ran_at TEXT DEFAULT (datetime('now'))
);
