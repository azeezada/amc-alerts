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

interface TheaterFormatData {
  dates: Record<string, DateResult>;
}

interface TheaterData {
  name: string;
  neighborhood: string;
  formats: Record<string, TheaterFormatData>;
}

interface MultiStatusResponse {
  theaters: Record<string, TheaterData>;
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

const THEATER_LIST = [
  { slug: "amc-lincoln-square-13", name: "AMC Lincoln Square", neighborhood: "Upper West Side" },
  { slug: "amc-empire-25", name: "AMC Empire 25", neighborhood: "Midtown" },
  { slug: "amc-kips-bay-15", name: "AMC Kips Bay 15", neighborhood: "Kips Bay" },
];

const FORMAT_LIST = [
  { tag: "imax70mm", label: "IMAX 70mm", priority: 1 },
  { tag: "dolbycinema", label: "Dolby Cinema", priority: 2 },
  { tag: "imax", label: "IMAX", priority: 3 },
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

/** Find the best theater+format combo that has any availability. */
function findBestAvailable(
  theaters: Record<string, TheaterData> | undefined
): { theaterSlug: string; formatTag: string } | null {
  if (!theaters) return null;
  // Priority: IMAX 70mm > Dolby > IMAX, then alphabetical by theater
  for (const format of FORMAT_LIST) {
    for (const theater of THEATER_LIST) {
      const t = theaters[theater.slug];
      if (!t) continue;
      const f = t.formats[format.tag];
      if (!f) continue;
      const hasAny = Object.values(f.dates).some((d) => d.available);
      if (hasAny) return { theaterSlug: theater.slug, formatTag: format.tag };
    }
  }
  return null;
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

  const isReleased =
    timeLeft.days === 0 &&
    timeLeft.hours === 0 &&
    timeLeft.minutes === 0 &&
    timeLeft.seconds === 0;

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
          style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)" }}
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
      <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-lg)" }}>
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
          style={{ height: 48, animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

/* =========================================================================
   Date Card
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

      <div
        style={{
          borderTop: "1px dashed var(--border-subtle)",
          margin: "0 calc(-1 * var(--space-lg))",
          marginBottom: "var(--space-base)",
        }}
      />

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
            No tickets yet for this format
          </div>
          <button
            onClick={() => onNotify(date)}
            className="btn-ghost"
            style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
          >
            Notify me when available
          </button>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   Theater Tabs
   ========================================================================= */
function TheaterTabs({
  selected,
  onChange,
  theaters,
  bestCombo,
}: {
  selected: string;
  onChange: (slug: string) => void;
  theaters: Record<string, TheaterData> | undefined;
  bestCombo: { theaterSlug: string; formatTag: string } | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-xs)",
        flexWrap: "wrap",
        marginBottom: "var(--space-base)",
      }}
      role="tablist"
      aria-label="Theater selector"
    >
      {THEATER_LIST.map((theater) => {
        const isSelected = selected === theater.slug;
        const hasAny = theaters?.[theater.slug]
          ? Object.values(theaters[theater.slug].formats).some((f) =>
              Object.values(f.dates).some((d) => d.available)
            )
          : false;
        const isBest = bestCombo?.theaterSlug === theater.slug;

        return (
          <button
            key={theater.slug}
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(theater.slug)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-sm)",
              padding: "var(--space-sm) var(--space-base)",
              borderRadius: 8,
              border: `1.5px solid ${isSelected ? "var(--accent)" : "var(--border-subtle)"}`,
              background: isSelected ? "var(--bg-elevated)" : "transparent",
              color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
              fontFamily: "inherit",
              fontSize: "var(--text-sm)",
              fontWeight: isSelected ? 700 : 500,
              cursor: "pointer",
              transition: "all var(--dur-fast) var(--ease-default)",
              whiteSpace: "nowrap",
            }}
          >
            {theater.name}
            <span
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-tertiary)",
                fontWeight: 400,
              }}
            >
              {theater.neighborhood}
            </span>
            {isBest && hasAny && (
              <span
                style={{
                  background: "var(--accent)",
                  color: "oklch(98% 0.005 75)",
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "1px 6px",
                  borderRadius: 3,
                  letterSpacing: "0.5px",
                  lineHeight: 1.6,
                }}
              >
                BEST
              </span>
            )}
            {hasAny && !isBest && (
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "var(--success)",
                  flexShrink: 0,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* =========================================================================
   Format Pills
   ========================================================================= */
function FormatPills({
  selected,
  onChange,
  theaterData,
  bestCombo,
  theaterSlug,
}: {
  selected: string;
  onChange: (tag: string) => void;
  theaterData: TheaterData | undefined;
  bestCombo: { theaterSlug: string; formatTag: string } | null;
  theaterSlug: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-xs)",
        flexWrap: "wrap",
        marginBottom: "var(--space-lg)",
      }}
      role="group"
      aria-label="Format selector"
    >
      {FORMAT_LIST.map((format) => {
        const isSelected = selected === format.tag;
        const hasAny = theaterData?.formats[format.tag]
          ? Object.values(theaterData.formats[format.tag].dates).some((d) => d.available)
          : false;
        const isBest =
          bestCombo?.theaterSlug === theaterSlug && bestCombo?.formatTag === format.tag;

        return (
          <button
            key={format.tag}
            onClick={() => onChange(format.tag)}
            aria-pressed={isSelected}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-xs)",
              padding: "6px 14px",
              borderRadius: 100,
              border: `1.5px solid ${isSelected ? "var(--accent)" : "var(--border-subtle)"}`,
              background: isSelected ? "var(--accent)" : "transparent",
              color: isSelected ? "oklch(98% 0.005 75)" : "var(--text-secondary)",
              fontFamily: "inherit",
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.5px",
              transition: "all var(--dur-fast) var(--ease-default)",
            }}
          >
            {format.label}
            {isBest && hasAny && (
              <span
                style={{
                  background: isSelected ? "rgba(0,0,0,0.2)" : "var(--accent)",
                  color: "oklch(98% 0.005 75)",
                  fontSize: 9,
                  fontWeight: 900,
                  padding: "1px 5px",
                  borderRadius: 3,
                  letterSpacing: "0.5px",
                }}
              >
                BEST
              </span>
            )}
            {hasAny && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: isSelected ? "rgba(255,255,255,0.7)" : "var(--success)",
                  flexShrink: 0,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* =========================================================================
   Main Page
   ========================================================================= */
export default function Home() {
  const [status, setStatus] = useState<MultiStatusResponse | null>(null);
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

  // Theater + format selection
  const [selectedTheater, setSelectedTheater] = useState(THEATER_LIST[0].slug);
  const [selectedFormat, setSelectedFormat] = useState(FORMAT_LIST[0].tag);

  const fetchStatus = useCallback(async () => {
    try {
      const resp = await fetch("/api/status");
      const data = (await resp.json()) as MultiStatusResponse;
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

  const bestCombo = findBestAvailable(status?.theaters);

  // Auto-select the best combo once data loads
  useEffect(() => {
    if (bestCombo) {
      setSelectedTheater(bestCombo.theaterSlug);
      setSelectedFormat(bestCombo.formatTag);
    }
  }, [bestCombo?.theaterSlug, bestCombo?.formatTag]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentTheaterData = status?.theaters[selectedTheater];
  const currentFormatData = currentTheaterData?.formats[selectedFormat];

  const anyAvailable = status?.theaters
    ? Object.values(status.theaters).some((t) =>
        Object.values(t.formats).some((f) =>
          Object.values(f.dates).some((d) => d.available)
        )
      )
    : false;

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
      if (data.success) setEmail("");
    } catch {
      setSubmitResult({ success: false, message: "Network error — please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const theaterMeta = THEATER_LIST.find((t) => t.slug === selectedTheater);
  const formatMeta = FORMAT_LIST.find((f) => f.tag === selectedFormat);

  return (
    <div style={{ minHeight: "100vh" }}>
      <ThemeToggle />

      <div className="film-strip-border" style={{ background: "var(--accent)" }} />

      {/* ===== HERO ===== */}
      <header
        className="film-grain light-leak"
        style={{
          background: `linear-gradient(180deg, var(--bg-base) 0%, var(--bg-surface) 40%, var(--bg-base) 100%)`,
          padding: "var(--space-3xl) var(--space-lg) var(--space-2xl)",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
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
          style={{ position: "relative", zIndex: 2, maxWidth: 700, margin: "0 auto" }}
        >
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
              NYC TICKET ALERTS
            </span>
          </div>

          <div
            className="hero-enter hero-enter-delay-1"
            style={{
              width: 130,
              height: 195,
              margin: "0 auto var(--space-lg)",
              borderRadius: 8,
              background: `linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-surface) 100%)`,
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
            Premium Format Showtimes · NYC
          </p>

          <Countdown />

          {!loadingStatus && (
            <div
              className="hero-enter hero-enter-delay-4"
              style={{
                marginTop: "var(--space-lg)",
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-sm)",
                background: anyAvailable ? "var(--success-subtle)" : "var(--bg-surface)",
                border: "1px solid",
                borderColor: anyAvailable ? "var(--success)" : "var(--border-subtle)",
                borderRadius: 100,
                padding: "var(--space-sm) var(--space-base)",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                color: anyAvailable ? "var(--success)" : "var(--text-tertiary)",
              }}
            >
              <span
                className={anyAvailable ? "pulse-dot" : undefined}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: anyAvailable ? "var(--success)" : "var(--text-tertiary)",
                  flexShrink: 0,
                }}
              />
              {anyAvailable ? "Tickets available now" : "Tickets not yet on sale"}
            </div>
          )}
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "0 var(--space-lg)" }}>
        <section style={{ padding: "var(--space-2xl) 0 var(--space-xl)" }}>
          {/* Section header */}
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
                {formatMeta?.label ?? selectedFormat} · {theaterMeta?.name ?? selectedTheater}
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

          {/* Theater tabs */}
          <TheaterTabs
            selected={selectedTheater}
            onChange={setSelectedTheater}
            theaters={status?.theaters}
            bestCombo={bestCombo}
          />

          {/* Format pills */}
          <FormatPills
            selected={selectedFormat}
            onChange={setSelectedFormat}
            theaterData={currentTheaterData}
            bestCombo={bestCombo}
            theaterSlug={selectedTheater}
          />

          {/* Loading spinner */}
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
                key={`${selectedTheater}-${selectedFormat}-${date}`}
                date={date}
                result={currentFormatData?.dates[date]}
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
                We&apos;ll email you the moment tickets drop.
                No spam — just one alert when tickets become available.
              </p>
              <button onClick={() => setSubmitResult(null)} className="btn-ghost">
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
                  Enter your email and we&apos;ll alert you the instant tickets go on sale.
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
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)" }}>
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
                          setSelectedDates(e.target.checked ? [...TARGET_DATES] : []);
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
                            color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
                            background: isSelected ? "var(--bg-elevated)" : "transparent",
                            padding: "var(--space-xs) var(--space-sm)",
                            borderRadius: 4,
                            border: `1px solid ${
                              isSelected ? "var(--border-default)" : "transparent"
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
          <div className="film-strip-border" style={{ marginBottom: "var(--space-xl)", opacity: 0.4 }} />

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
                We check AMC&apos;s website every 15 minutes across 3 theaters and 3 formats.
                When tickets appear, we email you with direct booking links.
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
                Formats covered
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
                <li>IMAX 70mm (highest priority)</li>
                <li>Dolby Cinema</li>
                <li>Standard IMAX</li>
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

          <div className="film-strip-border" style={{ marginTop: "var(--space-xl)", opacity: 0.4 }} />
        </footer>
      </main>
    </div>
  );
}
