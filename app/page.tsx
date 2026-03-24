"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

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

interface TheaterInfo {
  slug: string;
  name: string;
  neighborhood: string;
  hasImax70mm?: boolean;
}

interface MarketInfo {
  slug: string;
  name: string;
  state: string;
  theaterCount: number;
}

interface MovieInfo {
  slug: string;
  title: string;
  formats: string[];
}

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

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  while (s <= e) {
    dates.push(toDateStr(s));
    s.setDate(s.getDate() + 1);
  }
  return dates;
}

function getDefaultDates(): { start: string; end: string } {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 6);
  return { start: toDateStr(today), end: toDateStr(end) };
}

function findBestAvailable(
  theaters: Record<string, TheaterData> | undefined,
  theaterList: { slug: string }[],
  formatList: { tag: string }[]
): { theaterSlug: string; formatTag: string } | null {
  if (!theaters) return null;
  for (const format of formatList) {
    for (const theater of theaterList) {
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
   URL + localStorage persistence
   ========================================================================= */
function readUrlParams(): {
  theaters: string[] | null;
  movie: string | null;
  dates: string[] | null;
} {
  if (typeof window === "undefined") return { theaters: null, movie: null, dates: null };
  const params = new URLSearchParams(window.location.search);
  const t = params.get("theaters");
  const m = params.get("movie");
  const d = params.get("dates");
  return {
    theaters: t ? t.split(",").filter(Boolean) : null,
    movie: m || null,
    dates: d ? d.split(",").filter(Boolean) : null,
  };
}

function writeUrlParams(theaters: string[], movie: string, dates: string[]) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  params.set("theaters", theaters.join(","));
  params.set("movie", movie);
  params.set("dates", dates.join(","));
  const url = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, "", url);
}

const LS_KEY = "amc-alerts-selection";

function readLocalStorage(): {
  theaters?: string[];
  movie?: string;
  dates?: string[];
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocalStorage(theaters: string[], movie: string, dates: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ theaters, movie, dates }));
  } catch { /* ignore */ }
}

/* =========================================================================
   Status Badge
   ========================================================================= */
