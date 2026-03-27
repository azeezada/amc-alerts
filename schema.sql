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
  active INTEGER DEFAULT 1,
  ab_variant TEXT DEFAULT NULL,
  referral_code TEXT UNIQUE DEFAULT NULL,
  referred_by TEXT DEFAULT NULL
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

CREATE TABLE IF NOT EXISTS rsvps (
  showtime_id TEXT NOT NULL,
  anonymous_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (showtime_id, anonymous_id)
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

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  movie_slug TEXT NOT NULL,
  anonymous_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (movie_slug, anonymous_id)
);

CREATE TABLE IF NOT EXISTS discussions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  showtime_id TEXT NOT NULL,
  anonymous_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_discussions_showtime ON discussions(showtime_id, created_at);

CREATE TABLE IF NOT EXISTS ticket_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  movie_slug TEXT NOT NULL,
  showtime_date TEXT NOT NULL,
  theater_slug TEXT NOT NULL,
  format_tag TEXT NOT NULL,
  first_seen_at TEXT DEFAULT (datetime('now')),
  UNIQUE(movie_slug, showtime_date, theater_slug, format_tag)
);

CREATE INDEX IF NOT EXISTS idx_ticket_history_movie ON ticket_history(movie_slug, first_seen_at);

CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  movie_slug TEXT NOT NULL,
  showtime_date TEXT NOT NULL,
  theater_slug TEXT NOT NULL,
  format_tag TEXT NOT NULL,
  promo TEXT,
  showtime_count INTEGER NOT NULL DEFAULT 0,
  observed_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_price_history_movie ON price_history(movie_slug, observed_at);

CREATE TABLE IF NOT EXISTS email_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  email TEXT NOT NULL,
  run_id TEXT,
  url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_events_email ON email_events(email, created_at);
CREATE INDEX IF NOT EXISTS idx_email_events_run ON email_events(run_id, event_type);

-- Tracks showtime status transitions: Sellable → AlmostFull → SoldOut
-- One row per (showtime_id, from_status → to_status) transition event
CREATE TABLE IF NOT EXISTS showtime_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  showtime_id TEXT NOT NULL,
  movie_slug TEXT NOT NULL,
  showtime_date TEXT NOT NULL,
  theater_slug TEXT NOT NULL,
  format_tag TEXT NOT NULL,
  showtime_time TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  observed_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_status_history_showtime ON showtime_status_history(showtime_id, observed_at);
CREATE INDEX IF NOT EXISTS idx_status_history_movie ON showtime_status_history(movie_slug, showtime_date);
