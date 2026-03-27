"use client";

import { useState, useEffect } from "react";

interface ByMovie {
  movie_slug: string | null;
  movie_title: string | null;
  count: number;
}

interface ByChannel {
  notification_channel: string | null;
  count: number;
}

interface RecentSub {
  email: string;
  movie_title: string | null;
  notification_channel: string | null;
  subscribed_at: string | null;
}

interface RecentNotified {
  email: string;
  movie_title: string | null;
  notification_channel: string | null;
  notified_at: string | null;
}

interface SignupsByDay {
  day: string;
  count: number;
}

interface DatePref {
  pref_date: string;
  count: number;
}

interface ScraperRun {
  id: number;
  run_id: string;
  status: string;
  duration_ms: number | null;
  movies_checked: number;
  theaters_checked: number;
  formats_checked: number;
  total_new_showtimes: number;
  total_notified: number;
  error_message: string | null;
  ran_at: string | null;
}

interface AdminData {
  devMode?: boolean;
  subscribers: {
    total: number;
    active: number;
    inactive: number;
    byMovie: ByMovie[];
    byChannel: ByChannel[];
    recentSubscriptions: RecentSub[];
    recentlyNotified: RecentNotified[];
  };
  analytics?: {
    signupsByDay: SignupsByDay[];
    datePreferences: DatePref[];
    openRateNote: string;
  };
  scraper: {
    cacheEntries: number;
    lastCheckedAt: string | null;
    cacheAgeMinutes: number | null;
    status: "healthy" | "stale" | "degraded" | "unknown";
  };
  scraperMonitoring?: {
    recentRuns: ScraperRun[];
    totalRuns: number;
    successRuns: number;
    errorRuns: number;
    avgDurationMs: number;
    successRate: number | null;
  };
  error?: string;
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const masked = local.length <= 2 ? local[0] + "*" : local[0] + "*".repeat(local.length - 2) + local[local.length - 1];
  return `${masked}@${domain}`;
}

const scraperStatusColor: Record<string, string> = {
  healthy: "#22c55e",
  stale: "#f59e0b",
  degraded: "#ef4444",
  unknown: "var(--text-tertiary)",
};