function StatusBadge({ status }: { status: string }) {
  const config = {
    Sellable: { cls: "status-sellable", label: "Available", dot: "#FFFFFF" },
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
   Skeleton Components
   ========================================================================= */
function ShowtimeSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-elevated)",
            borderRadius: 6,
            padding: "var(--space-md) var(--space-base)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
            <div className="skeleton" style={{ width: 80, height: 20, animationDelay: `${i * 100}ms` }} />
            <div className="skeleton" style={{ width: 64, height: 22, borderRadius: 4, animationDelay: `${i * 100 + 50}ms` }} />
          </div>
          <div className="skeleton" style={{ width: 100, height: 32, borderRadius: 4, animationDelay: `${i * 100 + 100}ms` }} />
        </div>
      ))}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div style={{ padding: "var(--space-xl) 0" }}>
      {/* Header skeleton */}
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <div className="skeleton" style={{ width: 200, height: 28, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: 300, height: 16 }} />
      </div>
      {/* Theater tabs skeleton */}
      <div style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-base)" }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ width: 140, height: 36, borderRadius: 20, animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
      {/* Format pills skeleton */}
      <div style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-lg)" }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ width: 100, height: 36, borderRadius: 20, animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
      {/* Date cards skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "var(--space-base)" }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="card"
            style={{ padding: "var(--space-lg)", animationDelay: `${i * 80}ms` } as React.CSSProperties}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-base)" }}>
              <div>
                <div className="skeleton" style={{ width: 80, height: 12, marginBottom: 6, animationDelay: `${i * 100}ms` }} />
                <div className="skeleton" style={{ width: 120, height: 22, animationDelay: `${i * 100 + 50}ms` }} />
              </div>
              <div className="skeleton" style={{ width: 80, height: 24, borderRadius: 4, animationDelay: `${i * 100 + 100}ms` }} />
            </div>
            <div style={{ borderTop: "1px dashed var(--border-subtle)", margin: "0 calc(-1 * var(--space-lg))", marginBottom: "var(--space-base)" }} />
            <ShowtimeSkeleton />
          </div>
        ))}
      </div>
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
}: {
  date: string;
  result?: DateResult;
  index: number;
}) {
  const { weekday, date: dateLabel } = formatDateNice(date);
  const isLoading = !result;
  const hasShowtimes = result?.available && result.showtimes.length > 0;

  return (
    <div
      className="card card-enter"
      style={
        {
          "--i": index,
          padding: "var(--space-lg)",
          position: "relative",
          overflow: "hidden",
          border: hasShowtimes ? "1px solid var(--border-default)" : undefined,
        } as React.CSSProperties
      }
    >
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
          </div>
        </div>

        {isLoading ? (
          <div className="skeleton" style={{ width: 80, height: 24 }} />
        ) : hasShowtimes ? (
          <span
            style={{
              background: "transparent",
              color: "#FFFFFF",
              border: "1px solid",
              borderColor: "#FFFFFF",
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
              lineHeight: "var(--leading-normal)",
            }}
          >
            No tickets yet for this format
          </div>
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
  theaterList,
}: {
  selected: string;
  onChange: (slug: string) => void;
  theaters: Record<string, TheaterData> | undefined;
  theaterList: { slug: string; name: string; neighborhood: string }[];
  bestCombo: { theaterSlug: string; formatTag: string } | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-sm)",
        flexWrap: "wrap",
        marginBottom: "var(--space-base)",
      }}
      role="tablist"
      aria-label="Theater selector"
    >
      {theaterList.map((theater) => {
        const isSelected = selected === theater.slug;

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
              padding: "8px 16px",
              borderRadius: 20,
              border: `1px solid ${isSelected ? "#FFFFFF" : "#444444"}`,
              background: isSelected ? "#FFFFFF" : "#2A2A2A",
              color: isSelected ? "#000000" : "#FFFFFF",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all var(--dur-fast) var(--ease-default)",
              whiteSpace: "nowrap",
            }}
          >
            {theater.name}
            {theater.neighborhood && (
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: isSelected ? "#666666" : "var(--text-tertiary)",
                  fontWeight: 400,
                }}
              >
                {theater.neighborhood}
              </span>
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
        gap: "var(--space-sm)",
        flexWrap: "wrap",
        marginBottom: "var(--space-lg)",
      }}
      role="group"
      aria-label="Format selector"
    >
      {FORMAT_LIST.map((format) => {
        const isSelected = selected === format.tag;

        return (
          <button
            key={format.tag}
            onClick={() => onChange(format.tag)}
            aria-pressed={isSelected}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-xs)",
              padding: "8px 16px",
              borderRadius: 20,
              border: `1px solid ${isSelected ? "#FFFFFF" : "#444444"}`,
              background: isSelected ? "#FFFFFF" : "#2A2A2A",
              color: isSelected ? "#000000" : "#FFFFFF",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "0.5px",
              transition: "all var(--dur-fast) var(--ease-default)",
            }}
          >
            {format.label}
          </button>
        );
      })}
    </div>
  );
}

/* =========================================================================
   SETUP FLOW — Step 1: Market + Theater Selection
   ========================================================================= */
function TheaterSetup({
  selectedTheaters,
  onSelect,
  onNext,
}: {
  selectedTheaters: string[];
  onSelect: (theaters: string[]) => void;
  onNext: () => void;
}) {
  const [markets, setMarkets] = useState<MarketInfo[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<string>("");
  const [theaterOptions, setTheaterOptions] = useState<TheaterInfo[]>([]);
  const [customSlug, setCustomSlug] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/theaters")
      .then((r) => r.json())
      .then((data: { markets: MarketInfo[] }) => {
        setMarkets(data.markets || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedMarket) {
      setTheaterOptions([]);
      return;
    }
    fetch(`/api/theaters?market=${selectedMarket}`)
      .then((r) => r.json())
      .then((data: { theaters: TheaterInfo[] }) => {
        setTheaterOptions(data.theaters || []);
      })
      .catch(() => setTheaterOptions([]));
  }, [selectedMarket]);

  const toggleTheater = (slug: string) => {
    if (selectedTheaters.includes(slug)) {
      onSelect(selectedTheaters.filter((s) => s !== slug));
    } else {
      onSelect([...selectedTheaters, slug]);
    }
  };

  const addCustom = () => {
    const slug = customSlug.trim().toLowerCase().replace(/\s+/g, "-");
    if (slug && !selectedTheaters.includes(slug)) {
      onSelect([...selectedTheaters, slug]);
      setCustomSlug("");
    }
  };

  return (
    <div data-testid="theater-setup">
      <h2
        style={{
          margin: "0 0 var(--space-sm)",
          fontSize: "var(--text-xl)",
          fontWeight: 800,
          color: "var(--text-primary)",
        }}
      >
        Select Theaters
      </h2>
      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: "var(--text-sm)",
          margin: "0 0 var(--space-lg)",
        }}
      >
        Choose a market, then pick the theaters you want to track.
      </p>

      {/* Market selector */}
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <label
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
          Market
        </label>
        {loading ? (
          <div className="skeleton" style={{ height: 44, width: "100%" }} />
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)" }}>
            {markets.map((m) => (
              <button
                key={m.slug}
                data-testid={`market-${m.slug}`}
                onClick={() => setSelectedMarket(m.slug)}
                style={{
                  padding: "var(--space-sm) var(--space-base)",
                  borderRadius: 8,
                  border: `1.5px solid ${selectedMarket === m.slug ? "var(--accent)" : "var(--border-subtle)"}`,
                  background: selectedMarket === m.slug ? "var(--bg-elevated)" : "transparent",
                  color: selectedMarket === m.slug ? "var(--text-primary)" : "var(--text-secondary)",
                  fontFamily: "inherit",
                  fontSize: "var(--text-sm)",
                  fontWeight: selectedMarket === m.slug ? 700 : 500,
                  cursor: "pointer",
                  transition: "all var(--dur-fast) var(--ease-default)",
                }}
              >
                {m.name}, {m.state}
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginLeft: 6 }}>
                  {m.theaterCount}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Theater options */}
      {theaterOptions.length > 0 && (
        <div style={{ marginBottom: "var(--space-lg)" }} data-testid="theater-options">
          <label
            style={{
              display: "block",
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginBottom: "var(--space-sm)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Theaters in {markets.find((m) => m.slug === selectedMarket)?.name}
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            {theaterOptions.map((t) => {
              const isSelected = selectedTheaters.includes(t.slug);
              return (
                <button
                  key={t.slug}
                  data-testid={`theater-${t.slug}`}
                  onClick={() => toggleTheater(t.slug)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "var(--space-md) var(--space-base)",
                    borderRadius: 8,
                    border: `1.5px solid ${isSelected ? "var(--accent)" : "var(--border-subtle)"}`,
                    background: isSelected ? "var(--accent-subtle)" : "var(--bg-surface)",
                    color: "var(--text-primary)",
                    fontFamily: "inherit",
                    fontSize: "var(--text-sm)",
                    cursor: "pointer",
                    transition: "all var(--dur-fast) var(--ease-default)",
                    textAlign: "left",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{t.name}</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>
                      {t.neighborhood}
                      {t.hasImax70mm && (
                        <span style={{ color: "var(--accent)", marginLeft: 8, fontWeight: 700 }}>
                          IMAX 70mm
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      border: `2px solid ${isSelected ? "var(--accent)" : "var(--border-default)"}`,
                      background: isSelected ? "var(--accent)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: 14,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {isSelected ? "\u2713" : ""}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom slug input */}
      <div style={{ marginBottom: "var(--space-lg)" }}>
        <label
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
          Or add a custom AMC theater slug
        </label>
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <input
            type="text"
            value={customSlug}
            onChange={(e) => setCustomSlug(e.target.value)}
            placeholder="e.g. amc-metreon-16"
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
            style={{ flex: 1 }}
          />
          <button className="btn-ghost" onClick={addCustom} type="button">
            Add
          </button>
        </div>
      </div>

      {/* Selected theaters */}
      {selectedTheaters.length > 0 && (
        <div style={{ marginBottom: "var(--space-lg)" }}>
          <div
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginBottom: "var(--space-sm)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Selected ({selectedTheaters.length})
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)" }}>
            {selectedTheaters.map((slug) => (
              <span
                key={slug}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "var(--accent-subtle)",
                  border: "1px solid var(--accent)",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {slug}
                <button
                  onClick={() => onSelect(selectedTheaters.filter((s) => s !== slug))}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-tertiary)",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: 16,
                    lineHeight: 1,
                  }}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        className="btn-primary"
        disabled={selectedTheaters.length === 0}
        onClick={onNext}
        data-testid="theater-next"
      >
        Next: Select Movie
      </button>
    </div>
  );
}

/* =========================================================================
   SETUP FLOW — Step 2: Movie Selection
   ========================================================================= */
function MovieSetup({
  theaters,
  selectedMovie,
  onSelect,
  onNext,
  onBack,
}: {
  theaters: string[];
  selectedMovie: string;
  onSelect: (slug: string, title: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [movies, setMovies] = useState<MovieInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (theaters.length === 0) return;
    setLoading(true);
    const today = toDateStr(new Date());
    fetch(`/api/movies?theater=${theaters[0]}&date=${today}`)
      .then((r) => r.json())
      .then((data: { movies: MovieInfo[] }) => {
        setMovies(data.movies || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [theaters]);

  const formatLabels: Record<string, string> = {
    imax70mm: "IMAX 70mm",
    dolbycinema: "Dolby Cinema",
    imax: "IMAX",
    standard: "Standard",
  };

  return (
    <div data-testid="movie-setup">
      <h2
        style={{
          margin: "0 0 var(--space-sm)",
          fontSize: "var(--text-xl)",
          fontWeight: 800,
          color: "var(--text-primary)",
        }}
      >
        Select a Movie
      </h2>
      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: "var(--text-sm)",
          margin: "0 0 var(--space-lg)",
        }}
      >
        Choose the movie you want to track showtimes for.
      </p>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 64, animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      ) : movies.length === 0 ? (
        <div
          className="card"
          style={{
            padding: "var(--space-2xl)",
            textAlign: "center",
            color: "var(--text-tertiary)",
          }}
        >
          <p style={{ margin: "0 0 var(--space-md)", fontSize: "var(--text-sm)" }}>
            No movies found at this theater for today. Try a different date or theater.
          </p>
        </div>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", marginBottom: "var(--space-lg)" }}
          data-testid="movie-list"
        >
          {movies.map((m) => {
            const isSelected = selectedMovie === m.slug;
            return (
              <button
                key={m.slug}
                data-testid={`movie-${m.slug}`}
                onClick={() => onSelect(m.slug, m.title)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-md) var(--space-base)",
                  borderRadius: 8,
                  border: `1.5px solid ${isSelected ? "var(--accent)" : "var(--border-subtle)"}`,
                  background: isSelected ? "var(--accent-subtle)" : "var(--bg-surface)",
                  color: "var(--text-primary)",
                  fontFamily: "inherit",
                  fontSize: "var(--text-sm)",
                  cursor: "pointer",
                  transition: "all var(--dur-fast) var(--ease-default)",
                  textAlign: "left",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{m.title}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                    {m.formats.map((f) => (
                      <span
                        key={f}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 3,
                          background: f === "imax70mm" ? "var(--accent)" : "var(--bg-elevated)",
                          color: f === "imax70mm" ? "#FFFFFF" : "var(--text-tertiary)",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {formatLabels[f] || f}
                      </span>
                    ))}
                  </div>
                </div>
                {isSelected && (
                  <span style={{ color: "var(--accent)", fontSize: 20, fontWeight: 800 }}>{"\u2713"}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: "var(--space-md)" }}>
        <button className="btn-ghost" onClick={onBack}>
          Back
        </button>
        <button
          className="btn-primary"
          disabled={!selectedMovie}
          onClick={onNext}
          data-testid="movie-next"
        >
          Next: Select Dates
        </button>
      </div>
    </div>
  );
}

/* =========================================================================
   SETUP FLOW — Step 3: Date Selection
   ========================================================================= */
function DateSetup({
  dates,
  onSelect,
  onNext,
  onBack,
}: {
  dates: string[];
  onSelect: (dates: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(dates[0] || defaults.start);
  const [endDate, setEndDate] = useState(dates[dates.length - 1] || defaults.end);

  const quickPicks = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();

    const daysToFri = (5 - dayOfWeek + 7) % 7 || 7;
    const fri = new Date(today);
    fri.setDate(today.getDate() + (dayOfWeek <= 5 ? daysToFri : 0));
    if (dayOfWeek >= 5) fri.setDate(today.getDate());
    const sun = new Date(fri);
    sun.setDate(fri.getDate() + (dayOfWeek === 0 ? 0 : 7 - fri.getDay()));

    const nextMon = new Date(today);
    nextMon.setDate(today.getDate() + ((8 - dayOfWeek) % 7 || 7));
    const nextSun = new Date(nextMon);
    nextSun.setDate(nextMon.getDate() + 6);

    const twoWeeks = new Date(today);
    twoWeeks.setDate(today.getDate() + 13);

    return [
      { label: "Next 7 days", start: toDateStr(today), end: toDateStr(new Date(today.getTime() + 6 * 86400000)) },
      { label: "This weekend", start: toDateStr(fri), end: toDateStr(sun) },
      { label: "Next week", start: toDateStr(nextMon), end: toDateStr(nextSun) },
      { label: "Next 2 weeks", start: toDateStr(today), end: toDateStr(twoWeeks) },
    ];
  }, []);

  const applyQuick = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    onSelect(generateDateRange(start, end));
  };

  useEffect(() => {
    if (startDate && endDate && startDate <= endDate) {
      onSelect(generateDateRange(startDate, endDate));
    }
  }, [startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div data-testid="date-setup">
      <h2
        style={{
          margin: "0 0 var(--space-sm)",
          fontSize: "var(--text-xl)",
          fontWeight: 800,
          color: "var(--text-primary)",
        }}
      >
        Select Date Range
      </h2>
      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: "var(--text-sm)",
          margin: "0 0 var(--space-lg)",
        }}
      >
        Choose the dates you want to check for showtimes.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)", marginBottom: "var(--space-lg)" }}>
        {quickPicks.map((qp) => (
          <button
            key={qp.label}
            className="btn-ghost"
            data-testid={`quick-${qp.label.toLowerCase().replace(/\s+/g, "-")}`}
            onClick={() => applyQuick(qp.start, qp.end)}
            style={{
              borderColor:
                startDate === qp.start && endDate === qp.end ? "var(--accent)" : undefined,
              color:
                startDate === qp.start && endDate === qp.end ? "var(--accent)" : undefined,
            }}
          >
            {qp.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: "var(--space-md)", marginBottom: "var(--space-lg)", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label
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
            Start date
          </label>
          <input
            type="text"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="YYYY-MM-DD"
            data-testid="start-date"
          />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label
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
            End date
          </label>
          <input
            type="text"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="YYYY-MM-DD"
            data-testid="end-date"
          />
        </div>
      </div>

      {dates.length > 0 && (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginBottom: "var(--space-lg)" }}>
          {dates.length} day{dates.length !== 1 ? "s" : ""} selected
        </p>
      )}

      <div style={{ display: "flex", gap: "var(--space-md)" }}>
        <button className="btn-ghost" onClick={onBack}>
          Back
        </button>
        <button
          className="btn-primary"
          disabled={dates.length === 0}
          onClick={onNext}
          data-testid="date-next"
        >
          View Showtimes
        </button>
      </div>
    </div>
  );
}

/* =========================================================================
   Main Page
   ========================================================================= */
export default function Home() {
  const [mounted, setMounted] = useState(false);

  // Setup flow state
  const [step, setStep] = useState<"setup-theaters" | "setup-movie" | "setup-dates" | "results">("setup-theaters");
  const [selectedTheaters, setSelectedTheaters] = useState<string[]>([]);
  const [selectedMovie, setSelectedMovie] = useState("");
  const [movieTitle, setMovieTitle] = useState("");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  // Results state
  const [status, setStatus] = useState<MultiStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [lastChecked, setLastChecked] = useState<string>("");
  const [selectedTheater, setSelectedTheater] = useState("");
  const [selectedFormat, setSelectedFormat] = useState(FORMAT_LIST[0].tag);

  // Initialize from URL params or localStorage
  useEffect(() => {
    setMounted(true);
    const urlParams = readUrlParams();
    const lsParams = readLocalStorage();

    const theaters = urlParams.theaters || lsParams?.theaters;
    const movie = urlParams.movie || lsParams?.movie;
    const dates = urlParams.dates || lsParams?.dates;

    if (theaters && theaters.length > 0 && movie) {
      setSelectedTheaters(theaters);
      setSelectedMovie(movie);
      setMovieTitle(movie.replace(/-\d+$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
      setSelectedDates(dates || generateDateRange(getDefaultDates().start, getDefaultDates().end));
      setSelectedTheater(theaters[0]);
      setStep("results");
    }
  }, []);

  // Fetch status when in results mode
  const fetchStatus = useCallback(async () => {
    if (selectedTheaters.length === 0 || !selectedMovie || selectedDates.length === 0) return;

    setLoadingStatus(true);
    try {
      const params = new URLSearchParams({
        theaters: selectedTheaters.join(","),
        movie: selectedMovie,
        dates: selectedDates.join(","),
      });
      const resp = await fetch(`/api/status?${params}`);
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
  }, [selectedTheaters, selectedMovie, selectedDates]);

  useEffect(() => {
    if (step === "results") {
      fetchStatus();
      const interval = setInterval(fetchStatus, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [step, fetchStatus]);

  // Persist selections
  useEffect(() => {
    if (step === "results" && selectedTheaters.length > 0 && selectedMovie) {
      writeUrlParams(selectedTheaters, selectedMovie, selectedDates);
      writeLocalStorage(selectedTheaters, selectedMovie, selectedDates);
    }
  }, [step, selectedTheaters, selectedMovie, selectedDates]);

  const theaterList = useMemo(
    () =>
      selectedTheaters.map((slug) => {
        const data = status?.theaters[slug];
        return {
          slug,
          name: data?.name || slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          neighborhood: data?.neighborhood || "",
        };
      }),
    [selectedTheaters, status]
  );

  const bestCombo = findBestAvailable(status?.theaters, theaterList, FORMAT_LIST);

  useEffect(() => {
    if (bestCombo && step === "results") {
      setSelectedTheater(bestCombo.theaterSlug);
      setSelectedFormat(bestCombo.formatTag);
    }
  }, [bestCombo?.theaterSlug, bestCombo?.formatTag]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentTheaterData = status?.theaters[selectedTheater];
  const currentFormatData = currentTheaterData?.formats[selectedFormat];

  const startOver = () => {
    setStep("setup-theaters");
    setStatus(null);
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  };

  if (!mounted) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
          <div className="projector-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* ===== HERO ===== */}
      <header
        style={{
          background: "var(--bg-base)",
          padding: "var(--space-2xl) var(--space-lg) var(--space-xl)",
          textAlign: "center",
          position: "relative",
        }}
      >

        <div style={{ position: "relative", zIndex: 2, maxWidth: 700, margin: "0 auto" }}>
          <div
            className="hero-enter"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-sm)",
              background: "var(--accent)",
              padding: "5px 16px",
              borderRadius: 4,
              marginBottom: "var(--space-base)",
            }}
          >
            <span
              style={{
                color: "#FFFFFF",
                fontSize: "var(--text-xs)",
                fontWeight: 800,
                letterSpacing: "2.5px",
              }}
            >
              AMC SHOWTIME ALERTS
            </span>
          </div>

          <h1
            className="hero-enter hero-enter-delay-1"
            style={{
              fontSize: "clamp(var(--text-xl), 5vw, var(--text-3xl))",
              fontWeight: 800,
              margin: "0 0 var(--space-sm)",
              lineHeight: "var(--leading-tight)",
              letterSpacing: "-0.5px",
              color: "var(--text-primary)",
            }}
          >
            {step === "results" && movieTitle
              ? movieTitle
              : "Track Any Movie at Any AMC Theater"}
          </h1>

          <p
            className="hero-enter hero-enter-delay-2"
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              margin: 0,
              fontWeight: 400,
            }}
          >
            {step === "results"
              ? `${selectedTheaters.length} theater${selectedTheaters.length !== 1 ? "s" : ""} \u00b7 ${selectedDates.length} date${selectedDates.length !== 1 ? "s" : ""}`
              : "Search theaters, pick your movie, and check showtimes"}
          </p>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "0 var(--space-lg)" }}>
        {/* ===== SETUP FLOW ===== */}
        {step !== "results" && (
          <section
            className="card"
            style={{ padding: "var(--space-2xl)", margin: "var(--space-xl) 0" }}
            data-testid="setup-flow"
          >
            {/* Step indicators */}
            <div
              style={{
                display: "flex",
                gap: "var(--space-md)",
                marginBottom: "var(--space-xl)",
              }}
            >
              {[
                { key: "setup-theaters", label: "Theaters", num: 1 },
                { key: "setup-movie", label: "Movie", num: 2 },
                { key: "setup-dates", label: "Dates", num: 3 },
              ].map((s) => {
                const steps = ["setup-theaters", "setup-movie", "setup-dates"];
                const currentIdx = steps.indexOf(step);
                const thisIdx = steps.indexOf(s.key);
                const isActive = step === s.key;
                const isDone = thisIdx < currentIdx;

                return (
                  <div
                    key={s.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      opacity: isActive ? 1 : isDone ? 0.8 : 0.4,
                    }}
                  >
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: isActive ? "var(--accent)" : isDone ? "#FFFFFF" : "var(--bg-elevated)",
                        color: isActive ? "white" : isDone ? "#000000" : "var(--text-tertiary)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {isDone ? "\u2713" : s.num}
                    </span>
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        fontWeight: 700,
                        color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {step === "setup-theaters" && (
              <TheaterSetup
                selectedTheaters={selectedTheaters}
                onSelect={setSelectedTheaters}
                onNext={() => setStep("setup-movie")}
              />
            )}

            {step === "setup-movie" && (
              <MovieSetup
                theaters={selectedTheaters}
                selectedMovie={selectedMovie}
                onSelect={(slug, title) => {
                  setSelectedMovie(slug);
                  setMovieTitle(title);
                }}
                onNext={() => {
                  if (selectedDates.length === 0) {
                    const d = getDefaultDates();
                    setSelectedDates(generateDateRange(d.start, d.end));
                  }
                  setStep("setup-dates");
                }}
                onBack={() => setStep("setup-theaters")}
              />
            )}

            {step === "setup-dates" && (
              <DateSetup
                dates={selectedDates}
                onSelect={setSelectedDates}
                onNext={() => {
                  setSelectedTheater(selectedTheaters[0]);
                  setStep("results");
                }}
                onBack={() => setStep("setup-movie")}
              />
            )}
          </section>
        )}

        {/* ===== RESULTS VIEW ===== */}
        {step === "results" && (
          <section style={{ padding: "var(--space-xl) 0" }} data-testid="results-view">
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
                  {movieTitle || selectedMovie}
                </h2>
                <p
                  style={{
                    margin: "4px 0 0",
                    color: "var(--text-secondary)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  {FORMAT_LIST.find((f) => f.tag === selectedFormat)?.label ?? selectedFormat}
                  {" \u00b7 "}
                  {theaterList.find((t) => t.slug === selectedTheater)?.name ?? selectedTheater}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
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
                <button
                  className="btn-ghost"
                  onClick={startOver}
                  data-testid="change-selection"
                  style={{ fontSize: "var(--text-xs)" }}
                >
                  Change selection
                </button>
              </div>
            </div>

            {/* Theater tabs */}
            <TheaterTabs
              selected={selectedTheater}
              onChange={setSelectedTheater}
              theaters={status?.theaters}
              theaterList={theaterList}
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

            {/* Loading skeleton */}
            {loadingStatus && !status && <ResultsSkeleton />}

            {/* Date cards grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "var(--space-base)",
              }}
              data-testid="showtime-grid"
            >
              {selectedDates.map((date, i) => (
                <DateCard
                  key={`${selectedTheater}-${selectedFormat}-${date}`}
                  date={date}
                  result={currentFormatData?.dates[date]}
                  index={i}
                />
              ))}
            </div>
          </section>
        )}

        {/* ===== FOOTER ===== */}
        <footer
          style={{
            borderTop: "1px solid var(--border-subtle)",
            padding: "var(--space-xl) 0 var(--space-2xl)",
          }}
        >

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
                Select your theaters and movie, then we check AMC&apos;s website for
                available showtimes across multiple formats.
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
                Formats tracked
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
                Not affiliated with AMC Theatres, IMAX Corporation, or any
                filmmakers. Independent fan tool. Showtimes sourced from
                AMC&apos;s public website.
              </p>
            </div>
          </div>

        </footer>
      </main>
    </div>
  );
}
