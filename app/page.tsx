"use client";

import { useState, useEffect, useCallback } from "react";

/* =========================================================================
   Types
   ========================================================================= */
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

/* =========================================================================
   Helpers
   ========================================================================= */
function formatDateNice(dateStr: string): { weekday: string; date: string } {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
    date: d.toLocaleDateString("en-US", { month: "long", day: "numeric" }),
  };
}

/* =========================================================================
   Countdown Timer
   ========================================================================= */
function Countdown() {
  const targetDate = new Date("2026-04-03T00:00:00-04:00").getTime();

  const calcTimeLeft = useCallback(() => {
    const diff = targetDate - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  }, [targetDate]);

  const [timeLeft, setTimeLeft] = useState(calcTimeLeft);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setTimeLeft(calcTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [calcTimeLeft]);

  if (!mounted) {
    return (
      <div className="hero-enter hero-enter-delay-3" style={{ marginTop: "var(--space-lg)" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-lg)" }}>
          {["Days", "Hrs", "Min", "Sec"].map((label) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div
                className="skeleton"
                style={{ width: 56, height: 48, borderRadius: 8, marginBottom: 4 }}
              />
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const units = [
    { value: timeLeft.days, label: "Days" },
    { value: timeLeft.hours, label: "Hrs" },
    { value: timeLeft.minutes, label: "Min" },
    { value: timeLeft.seconds, label: "Sec" },
  ];

  const isReleased = timeLeft.days === 0 && timeLeft.hours === 0 &&
    timeLeft.minutes === 0 && timeLeft.seconds === 0;

  if (isReleased) {
    return (
      <div
        className="hero-enter hero-enter-delay-3"
        style={{
          marginTop: "var(--space-lg)",
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-sm)",
          background: "var(--success-subtle)",
          padding: "var(--space-sm) var(--space-base)",
          borderRadius: 100,
          fontSize: "var(--text-sm)",
          fontWeight: 700,
          color: "var(--success)",
        }}
      >
        <span
          className="pulse-dot"
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--success)",
          }}
        />
        Now in theatres
      </div>
    );
  }

  return (
    <div className="hero-enter hero-enter-delay-3" style={{ marginTop: "var(--space-lg)" }}>
      <div
        style={{
          fontSize: "var(--text-xs)",
          color: "var(--text-tertiary)",
          letterSpacing: "1.5px",
          fontWeight: 600,
          textTransform: "uppercase",
          marginBottom: "var(--space-sm)",
        }}
      >
        Release date countdown
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "var(--space-lg)",
        }}
      >
        {units.map(({ value, label }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: "var(--text-2xl)",
                fontWeight: 800,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                color: "var(--text-primary)",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 8,
                padding: "var(--space-md) var(--space-base)",
                minWidth: 56,
              }}
            >
              {String(value).padStart(2, "0")}
            </div>
            <span
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-tertiary)",
                fontWeight: 500,
                marginTop: 4,
                display: "block",
              }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================================
   Theme Toggle
   ========================================================================= */
function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light") setTheme("light");
    else setTheme("dark");
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  if (!mounted) return null;

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}

/* =========================================================================
   Status Badge
   ========================================================================= */
function StatusBadge({ status }: { status: string }) {
  const config = {
    Sellable: { cls: "status-sellable", label: "Available", dot: "var(--success)" },
    AlmostFull: { cls: "status-almostfull", label: "Almost full", dot: "var(--warning)" },
  } as Record<string, { cls: string; label: string; dot: string }>;

  const { cls, label, dot } = config[status] || {
    cls: "status-soldout",
    label: "Sold out",
    dot: "var(--error)",
  };

  return (
    <span className={`status-badge ${cls}`}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: dot,
          flexShrink: 0,
        }}
        className={status === "Sellable" ? "pulse-dot" : undefined}
      />
      {label}
    </span>
  );
}

/* =========================================================================
   Showtime Skeleton
   ========================================================================= */
function ShowtimeSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="skeleton"
          style={{
            height: 48,
            animationDelay: `${i * 150}ms`,
          }}
        />
      ))}
    </div>
  );
}

/* =========================================================================
   Date Card — Ticket-style with notches
   ========================================================================= */