const scraperStatusLabel: Record<string, string> = {
  healthy: "Healthy",
  stale: "Stale",
  degraded: "Degraded",
  unknown: "Unknown",
};

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const s = params.get("secret");
    if (s) {
      setSecret(s);
      fetchData(s);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async (s: string) => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(`/api/admin?secret=${encodeURIComponent(s)}`);
      const json = await resp.json() as AdminData;
      if (!resp.ok) {
        setError((json as { error?: string }).error ?? "Unauthorized");
        setLoading(false);
        return;
      }
      setData(json);
      setAuthed(true);
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "var(--space-lg)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "var(--space-xs)",
    display: "block",
  };

  const statNumStyle: React.CSSProperties = {
    fontSize: 36,
    fontWeight: 800,
    color: "var(--text-primary)",
    lineHeight: 1,
    marginBottom: 4,
  };

  return (
    <div style={{ minHeight: "100vh", padding: "var(--space-2xl) var(--space-lg)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", marginBottom: "var(--space-lg)" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "var(--accent)",
              padding: "4px 12px",
              borderRadius: 4,
            }}
          >
            <span style={{ color: "#fff", fontSize: "var(--text-xs)", fontWeight: 800, letterSpacing: "2px" }}>
              AMC ALERTS
            </span>
          </div>
          <a href="/" style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", textDecoration: "none" }}>
            ← Home
          </a>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 var(--space-xs)", color: "var(--text-primary)" }}>
          Admin Dashboard
        </h1>

        {/* Auth gate */}
        {!authed && (
          <div style={{ marginTop: "var(--space-xl)" }}>
            {error && (
              <div
                style={{
                  background: "rgba(227, 24, 55, 0.1)",
                  border: "1px solid var(--accent)",
                  borderRadius: 4,
                  padding: "var(--space-sm) var(--space-md)",
                  marginBottom: "var(--space-lg)",
                  fontSize: "var(--text-sm)",
                  color: "var(--accent)",
                }}
              >
                {error}
              </div>
            )}
            <div style={cardStyle}>
              <label style={labelStyle}>Admin secret</label>
              <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                <input
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchData(secret)}
                  placeholder="Enter admin secret"
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    background: "var(--bg-base)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    color: "var(--text-primary)",
                    fontSize: "var(--text-sm)",
                  }}
                />
                <button
                  onClick={() => fetchData(secret)}
                  disabled={loading}
                  style={{
                    padding: "10px 20px",
                    background: "var(--accent)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    fontSize: "var(--text-sm)",
                    fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? "Loading..." : "Access"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard */}
        {authed && data && (
          <div>
            {data.devMode && (
              <div
                style={{
                  background: "rgba(245, 158, 11, 0.1)",
                  border: "1px solid #f59e0b",
                  borderRadius: 4,
                  padding: "var(--space-sm) var(--space-md)",
                  marginBottom: "var(--space-lg)",
                  fontSize: "var(--text-xs)",
                  color: "#f59e0b",
                }}
              >
                Dev mode — showing mock data (no D1 database connected)
              </div>
            )}

            {/* Stat cards row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "var(--space-md)",
                marginBottom: "var(--space-xl)",
                marginTop: "var(--space-lg)",
              }}
            >
              <div style={cardStyle}>
                <span style={labelStyle}>Total subscribers</span>
                <div style={statNumStyle}>{data.subscribers.total}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>all time</div>
              </div>
              <div style={cardStyle}>
                <span style={labelStyle}>Active</span>
                <div style={{ ...statNumStyle, color: "#22c55e" }}>{data.subscribers.active}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>watching for tickets</div>
              </div>
              <div style={cardStyle}>
                <span style={labelStyle}>Unsubscribed</span>
                <div style={{ ...statNumStyle, color: "var(--text-tertiary)" }}>{data.subscribers.inactive}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>opted out</div>
              </div>
              <div style={cardStyle}>
                <span style={labelStyle}>Scraper</span>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: scraperStatusColor[data.scraper.status] ?? "var(--text-tertiary)",
                    marginBottom: 4,
                  }}
                >
                  {scraperStatusLabel[data.scraper.status] ?? "Unknown"}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                  {data.scraper.cacheAgeMinutes !== null
                    ? `last check ${data.scraper.cacheAgeMinutes}m ago`
                    : "no cache data"}
                </div>
              </div>
            </div>

            {/* Middle row: By movie + By channel + Scraper health */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "var(--space-md)",
                marginBottom: "var(--space-xl)",
              }}
            >
              {/* By movie */}
              <div style={cardStyle}>
                <span style={labelStyle}>Active by movie</span>
                {data.subscribers.byMovie.length === 0 ? (
                  <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)", margin: 0 }}>No data</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                    {data.subscribers.byMovie.map((m) => (
                      <div key={m.movie_slug ?? "null"} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                          {m.movie_title ?? m.movie_slug ?? "Unknown"}
                        </span>
                        <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>
                          {m.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* By channel */}
              <div style={cardStyle}>
                <span style={labelStyle}>Active by channel</span>
                {data.subscribers.byChannel.length === 0 ? (
                  <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)", margin: 0 }}>No data</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                    {data.subscribers.byChannel.map((c) => (
                      <div key={c.notification_channel ?? "null"} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "capitalize" }}>
                          {c.notification_channel ?? "email"}
                        </span>
                        <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>
                          {c.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Scraper health detail */}
              <div style={cardStyle}>
                <span style={labelStyle}>Scraper health</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>Cache entries</span>
                    <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>
                      {data.scraper.cacheEntries}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>Last check</span>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-primary)" }}>
                      {formatRelativeTime(data.scraper.lastCheckedAt)}
                    </span>
                  </div>
                  {data.scraper.lastCheckedAt && (
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", wordBreak: "break-all" }}>
                      {new Date(data.scraper.lastCheckedAt).toLocaleString()}
                    </div>
                  )}
                  <div
                    style={{
                      marginTop: "var(--space-xs)",
                      padding: "4px 8px",
                      borderRadius: 4,
                      background: `${scraperStatusColor[data.scraper.status] ?? "#666"}22`,
                      color: scraperStatusColor[data.scraper.status] ?? "var(--text-tertiary)",
                      fontSize: "var(--text-xs)",
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  >
                    {scraperStatusLabel[data.scraper.status]}
                    {data.scraper.cacheAgeMinutes !== null && ` — ${data.scraper.cacheAgeMinutes}m since last run`}
                  </div>
                </div>
              </div>
            </div>

            {/* Analytics */}
            {data.analytics && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "var(--space-md)",
                  marginBottom: "var(--space-xl)",
                }}
              >
                {/* Signups over time */}
                <div style={cardStyle}>
                  <span style={labelStyle}>Signups over time</span>
                  {data.analytics.signupsByDay.length === 0 ? (
                    <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)", margin: 0 }}>No data</p>
                  ) : (() => {
                    const maxCount = Math.max(...data.analytics!.signupsByDay.map((d) => d.count), 1);
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {data.analytics!.signupsByDay.slice(0, 14).map((d) => (
                          <div key={d.day} style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", minWidth: 72 }}>
                              {d.day.slice(5)}
                            </span>
                            <div
                              style={{
                                height: 14,
                                borderRadius: 3,
                                background: "var(--accent)",
                                opacity: 0.8,
                                width: `${Math.round((d.count / maxCount) * 100)}%`,
                                minWidth: 4,
                                transition: "width 0.3s",
                              }}
                            />
                            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", minWidth: 20 }}>
                              {d.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Date preferences */}
                <div style={cardStyle}>
                  <span style={labelStyle}>Date preferences (active subscribers)</span>
                  {data.analytics.datePreferences.length === 0 ? (
                    <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)", margin: 0 }}>No preference data</p>
                  ) : (() => {
                    const maxCount = Math.max(...data.analytics!.datePreferences.map((d) => d.count), 1);
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {data.analytics!.datePreferences.map((d) => (
                          <div key={d.pref_date} style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", minWidth: 72 }}>
                              {d.pref_date.slice(5)}
                            </span>
                            <div
                              style={{
                                height: 14,
                                borderRadius: 3,
                                background: "#22c55e",
                                opacity: 0.8,
                                width: `${Math.round((d.count / maxCount) * 100)}%`,
                                minWidth: 4,
                                transition: "width 0.3s",
                              }}
                            />
                            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", minWidth: 20 }}>
                              {d.count}
                            </span>
                          </div>
                        ))}
                        <div
                          style={{
                            marginTop: "var(--space-xs)",
                            fontSize: "var(--text-xs)",
                            color: "var(--text-tertiary)",
                            fontStyle: "italic",
                          }}
                        >
                          {data.analytics!.openRateNote}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Scraper Monitoring */}
            {data.scraperMonitoring && (
              <div style={{ marginBottom: "var(--space-xl)" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 var(--space-md)" }}>
                  Scraper Monitoring
                </h2>

                {/* Summary stats */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: "var(--space-sm)",
                    marginBottom: "var(--space-md)",
                  }}
                >
                  <div style={cardStyle}>
                    <span style={labelStyle}>Total runs</span>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>
                      {data.scraperMonitoring.totalRuns}
                    </div>
                  </div>
                  <div style={cardStyle}>
                    <span style={labelStyle}>Success rate</span>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 800,
                        color: data.scraperMonitoring.successRate === null
                          ? "var(--text-tertiary)"
                          : data.scraperMonitoring.successRate >= 95
                          ? "#22c55e"
                          : data.scraperMonitoring.successRate >= 80
                          ? "#f59e0b"
                          : "#ef4444",
                      }}
                    >
                      {data.scraperMonitoring.successRate === null ? "—" : `${data.scraperMonitoring.successRate}%`}
                    </div>
                  </div>
                  <div style={cardStyle}>
                    <span style={labelStyle}>Failures</span>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 800,
                        color: data.scraperMonitoring.errorRuns > 0 ? "#ef4444" : "var(--text-tertiary)",
                      }}
                    >
                      {data.scraperMonitoring.errorRuns}
                    </div>
                  </div>
                  <div style={cardStyle}>
                    <span style={labelStyle}>Avg duration</span>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>
                      {data.scraperMonitoring.avgDurationMs > 0
                        ? `${(data.scraperMonitoring.avgDurationMs / 1000).toFixed(1)}s`
                        : "—"}
                    </div>
                  </div>
                </div>

                {/* Recent runs table */}
                <div style={cardStyle}>
                  <span style={labelStyle}>Recent runs (last 20)</span>
                  {data.scraperMonitoring.recentRuns.length === 0 ? (
                    <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)", margin: 0 }}>
                      No scraper runs recorded yet
                    </p>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-xs)" }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: "left", color: "var(--text-tertiary)", fontWeight: 600, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>Time</th>
                            <th style={{ textAlign: "left", color: "var(--text-tertiary)", fontWeight: 600, padding: "4px 8px", borderBottom: "1px solid var(--border)" }}>Status</th>
                            <th style={{ textAlign: "right", color: "var(--text-tertiary)", fontWeight: 600, padding: "4px 8px", borderBottom: "1px solid var(--border)" }}>Duration</th>
                            <th style={{ textAlign: "right", color: "var(--text-tertiary)", fontWeight: 600, padding: "4px 8px", borderBottom: "1px solid var(--border)" }}>New</th>
                            <th style={{ textAlign: "right", color: "var(--text-tertiary)", fontWeight: 600, padding: "4px 8px", borderBottom: "1px solid var(--border)" }}>Notified</th>
                            <th style={{ textAlign: "left", color: "var(--text-tertiary)", fontWeight: 600, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.scraperMonitoring.recentRuns.map((run) => (
                            <tr key={run.id} style={{ borderBottom: "1px solid var(--border)" }}>
                              <td style={{ padding: "6px 0", color: "var(--text-tertiary)" }}>
                                {formatRelativeTime(run.ran_at)}
                              </td>
                              <td style={{ padding: "6px 8px" }}>
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "2px 6px",
                                    borderRadius: 3,
                                    fontSize: "var(--text-xs)",
                                    fontWeight: 700,
                                    background: run.status === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                                    color: run.status === "success" ? "#22c55e" : "#ef4444",
                                  }}
                                >
                                  {run.status}
                                </span>
                              </td>
                              <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--text-secondary)" }}>
                                {run.duration_ms !== null ? `${(run.duration_ms / 1000).toFixed(1)}s` : "—"}
                              </td>
                              <td style={{ padding: "6px 8px", textAlign: "right", color: run.total_new_showtimes > 0 ? "#22c55e" : "var(--text-tertiary)" }}>
                                {run.total_new_showtimes}
                              </td>
                              <td style={{ padding: "6px 8px", textAlign: "right", color: run.total_notified > 0 ? "var(--text-primary)" : "var(--text-tertiary)" }}>
                                {run.total_notified}
                              </td>
                              <td style={{ padding: "6px 0", color: "#ef4444", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {run.error_message ?? ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recent Notifications */}
            <div style={{ ...cardStyle, marginBottom: "var(--space-xl)" }}>
              <span style={labelStyle}>Recent notifications sent</span>
              {data.subscribers.recentlyNotified.length === 0 ? (
                <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)", margin: 0 }}>
                  No notifications sent yet
                </p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-xs)" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", color: "var(--text-tertiary)", fontWeight: 600, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>Email</th>
                      <th style={{ textAlign: "left", color: "var(--text-tertiary)", fontWeight: 600, padding: "4px 8px", borderBottom: "1px solid var(--border)" }}>Movie</th>
                      <th style={{ textAlign: "left", color: "var(--text-tertiary)", fontWeight: 600, padding: "4px 8px", borderBottom: "1px solid var(--border)" }}>Channel</th>
                      <th style={{ textAlign: "right", color: "var(--text-tertiary)", fontWeight: 600, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>Notified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subscribers.recentlyNotified.map((sub, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "6px 0", color: "var(--text-secondary)" }}>{maskEmail(sub.email)}</td>
                        <td style={{ padding: "6px 8px", color: "var(--text-secondary)" }}>{sub.movie_title ?? "—"}</td>
                        <td style={{ padding: "6px 8px", color: "var(--text-secondary)", textTransform: "capitalize" }}>{sub.notification_channel ?? "email"}</td>
                        <td style={{ padding: "6px 0", color: "var(--text-tertiary)", textAlign: "right" }}>
                          {formatRelativeTime(sub.notified_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Recent Subscriptions */}
            <div style={cardStyle}>
              <span style={labelStyle}>Recent sign-ups</span>
              {data.subscribers.recentSubscriptions.length === 0 ? (
                <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)", margin: 0 }}>
                  No subscriptions yet
                </p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-xs)" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", color: "var(--text-tertiary)", fontWeight: 600, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>Email</th>
                      <th style={{ textAlign: "left", color: "var(--text-tertiary)", fontWeight: 600, padding: "4px 8px", borderBottom: "1px solid var(--border)" }}>Movie</th>
                      <th style={{ textAlign: "left", color: "var(--text-tertiary)", fontWeight: 600, padding: "4px 8px", borderBottom: "1px solid var(--border)" }}>Channel</th>
                      <th style={{ textAlign: "right", color: "var(--text-tertiary)", fontWeight: 600, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>Signed up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subscribers.recentSubscriptions.map((sub, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "6px 0", color: "var(--text-secondary)" }}>{maskEmail(sub.email)}</td>
                        <td style={{ padding: "6px 8px", color: "var(--text-secondary)" }}>{sub.movie_title ?? "—"}</td>
                        <td style={{ padding: "6px 8px", color: "var(--text-secondary)", textTransform: "capitalize" }}>{sub.notification_channel ?? "email"}</td>
                        <td style={{ padding: "6px 0", color: "var(--text-tertiary)", textAlign: "right" }}>
                          {formatRelativeTime(sub.subscribed_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Refresh button */}
            <div style={{ textAlign: "center", marginTop: "var(--space-xl)" }}>
              <button
                onClick={() => fetchData(secret)}
                disabled={loading}
                style={{
                  padding: "8px 20px",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  fontSize: "var(--text-xs)",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
