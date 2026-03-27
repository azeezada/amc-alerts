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