function DateCard({
  date,
  result,
  index,
  onNotify,
}: {
  date: string;
  result?: DateResult;
  index: number;
  onNotify: (date: string) => void;
}) {
  const { weekday, date: dateLabel } = formatDateNice(date);
  const isLoading = !result;
  const hasShowtimes = result?.available && result.showtimes.length > 0;
  const isReleaseDate = date === "2026-04-03";

  return (
    <div
      className="card card-enter"
      style={
        {
          "--i": index,
          padding: "var(--space-lg)",
          position: "relative",
          overflow: "hidden",
          borderColor: hasShowtimes ? "var(--accent)" : undefined,
          boxShadow: hasShowtimes ? "var(--shadow-glow)" : undefined,
        } as React.CSSProperties
      }
    >
      {/* Release date indicator */}
      {isReleaseDate && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: "var(--accent)",
          }}
        />
      )}

      {/* Date header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "var(--space-base)",
          gap: "var(--space-md)",
        }}
      >
        <div>
          <div
            style={{
              color: "var(--accent)",
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
            }}
          >
            {weekday}
          </div>
          <div
            style={{
              fontSize: "var(--text-lg)",
              fontWeight: 800,
              marginTop: 2,
              color: "var(--text-primary)",
            }}
          >
            {dateLabel}
            {isReleaseDate && (
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  color: "var(--accent)",
                  marginLeft: "var(--space-sm)",
                  verticalAlign: "middle",
                }}
              >
                Release day
              </span>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="skeleton" style={{ width: 80, height: 24 }} />
        ) : hasShowtimes ? (
          <span
            style={{
              background: "var(--success-subtle)",
              color: "var(--success)",
              border: "1px solid",
              borderColor: "var(--success)",
              padding: "4px 12px",
              borderRadius: 4,
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              letterSpacing: "0.5px",
            }}
          >
            TICKETS LIVE
          </span>
        ) : (
          <span
            style={{
              background: "var(--bg-elevated)",
              color: "var(--text-tertiary)",
              padding: "4px 12px",
              borderRadius: 4,
              fontSize: "var(--text-xs)",
              fontWeight: 600,
            }}
          >
            Coming soon
          </span>
        )}
      </div>

      {/* Dashed divider — ticket perforation */}
      <div
        style={{
          borderTop: "1px dashed var(--border-subtle)",
          margin: "0 calc(-1 * var(--space-lg))",
          marginBottom: "var(--space-base)",
        }}
      />

      {/* Showtimes */}
      {isLoading ? (
        <ShowtimeSkeleton />
      ) : hasShowtimes ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {result!.showtimes.map((st) => (
            <div
              key={st.id}
              className="showtime-row"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--bg-elevated)",
                borderRadius: 6,
                padding: "var(--space-md) var(--space-base)",
                gap: "var(--space-md)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                <span
                  style={{
                    fontSize: "var(--text-base)",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    minWidth: 80,
                    color: "var(--text-primary)",
                  }}
                >
                  {st.time}{" "}
                  <span
                    style={{
                      color: "var(--text-tertiary)",
                      fontWeight: 400,
                      fontSize: "var(--text-sm)",
                    }}
                  >
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
                style={{ padding: "7px 16px", fontSize: "var(--text-sm)" }}
              >
                Buy tickets
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            textAlign: "center",
            padding: "var(--space-lg) 0",
            color: "var(--text-tertiary)",
          }}
        >
          <div
            style={{
              fontSize: "var(--text-sm)",
              marginBottom: "var(--space-md)",
              lineHeight: "var(--leading-normal)",
            }}
          >
            No IMAX 70mm tickets yet
          </div>
          <button
            onClick={() => onNotify(date)}
            className="btn-ghost"
            style={{
              borderColor: "var(--accent)",
              color: "var(--accent)",
            }}
          >
            Notify me when available
          </button>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   Main Page
   ========================================================================= */
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
      const data = (await resp.json()) as StatusResponse;
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
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleNotify = (date: string) => {
    setNotifyDate(date);
    if (!selectedDates.includes(date)) {
      setSelectedDates([date]);
    }
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
      const data = (await resp.json()) as {
        success: boolean;
        message?: string;
        error?: string;
      };
      setSubmitResult({
        success: data.success || false,
        message: data.message || data.error || "Something went wrong",
      });
      if (data.success) {
        setEmail("");
      }
    } catch {
      setSubmitResult({
        success: false,
        message: "Network error — please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const anyAvailable = status
    ? Object.values(status.dates).some((d) => d.available)
    : false;

  return (
    <div style={{ minHeight: "100vh" }}>
      <ThemeToggle />

      {/* Film strip top accent */}
      <div
        className="film-strip-border"
        style={{ background: "var(--accent)" }}
      />

      {/* ===== HERO ===== */}
      <header
        className="film-grain light-leak"
        style={{
          background: `linear-gradient(
            180deg,
            var(--bg-base) 0%,
            var(--bg-surface) 40%,
            var(--bg-base) 100%
          )`,
          padding: "var(--space-3xl) var(--space-lg) var(--space-2xl)",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Radial glow */}
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(600px, 100vw)",
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, oklch(55% 0.24 27 / 0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 2,
            maxWidth: 700,
            margin: "0 auto",
          }}
        >
          {/* Format badge */}
          <div
            className="hero-enter"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-sm)",
              background: "var(--accent)",
              padding: "5px 16px",
              borderRadius: 4,
              marginBottom: "var(--space-lg)",
            }}
          >
            <span
              style={{
                color: "oklch(98% 0.005 75)",
                fontSize: "var(--text-xs)",
                fontWeight: 800,
                letterSpacing: "2.5px",
              }}
            >
              IMAX® 70MM FILM
            </span>
          </div>

          {/* Movie poster placeholder */}
          <div
            className="hero-enter hero-enter-delay-1"
            style={{
              width: 130,
              height: 195,
              margin: "0 auto var(--space-lg)",
              borderRadius: 8,
              background: `linear-gradient(
                135deg,
                var(--bg-elevated) 0%,
                var(--bg-surface) 100%
              )`,
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-sm)",
              boxShadow: "var(--shadow-lg)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <span style={{ fontSize: 36, position: "relative", zIndex: 1 }}>🚀</span>
            <span
              style={{
                fontSize: 9,
                color: "var(--text-tertiary)",
                textAlign: "center",
                padding: "0 var(--space-sm)",
                letterSpacing: "1px",
                fontWeight: 700,
                textTransform: "uppercase",
                position: "relative",
                zIndex: 1,
              }}
            >
              Project Hail Mary
            </span>
          </div>

          {/* Title */}
          <h1
            className="hero-enter hero-enter-delay-2"
            style={{
              fontSize: "clamp(var(--text-2xl), 6vw, var(--text-4xl))",
              fontWeight: 800,
              margin: "0 0 var(--space-sm)",
              lineHeight: "var(--leading-tight)",
              letterSpacing: "-0.5px",
              color: "var(--text-primary)",
            }}
          >
            Project Hail Mary
          </h1>

          {/* Subtitle */}
          <p
            className="font-display hero-enter hero-enter-delay-2"
            style={{
              fontSize: "var(--text-lg)",
              color: "var(--text-secondary)",
              margin: "0 0 var(--space-md)",
              fontWeight: 400,
              fontStyle: "italic",
            }}
          >
            The IMAX 70mm Experience
          </p>

          {/* Location */}
          <div
            className="hero-enter hero-enter-delay-3"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-sm)",
              color: "var(--text-tertiary)",
              fontSize: "var(--text-sm)",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>AMC Lincoln Square 13 · New York City</span>
          </div>

          {/* Countdown */}
          <Countdown />

          {/* Availability indicator */}
          {!loadingStatus && (
            <div
              className="hero-enter hero-enter-delay-4"
              style={{
                marginTop: "var(--space-lg)",
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-sm)",
                background: anyAvailable
                  ? "var(--success-subtle)"
                  : "var(--bg-surface)",
                border: "1px solid",
                borderColor: anyAvailable
                  ? "var(--success)"
                  : "var(--border-subtle)",
                borderRadius: 100,
                padding: "var(--space-sm) var(--space-base)",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                color: anyAvailable
                  ? "var(--success)"
                  : "var(--text-tertiary)",
              }}
            >
              <span
                className={anyAvailable ? "pulse-dot" : undefined}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: anyAvailable
                    ? "var(--success)"
                    : "var(--text-tertiary)",
                  flexShrink: 0,
                }}
              />
              {anyAvailable
                ? "Tickets available now"
                : "Tickets not yet on sale"}
            </div>
          )}
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "0 var(--space-lg)",
        }}
      >
        {/* Availability section */}
        <section style={{ padding: "var(--space-2xl) 0 var(--space-xl)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--space-lg)",
              gap: "var(--space-md)",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "var(--text-xl)",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                }}
              >
                April 1–5, 2026
              </h2>
              <p
                style={{
                  margin: "4px 0 0",
                  color: "var(--text-secondary)",
                  fontSize: "var(--text-sm)",
                }}
              >
                IMAX 70mm showtimes at AMC Lincoln Square 13
              </p>
            </div>
            {lastChecked && (
              <div
                style={{
                  color: "var(--text-tertiary)",
                  fontSize: "var(--text-xs)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-sm)",
                }}
              >
                <span>Updated {lastChecked}</span>
                <button
                  onClick={fetchStatus}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--accent)",
                    cursor: "pointer",
                    fontSize: "var(--text-xs)",
                    padding: 0,
                    fontWeight: 700,
                    fontFamily: "inherit",
                  }}
                >
                  Refresh
                </button>
              </div>
            )}
          </div>

          {/* Loading state with projector spinner */}
          {loadingStatus && !status && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "var(--space-3xl) 0",
                gap: "var(--space-base)",
              }}
            >
              <div className="projector-spinner" />
              <p
                style={{
                  color: "var(--text-tertiary)",
                  fontSize: "var(--text-sm)",
                  margin: 0,
                }}
              >
                Checking showtimes&hellip;
              </p>
            </div>
          )}

          {/* Date cards grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "var(--space-base)",
            }}
          >
            {TARGET_DATES.map((date, i) => (
              <DateCard
                key={date}
                date={date}
                result={status?.dates[date]}
                index={i}
                onNotify={handleNotify}
              />
            ))}
          </div>
        </section>

        {/* ===== EMAIL SIGNUP ===== */}
        <section
          id="signup"
          className="card card-enter"
          style={
            {
              "--i": 5,
              padding: "var(--space-2xl)",
              marginBottom: "var(--space-2xl)",
            } as React.CSSProperties
          }
        >
          {submitResult?.success ? (
            <div style={{ textAlign: "center", padding: "var(--space-lg) 0" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "var(--success-subtle)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "var(--space-base)",
                  fontSize: 28,
                }}
              >
                ✓
              </div>
              <h2
                style={{
                  margin: "0 0 var(--space-sm)",
                  fontSize: "var(--text-xl)",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                }}
              >
                You&apos;re on the list
              </h2>
              <p
                style={{
                  color: "var(--text-secondary)",
                  margin: "0 0 var(--space-lg)",
                  fontSize: "var(--text-sm)",
                  maxWidth: "45ch",
                  marginLeft: "auto",
                  marginRight: "auto",
                  lineHeight: "var(--leading-normal)",
                }}
              >
                We&apos;ll email you the moment IMAX 70mm tickets drop.
                No spam — just one alert when tickets become available.
              </p>
              <button
                onClick={() => setSubmitResult(null)}
                className="btn-ghost"
              >
                Add another email
              </button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "var(--space-lg)" }}>
                <h2
                  style={{
                    margin: "0 0 var(--space-sm)",
                    fontSize: "var(--text-xl)",
                    fontWeight: 800,
                    color: "var(--text-primary)",
                  }}
                >
                  Get notified
                </h2>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    margin: 0,
                    fontSize: "var(--text-sm)",
                    maxWidth: "55ch",
                    lineHeight: "var(--leading-normal)",
                  }}
                >
                  Enter your email and we&apos;ll alert you the instant IMAX
                  70mm tickets go on sale.
                  {notifyDate && (
                    <span style={{ color: "var(--accent)" }}>
                      {" "}
                      Pre-selected: {formatDateNice(notifyDate).weekday}{" "}
                      {formatDateNice(notifyDate).date}
                    </span>
                  )}
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                <div
                  style={{
                    display: "flex",
                    gap: "var(--space-md)",
                    marginBottom: "var(--space-lg)",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <label
                      htmlFor="email-input"
                      style={{
                        display: "block",
                        fontSize: "var(--text-xs)",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        marginBottom: "var(--space-xs)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Email address
                    </label>
                    <input
                      id="email-input"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={submitting}
                      autoComplete="email"
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn-red"
                    disabled={submitting || !email}
                    style={{ alignSelf: "flex-end" }}
                  >
                    {submitting ? "Subscribing\u2026" : "Notify me"}
                  </button>
                </div>

                {/* Date selection */}
                <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
                  <legend
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--text-tertiary)",
                      marginBottom: "var(--space-sm)",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Notify me for
                  </legend>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "var(--space-sm)",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        cursor: "pointer",
                        fontSize: "var(--text-sm)",
                        color: "var(--text-secondary)",
                        padding: "var(--space-xs) var(--space-sm)",
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
                      const isSelected = selectedDates.includes(date);
                      return (
                        <label
                          key={date}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            cursor: "pointer",
                            fontSize: "var(--text-sm)",
                            color: isSelected
                              ? "var(--text-primary)"
                              : "var(--text-secondary)",
                            background: isSelected
                              ? "var(--bg-elevated)"
                              : "transparent",
                            padding: "var(--space-xs) var(--space-sm)",
                            borderRadius: 4,
                            border: `1px solid ${
                              isSelected
                                ? "var(--border-default)"
                                : "transparent"
                            }`,
                            transition: `all var(--dur-fast) var(--ease-default)`,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleDate(date)}
                          />
                          {weekday.slice(0, 3)} {dLabel}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                {submitResult && !submitResult.success && (
                  <p
                    role="alert"
                    style={{
                      color: "var(--error)",
                      fontSize: "var(--text-sm)",
                      marginTop: "var(--space-md)",
                      margin: "var(--space-md) 0 0",
                    }}
                  >
                    {submitResult.message}
                  </p>
                )}
              </form>
            </>
          )}
        </section>

        {/* ===== FOOTER ===== */}
        <footer
          style={{
            borderTop: "1px solid var(--border-subtle)",
            padding: "var(--space-xl) 0 var(--space-2xl)",
          }}
        >
          {/* Film strip divider */}
          <div
            className="film-strip-border"
            style={{
              marginBottom: "var(--space-xl)",
              opacity: 0.4,
            }}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "var(--space-xl)",
            }}
          >
            <div>
              <h3
                style={{
                  margin: "0 0 var(--space-md)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 700,
                  color: "var(--accent)",
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                }}
              >
                How it works
              </h3>
              <p
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "var(--text-sm)",
                  margin: 0,
                  lineHeight: "var(--leading-normal)",
                  maxWidth: "40ch",
                }}
              >
                We check AMC&apos;s website every 15 minutes. When IMAX 70mm
                tickets appear, we email you with direct booking links.
              </p>
            </div>

            <div>
              <h3
                style={{
                  margin: "0 0 var(--space-md)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 700,
                  color: "var(--accent)",
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                }}
              >
                What to expect
              </h3>
              <ul
                style={{
                  color: "var(--text-secondary)",
                  fontSize: "var(--text-sm)",
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  lineHeight: 2.2,
                }}
              >
                <li>Checks every 15 minutes</li>
                <li>One email per ticket drop</li>
                <li>No spam, ever</li>
                <li>Unsubscribe any time</li>
              </ul>
            </div>

            <div>
              <h3
                style={{
                  margin: "0 0 var(--space-md)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 700,
                  color: "var(--text-tertiary)",
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                }}
              >
                Disclaimer
              </h3>
              <p
                style={{
                  color: "var(--text-tertiary)",
                  fontSize: "var(--text-xs)",
                  margin: 0,
                  lineHeight: "var(--leading-normal)",
                  maxWidth: "40ch",
                }}
              >
                Not affiliated with AMC Theatres, IMAX Corporation, or the
                filmmakers. Independent fan tool. Showtimes sourced from
                AMC&apos;s public website.
              </p>
            </div>
          </div>

          {/* Bottom film strip */}
          <div
            className="film-strip-border"
            style={{
              marginTop: "var(--space-xl)",
              opacity: 0.4,
            }}
          />
        </footer>
      </main>
    </div>
  );
}
