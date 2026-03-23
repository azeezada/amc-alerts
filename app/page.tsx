"use client";

import { useState, useEffect, useCallback } from "react";

interface Showtime {
  id: string;
  time: string;
  amPm: string;
  status: string;
  url: string;
}

interface DateResult {
  date: string;
  available: boolean;
  showtimes: Showtime[];
  error?: string;
}

interface StatusResponse {
  dates: Record<string, DateResult>;
  checkedAt: string;
  cached?: boolean;
  error?: string;
}

const TARGET_DATES = [
  "2026-04-01",
  "2026-04-02",
  "2026-04-03",
  "2026-04-04",
  "2026-04-05",
];

function formatDateNice(dateStr: string): { weekday: string; date: string } {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
    date: d.toLocaleDateString("en-US", { month: "long", day: "numeric" }),
  };
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "Sellable"
      ? "status-sellable"
      : status === "AlmostFull"
      ? "status-almostfull"
      : "status-soldout";
  const label =
    status === "Sellable"
      ? "✓ Available"
      : status === "AlmostFull"
      ? "⚡ Almost Full"
      : "✗ Sold Out";
  return (
    <span
      className={cls}
      style={{
        padding: "3px 10px",
        borderRadius: "4px",
        fontSize: "12px",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function DateCard({
  date,
  result,
  onNotify,
}: {
  date: string;
  result?: DateResult;
  onNotify: (date: string) => void;
}) {
  const { weekday, date: dateLabel } = formatDateNice(date);
  const isLoading = !result;
  const hasShowtimes = result?.available && result.showtimes.length > 0;

  return (
    <div
      className="card"
      style={{
        padding: "20px",
        transition: "border-color 0.2s",
        borderColor: hasShowtimes ? "rgba(229,9,20,0.4)" : undefined,
      }}
    >
      {/* Date Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 16,
          gap: 12,
        }}
      >
        <div>
          <div
            style={{ color: "#e50914", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}
          >
            {weekday.toUpperCase()}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>
            {dateLabel}
          </div>
        </div>
        {isLoading ? (
          <div
            style={{
              width: 80,
              height: 24,
              background: "#2d2d4e",
              borderRadius: 4,
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        ) : hasShowtimes ? (
          <span
            style={{
              background: "rgba(34,197,94,0.15)",
              color: "#22c55e",
              border: "1px solid rgba(34,197,94,0.4)",
              padding: "4px 12px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            🎬 TICKETS LIVE
          </span>
        ) : (
          <span
            style={{
              background: "rgba(156,163,175,0.1)",
              color: "#9ca3af",
              border: "1px solid rgba(156,163,175,0.2)",
              padding: "4px 12px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Coming Soon
          </span>
        )}
      </div>

      {/* Showtimes */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 40,
                background: "#1e1e3a",
                borderRadius: 4,
                animation: "pulse 1.5s ease-in-out infinite",
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      ) : hasShowtimes ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {result!.showtimes.map((st) => (
            <div
              key={st.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#1e1e3a",
                borderRadius: 6,
                padding: "10px 14px",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 700, minWidth: 80 }}>
                  {st.time}{" "}
                  <span style={{ color: "#9ca3af", fontWeight: 400, fontSize: 13 }}>
                    {st.amPm}
                  </span>
                </span>
                <StatusBadge status={st.status} />
              </div>
              <a
                href={st.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-red"
                style={{ padding: "7px 16px", fontSize: 13 }}
              >
                Buy Tickets →
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            textAlign: "center",
            padding: "20px 0",
            color: "#6b7280",
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
          <div style={{ fontSize: 14, marginBottom: 12 }}>
            No IMAX 70mm tickets yet
          </div>
          <button
            onClick={() => onNotify(date)}
            style={{
              background: "transparent",
              border: "1px solid rgba(229,9,20,0.5)",
              color: "#e50914",
              padding: "7px 16px",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Notify me when available
          </button>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [email, setEmail] = useState("");
  const [selectedDates, setSelectedDates] = useState<string[]>([...TARGET_DATES]);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [lastChecked, setLastChecked] = useState<string>("");
  const [notifyDate, setNotifyDate] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const resp = await fetch("/api/status");
      const data = await resp.json() as StatusResponse;
      setStatus(data);
      const now = new Date();
      setLastChecked(
        now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      );
    } catch (e) {
      console.error("Status fetch failed:", e);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Refresh every 5 minutes
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleNotify = (date: string) => {
    setNotifyDate(date);
    if (!selectedDates.includes(date)) {
      setSelectedDates([date]);
    }
    // Scroll to signup
    document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" });
  };

  const toggleDate = (date: string) => {
    setSelectedDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || submitting) return;

    setSubmitting(true);
    setSubmitResult(null);

    try {
      const resp = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, dates: selectedDates }),
      });
      const data = await resp.json() as { success: boolean; message?: string; error?: string };
      setSubmitResult({
        success: data.success || false,
        message: data.message || data.error || "Something went wrong",
      });
      if (data.success) {
        setEmail("");
      }
    } catch {
      setSubmitResult({ success: false, message: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const anyAvailable = status
    ? Object.values(status.dates).some((d) => d.available)
    : false;

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Film strip top decoration */}
      <div
        className="film-strip"
        style={{
          height: 8,
          background: "#e50914",
          width: "100%",
        }}
      />

      {/* Hero Section */}
      <div
        style={{
          background:
            "linear-gradient(180deg, #0a0a16 0%, #1a1a2e 50%, #0f0f1a 100%)",
          padding: "48px 20px 64px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background subtle circles */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(229,9,20,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", maxWidth: 700, margin: "0 auto" }}>
          {/* Format Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#e50914",
              padding: "5px 14px",
              borderRadius: 4,
              marginBottom: 24,
            }}
          >
            <span
              style={{ color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: 2 }}
            >
              IMAX® 70MM
            </span>
          </div>

          {/* Movie Poster Placeholder */}
          <div
            style={{
              width: 140,
              height: 210,
              margin: "0 auto 28px",
              borderRadius: 8,
              background: "linear-gradient(135deg, #1e1e3a 0%, #2d2d4e 100%)",
              border: "1px solid #3d3d5e",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <span style={{ fontSize: 40 }}>🚀</span>
            <span style={{ fontSize: 10, color: "#9ca3af", textAlign: "center", padding: "0 8px" }}>
              PROJECT HAIL MARY
            </span>
          </div>

          <h1
            style={{
              fontSize: "clamp(28px, 6vw, 48px)",
              fontWeight: 900,
              margin: "0 0 8px",
              lineHeight: 1.1,
              letterSpacing: "-0.5px",
            }}
          >
            Project Hail Mary
          </h1>

          <p
            style={{
              fontSize: 16,
              color: "#9ca3af",
              margin: "0 0 12px",
              fontWeight: 500,
            }}
          >
            IMAX 70mm Experience
          </p>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "#6b7280",
              fontSize: 13,
            }}
          >
            <span>📍</span>
            <span>AMC Lincoln Square 13 · New York City</span>
          </div>

          {/* Availability Indicator */}
          {!loadingStatus && (
            <div
              style={{
                marginTop: 28,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: anyAvailable
                  ? "rgba(34,197,94,0.1)"
                  : "rgba(229,9,20,0.08)",
                border: `1px solid ${anyAvailable ? "rgba(34,197,94,0.3)" : "rgba(229,9,20,0.2)"}`,
                borderRadius: 100,
                padding: "6px 16px",
                fontSize: 13,
                fontWeight: 600,
                color: anyAvailable ? "#22c55e" : "#9ca3af",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: anyAvailable ? "#22c55e" : "#4b5563",
                  animation: anyAvailable
                    ? "pulse-dot 2s ease-in-out infinite"
                    : "none",
                }}
              />
              {anyAvailable
                ? "Tickets Available Now!"
                : "Tickets Not Yet On Sale"}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px" }}>
        {/* Availability Section */}
        <section style={{ padding: "48px 0 32px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 24,
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
                April 1–5, 2026
              </h2>
              <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>
                IMAX 70mm showtimes at AMC Lincoln Square 13
              </p>
            </div>
            {lastChecked && (
              <div style={{ color: "#6b7280", fontSize: 12 }}>
                Updated {lastChecked}
                <button
                  onClick={fetchStatus}
                  style={{
                    marginLeft: 8,
                    background: "none",
                    border: "none",
                    color: "#e50914",
                    cursor: "pointer",
                    fontSize: 12,
                    padding: 0,
                    fontWeight: 600,
                  }}
                >
                  Refresh
                </button>
              </div>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 16,
            }}
          >
            {TARGET_DATES.map((date) => (
              <DateCard
                key={date}
                date={date}
                result={status?.dates[date]}
                onNotify={handleNotify}
              />
            ))}
          </div>
        </section>

        {/* Email Signup Section */}
        <section
          id="signup"
          className="card"
          style={{ padding: "40px", marginBottom: 48 }}
        >
          {submitResult?.success ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎬</div>
              <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}>
                You&apos;re on the list!
              </h2>
              <p style={{ color: "#9ca3af", margin: "0 0 24px", fontSize: 15 }}>
                We&apos;ll email you the moment IMAX 70mm tickets drop.
                <br />
                No spam — just one email when tickets become available.
              </p>
              <button
                onClick={() => setSubmitResult(null)}
                style={{
                  background: "none",
                  border: "1px solid #2d2d4e",
                  color: "#9ca3af",
                  padding: "8px 20px",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Add another email
              </button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}>
                  🔔 Get Notified
                </h2>
                <p style={{ color: "#9ca3af", margin: 0, fontSize: 14 }}>
                  Enter your email and we&apos;ll alert you the instant IMAX 70mm tickets go on sale.
                  {notifyDate && (
                    <span style={{ color: "#e50914" }}>
                      {" "}
                      Pre-selected:{" "}
                      {formatDateNice(notifyDate).weekday}{" "}
                      {formatDateNice(notifyDate).date}
                    </span>
                  )}
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginBottom: 20,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn-red"
                    disabled={submitting || !email}
                  >
                    {submitting ? "Subscribing..." : "Notify Me"}
                  </button>
                </div>

                {/* Date Selection */}
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#6b7280",
                      marginBottom: 10,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Notify me for:
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        cursor: "pointer",
                        fontSize: 13,
                        color: "#9ca3af",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDates.length === TARGET_DATES.length}
                        onChange={(e) => {
                          setSelectedDates(
                            e.target.checked ? [...TARGET_DATES] : []
                          );
                        }}
                      />
                      All dates
                    </label>
                    {TARGET_DATES.map((date) => {
                      const { weekday, date: dLabel } = formatDateNice(date);
                      return (
                        <label
                          key={date}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            cursor: "pointer",
                            fontSize: 13,
                            color: selectedDates.includes(date)
                              ? "#e5e7eb"
                              : "#9ca3af",
                            background: selectedDates.includes(date)
                              ? "#1e1e3a"
                              : "transparent",
                            padding: "4px 10px",
                            borderRadius: 4,
                            border: `1px solid ${
                              selectedDates.includes(date)
                                ? "#2d2d4e"
                                : "transparent"
                            }`,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedDates.includes(date)}
                            onChange={() => toggleDate(date)}
                          />
                          {weekday.slice(0, 3)} {dLabel}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {submitResult && !submitResult.success && (
                  <p
                    style={{
                      color: "#ef4444",
                      fontSize: 13,
                      marginTop: 12,
                      margin: "12px 0 0",
                    }}
                  >
                    {submitResult.message}
                  </p>
                )}
              </form>
            </>
          )}
        </section>

        {/* Footer / How it works */}
        <footer
          style={{
            borderTop: "1px solid #2d2d4e",
            padding: "32px 0 48px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 24,
          }}
        >
          <div>
            <h3
              style={{
                margin: "0 0 10px",
                fontSize: 13,
                fontWeight: 700,
                color: "#e50914",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              How It Works
            </h3>
            <p style={{ color: "#6b7280", fontSize: 13, margin: 0, lineHeight: 1.6 }}>
              We check AMC&apos;s website every 15 minutes. When IMAX 70mm
              tickets appear, we email you instantly with direct booking links.
            </p>
          </div>

          <div>
            <h3
              style={{
                margin: "0 0 10px",
                fontSize: 13,
                fontWeight: 700,
                color: "#e50914",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Trust Signals
            </h3>
            <ul
              style={{
                color: "#6b7280",
                fontSize: 13,
                margin: 0,
                padding: 0,
                listStyle: "none",
                lineHeight: 2,
              }}
            >
              <li>⏱️ Checks every 15 minutes</li>
              <li>📧 One email per ticket drop</li>
              <li>🚫 No spam, ever</li>
              <li>🔓 Unsubscribe any time</li>
            </ul>
          </div>

          <div>
            <h3
              style={{
                margin: "0 0 10px",
                fontSize: 13,
                fontWeight: 700,
                color: "#e50914",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Disclaimer
            </h3>
            <p style={{ color: "#4b5563", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
              Not affiliated with AMC Theatres, IMAX Corporation, or the
              filmmakers. This is an independent fan tool. All showtimes and
              availability data sourced from AMC&apos;s public website.
            </p>
          </div>
        </footer>
      </div>

      {/* Pulse animation style */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
