"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";

/* =========================================================================
   Types
   ========================================================================= */
interface Showtime {
  id: string;
  time: string;
  amPm: string;
  status: string;
  url: string;
  promo?: string;
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

interface MovieInfo {
  slug: string;
  title: string;
  formats: string[];
  poster?: string;
  description?: string;
}

interface DiscussionMessage {
  id: number;
  showtime_id: string;
  anonymous_id: string;
  body: string;
  created_at: string;
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
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const s = new Date(sy, sm - 1, sd);
  const e = new Date(ey, em - 1, ed);
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
   Showtime Countdown + Reminder Toggle
   ========================================================================= */
function parseShowtimeDate(date: string, time: string, amPm: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const parts = time.split(":").map(Number);
  const rawH = parts[0];
  const rawM = parts[1] ?? 0;
  const isPM = amPm.toLowerCase() === "pm";
  let hours = rawH;
  if (isPM && hours !== 12) hours += 12;
  if (!isPM && hours === 12) hours = 0;
  return new Date(year, month - 1, day, hours, rawM, 0, 0);
}

function getCountdownLabel(showtimeDt: Date, now: Date): string | null {
  const diffMs = showtimeDt.getTime() - now.getTime();
  if (diffMs <= 0) return null;
  const totalMin = Math.floor(diffMs / 60000);
  if (totalMin > 24 * 60) return null;
  if (totalMin < 1) return "Starting now";
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0) return `in ${hours}h ${mins}m`;
  return `in ${mins}m`;
}

const REMINDERS_LS_KEY = "amc-showtime-reminders";

function getReminders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(REMINDERS_LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveReminders(reminders: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REMINDERS_LS_KEY, JSON.stringify(reminders));
  } catch { /* ignore */ }
}

function ShowtimeCountdown({ date, time, amPm }: { date: string; time: string; amPm: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const showtimeDt = parseShowtimeDate(date, time, amPm);
    const update = () => setLabel(getCountdownLabel(showtimeDt, new Date()));
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [date, time, amPm]);

  if (!label) return null;
  return (
    <span
      style={{
        fontSize: "var(--text-xs)",
        color: "var(--text-tertiary)",
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function ReminderToggle({
  showtimeId,
  date,
  time,
  amPm,
}: {
  showtimeId: string;
  date: string;
  time: string;
  amPm: string;
}) {
  const [isSet, setIsSet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const showtimeDt = parseShowtimeDate(date, time, amPm);

  useEffect(() => {
    const reminders = getReminders();
    setIsSet(showtimeId in reminders);
  }, [showtimeId]);

  // Only show for showtimes at least 65 minutes in the future (so there's time for the reminder)
  if (showtimeDt.getTime() - Date.now() < 65 * 60 * 1000) return null;

  const handleToggle = async () => {
    const reminders = getReminders();
    if (isSet) {
      delete reminders[showtimeId];
      saveReminders(reminders);
      setIsSet(false);
      setToast("Reminder removed");
    } else {
      let permission = "granted";
      if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
        permission = await Notification.requestPermission();
      }
      if (permission === "denied") {
        setToast("Notifications blocked — enable in browser settings");
        setTimeout(() => setToast(null), 3000);
        return;
      }
      reminders[showtimeId] = showtimeDt.toISOString();
      saveReminders(reminders);
      setIsSet(true);
      setToast(`Reminder set for 1hr before ${time} ${amPm.toUpperCase()}`);
    }
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <button
        onClick={handleToggle}
        title={isSet ? "Remove reminder" : "Remind me 1hr before"}
        aria-label={isSet ? "Remove 1hr-before reminder" : "Remind me 1hr before this showtime"}
        data-testid={`reminder-toggle-${showtimeId}`}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px",
          color: isSet ? "var(--accent)" : "var(--text-tertiary)",
          display: "flex",
          alignItems: "center",
          transition: "color var(--dur-fast) var(--ease-default)",
          flexShrink: 0,
        }}
      >
        {isSet ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a7 7 0 00-7 7v3.586l-1.707 1.707A1 1 0 004 16h16a1 1 0 00.707-1.707L19 12.586V9a7 7 0 00-7-7zm-1.5 18a1.5 1.5 0 003 0h-3z"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
        )}
      </button>
      {toast && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            right: 0,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: "var(--text-xs)",
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            zIndex: 100,
            pointerEvents: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   RSVP Button — "I'm going!" toggle with live count
   ========================================================================= */
function getAnonymousId(): string {
  const key = "amc_anonymous_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function RsvpButton({ showtimeId }: { showtimeId: string }) {
  const [count, setCount] = useState(0);
  const [going, setGoing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const aid = getAnonymousId();
    fetch(`/api/rsvp?showtime_id=${encodeURIComponent(showtimeId)}&anonymous_id=${encodeURIComponent(aid)}`)
      .then((r) => r.json())
      .then((d: { count?: number; going?: boolean }) => {
        setCount(d.count ?? 0);
        setGoing(d.going ?? false);
      })
      .catch(() => {});
  }, [showtimeId]);

  const handleToggle = async () => {
    if (loading) return;
    setLoading(true);
    const aid = getAnonymousId();
    const action = going ? "remove" : "add";
    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showtime_id: showtimeId, anonymous_id: aid, action }),
      });
      if (res.ok) {
        const d = (await res.json()) as { count?: number; going?: boolean };
        setCount(d.count ?? count);
        setGoing(d.going ?? !going);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      title={going ? "Remove RSVP" : "I'm going!"}
      aria-label={going ? "Remove RSVP for this showtime" : "RSVP: I'm going to this showtime"}
      data-testid={`rsvp-toggle-${showtimeId}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: going ? "rgba(239, 68, 68, 0.12)" : "none",
        border: going ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid var(--border-subtle)",
        borderRadius: 6,
        cursor: loading ? "default" : "pointer",
        padding: "3px 8px",
        color: going ? "var(--accent)" : "var(--text-tertiary)",
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        transition: "color var(--dur-fast) var(--ease-default), background var(--dur-fast) var(--ease-default)",
        flexShrink: 0,
        opacity: loading ? 0.6 : 1,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill={going ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
      </svg>
      {count > 0 ? `${count} going` : "I'm going"}
    </button>
  );
}

/* =========================================================================
   Discussion Thread — collapsible chat per showtime
   ========================================================================= */
function DiscussionThread({ showtimeId }: { showtimeId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const myAid = typeof window !== "undefined" ? getAnonymousId() : "";

  function loadMessages() {
    fetch(`/api/discussions?showtime_id=${encodeURIComponent(showtimeId)}&limit=50`)
      .then((r) => r.json())
      .then((d: { messages?: DiscussionMessage[]; total?: number }) => {
        setMessages(d.messages ?? []);
        setTotal(d.total ?? 0);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) loadMessages();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showtime_id: showtimeId, anonymous_id: myAid, body: trimmed }),
      });
      if (res.ok) {
        setInput("");
        loadMessages();
      } else {
        const d = (await res.json()) as { error?: string };
        setSubmitError(d.error ?? "Failed to post.");
      }
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  function formatRelativeTime(ts: string): string {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div style={{ width: "100%", marginTop: "var(--space-sm)" }}>
      {/* Toggle button */}
      <button
        onClick={handleToggle}
        data-testid={`discussion-toggle-${showtimeId}`}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: "none",
          border: "1px solid var(--border-subtle)",
          borderRadius: 6,
          cursor: "pointer",
          padding: "3px 8px",
          color: "var(--text-tertiary)",
          fontSize: "var(--text-xs)",
          fontWeight: 600,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        {total > 0 ? `${total} comment${total !== 1 ? "s" : ""}` : "Chat"}
        <span style={{ fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>

      {/* Thread panel */}
      {open && (
        <div
          style={{
            marginTop: "var(--space-sm)",
            background: "var(--bg-base)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            padding: "var(--space-md)",
          }}
        >
          {!loaded ? (
            <div style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)", padding: "var(--space-sm) 0" }}>
              Loading…
            </div>
          ) : (
            <>
              {/* Messages */}
              {messages.length === 0 ? (
                <div style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)", marginBottom: "var(--space-md)" }}>
                  No comments yet. Start the conversation!
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", marginBottom: "var(--space-md)" }}>
                  {messages.map((m) => {
                    const isMe = m.anonymous_id === myAid;
                    return (
                      <div
                        key={m.id}
                        data-testid={`discussion-message-${m.id}`}
                        style={{
                          background: isMe ? "rgba(99, 102, 241, 0.07)" : "var(--bg-elevated)",
                          border: isMe ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid var(--border-subtle)",
                          borderRadius: 6,
                          padding: "6px 10px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: 2 }}>
                          <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: isMe ? "rgb(99,102,241)" : "var(--text-secondary)" }}>
                            {isMe ? "You" : "Anonymous"}
                          </span>
                          <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                            {formatRelativeTime(m.created_at)}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-primary)", lineHeight: "var(--leading-normal)" }}>
                          {m.body}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Post form */}
              <form onSubmit={handleSubmit} style={{ display: "flex", gap: "var(--space-sm)", alignItems: "flex-end" }}>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={280}
                  placeholder="Add a comment…"
                  data-testid={`discussion-input-${showtimeId}`}
                  rows={2}
                  style={{
                    flex: 1,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 6,
                    padding: "6px 10px",
                    color: "var(--text-primary)",
                    fontSize: "var(--text-sm)",
                    resize: "none",
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={submitting || !input.trim()}
                  data-testid={`discussion-submit-${showtimeId}`}
                  style={{
                    background: "var(--accent)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "6px 14px",
                    fontSize: "var(--text-sm)",
                    fontWeight: 600,
                    cursor: submitting || !input.trim() ? "default" : "pointer",
                    opacity: submitting || !input.trim() ? 0.5 : 1,
                    flexShrink: 0,
                  }}
                >
                  {submitting ? "…" : "Post"}
                </button>
              </form>
              {submitError && (
                <p style={{ margin: "var(--space-xs) 0 0", fontSize: "var(--text-xs)", color: "var(--accent)" }}>
                  {submitError}
                </p>
              )}
              <div style={{ textAlign: "right", marginTop: 4 }}>
                <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                  {input.length}/280
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
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
      data-testid={`date-card-${date}`}
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
                alignItems: "flex-start",
                justifyContent: "space-between",
                background: "var(--bg-elevated)",
                borderRadius: 6,
                padding: "var(--space-md) var(--space-base)",
                gap: "var(--space-md)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", flexWrap: "wrap" }}>
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
                <ShowtimeCountdown date={date} time={st.time} amPm={st.amPm} />
                {st.promo && (
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      fontWeight: 700,
                      color: "#22C55E",
                      background: "rgba(34, 197, 94, 0.12)",
                      border: "1px solid rgba(34, 197, 94, 0.3)",
                      borderRadius: 4,
                      padding: "2px 6px",
                      whiteSpace: "nowrap",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {st.promo}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                <RsvpButton showtimeId={st.id} />
                <ReminderToggle showtimeId={st.id} date={date} time={st.time} amPm={st.amPm} />
                <a
                  href={st.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-red"
                  data-testid={`buy-tickets-${st.id}`}
                  data-showtime-id={st.id}
                  style={{ padding: "7px 16px", fontSize: "var(--text-sm)" }}
                >
                  Buy tickets
                </a>
              </div>
              <DiscussionThread showtimeId={st.id} />
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
          <div key={theater.slug} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <button
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
            <a
              href={`/theater/${theater.slug}`}
              title={`${theater.name} info, directions & parking`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "transparent",
                border: "1px solid #444444",
                color: "var(--text-tertiary)",
                fontSize: 12,
                fontWeight: 700,
                textDecoration: "none",
                lineHeight: 1,
                flexShrink: 0,
                transition: "border-color var(--dur-fast), color var(--dur-fast)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = "#FFFFFF";
                (e.currentTarget as HTMLAnchorElement).style.color = "#FFFFFF";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = "#444444";
                (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-tertiary)";
              }}
            >
              i
            </a>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================================
   Comparison Grid — theaters × formats × dates matrix
   ========================================================================= */
function ComparisonGrid({
  theaters,
  theaterList,
  dates,
}: {
  theaters: Record<string, TheaterData> | undefined;
  theaterList: { slug: string; name: string; neighborhood: string }[];
  dates: string[];
}) {
  if (!theaters) return null;

  return (
    <div style={{ overflowX: "auto", marginBottom: "var(--space-xl)" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "var(--text-sm)",
          minWidth: 600,
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                padding: "var(--space-sm) var(--space-md)",
                borderBottom: "1px solid var(--border-default)",
                color: "var(--text-tertiary)",
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                position: "sticky",
                left: 0,
                background: "var(--bg-base)",
                zIndex: 1,
              }}
            >
              Theater / Format
            </th>
            {dates.map((date) => {
              const { weekday, date: label } = formatDateNice(date);
              return (
                <th
                  key={date}
                  style={{
                    textAlign: "center",
                    padding: "var(--space-sm) var(--space-md)",
                    borderBottom: "1px solid var(--border-default)",
                    color: "var(--text-tertiary)",
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  <div>{weekday.slice(0, 3)}</div>
                  <div style={{ color: "var(--text-secondary)" }}>{label}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {theaterList.map((theater) => {
            const theaterData = theaters[theater.slug];
            if (!theaterData) return null;

            return FORMAT_LIST.map((format) => {
              const formatData = theaterData.formats[format.tag];
              return (
                <tr key={`${theater.slug}-${format.tag}`} className="showtime-row">
                  <td
                    style={{
                      padding: "var(--space-sm) var(--space-md)",
                      borderBottom: "1px solid var(--border-subtle)",
                      whiteSpace: "nowrap",
                      position: "sticky",
                      left: 0,
                      background: "var(--bg-base)",
                      zIndex: 1,
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "var(--text-sm)" }}>
                      {theater.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{format.label}</div>
                  </td>
                  {dates.map((date) => {
                    const dateResult = formatData?.dates[date];
                    const hasShowtimes = dateResult?.available && dateResult.showtimes.length > 0;
                    return (
                      <td
                        key={date}
                        style={{
                          textAlign: "center",
                          padding: "var(--space-xs) var(--space-sm)",
                          borderBottom: "1px solid var(--border-subtle)",
                          verticalAlign: "middle",
                        }}
                      >
                        {hasShowtimes ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
                            {dateResult!.showtimes.map((st) => (
                              <a
                                key={st.id}
                                href={st.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                data-testid={`buy-tickets-${st.id}`}
                                data-showtime-id={st.id}
                                title={st.promo || undefined}
                                style={{
                                  display: "inline-block",
                                  padding: "4px 8px",
                                  borderRadius: 4,
                                  border: `1px solid ${st.status === "SoldOut" ? "var(--text-disabled)" : "#FFFFFF"}`,
                                  color: st.status === "SoldOut" ? "var(--text-disabled)" : "#FFFFFF",
                                  textDecoration: st.status === "SoldOut" ? "line-through" : "none",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: st.status === "SoldOut" ? "not-allowed" : "pointer",
                                  transition: "all var(--dur-fast) var(--ease-default)",
                                }}
                                onMouseEnter={(e) => {
                                  if (st.status !== "SoldOut") {
                                    (e.target as HTMLElement).style.background = "#FFFFFF";
                                    (e.target as HTMLElement).style.color = "#000000";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (st.status !== "SoldOut") {
                                    (e.target as HTMLElement).style.background = "transparent";
                                    (e.target as HTMLElement).style.color = "#FFFFFF";
                                  }
                                }}
                              >
                                {st.time}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-disabled)", fontSize: 12 }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            });
          })}
        </tbody>
      </table>
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
   CURATED THEATER LIST — NYC
   ========================================================================= */
const CURATED_THEATERS: TheaterInfo[] = [
  { slug: "amc-lincoln-square-13", name: "AMC Lincoln Square 13", neighborhood: "Upper West Side", hasImax70mm: true },
  { slug: "amc-empire-25", name: "AMC Empire 25", neighborhood: "Times Square", hasImax70mm: false },
  { slug: "amc-kips-bay-15", name: "AMC Kips Bay 15", neighborhood: "Kips Bay", hasImax70mm: false },
];

/* =========================================================================
   SETUP FLOW — Step 1: Theater Selection
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
  const toggleTheater = (slug: string) => {
    if (selectedTheaters.includes(slug)) {
      onSelect(selectedTheaters.filter((s) => s !== slug));
    } else {
      onSelect([...selectedTheaters, slug]);
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
        Choose the theaters you want to track.
      </p>

      <div
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", marginBottom: "var(--space-lg)" }}
        data-testid="theater-options"
      >
        {CURATED_THEATERS.map((t) => {
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
   SETUP FLOW — Step 2: Movie Selection (Carousel)
   ========================================================================= */
const FORMAT_LABELS: Record<string, string> = {
  imax70mm: "IMAX 70mm",
  dolbycinema: "Dolby Cinema",
  imax: "IMAX",
  standard: "Standard",
};

function MovieCard({
  movie,
  isSelected,
  onSelect,
}: {
  movie: MovieInfo;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      data-testid={`movie-${movie.slug}`}
      onClick={onSelect}
      style={{
        display: "flex",
        flexDirection: "column",
        width: 180,
        flexShrink: 0,
        borderRadius: 10,
        border: `2px solid ${isSelected ? "var(--accent)" : "var(--border-subtle)"}`,
        background: isSelected ? "var(--accent-subtle)" : "var(--bg-surface)",
        color: "var(--text-primary)",
        fontFamily: "inherit",
        cursor: "pointer",
        transition: "all var(--dur-fast) var(--ease-default)",
        textAlign: "left",
        padding: 0,
        overflow: "hidden",
        position: "relative",
        scrollSnapAlign: "start",
      }}
      aria-pressed={isSelected}
    >
      {/* Poster */}
      <div
        style={{
          width: "100%",
          aspectRatio: "2/3",
          background: "var(--bg-elevated)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {movie.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={movie.poster}
            alt={movie.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-disabled)",
              fontSize: 40,
            }}
          >
            🎬
          </div>
        )}
        {/* Selected checkmark overlay */}
        {isSelected && (
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontSize: 16,
              fontWeight: 800,
              boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
            }}
          >
            ✓
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "var(--space-md)", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: "var(--text-sm)",
            lineHeight: "var(--leading-tight)",
            color: "var(--text-primary)",
          }}
        >
          {movie.title}
        </div>

        {movie.description && (
          <div
            style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
              lineHeight: "1.4",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            } as React.CSSProperties}
          >
            {movie.description}
          </div>
        )}

        {/* Format tags */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: "auto", paddingTop: 4 }}>
          {movie.formats.map((f) => (
            <span
              key={f}
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "1px 5px",
                borderRadius: 3,
                background: f === "imax70mm" ? "var(--accent)" : "var(--bg-elevated)",
                color: f === "imax70mm" ? "#FFFFFF" : "var(--text-tertiary)",
                letterSpacing: "0.5px",
                textTransform: "uppercase",
              }}
            >
              {FORMAT_LABELS[f] || f}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

function MovieCarouselSkeleton() {
  return (
    <div style={{ display: "flex", gap: "var(--space-md)", overflowX: "hidden" }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{ width: 180, flexShrink: 0, borderRadius: 10, overflow: "hidden", animationDelay: `${i * 100}ms` }}
        >
          <div className="skeleton" style={{ width: "100%", aspectRatio: "2/3" }} />
          <div style={{ padding: "var(--space-md)" }}>
            <div className="skeleton" style={{ width: "80%", height: 16, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: "100%", height: 10, marginBottom: 4 }} />
            <div className="skeleton" style={{ width: "70%", height: 10 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

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
    // Try today + next 6 days so upcoming releases (not yet playing today) still appear
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push(toDateStr(d));
    }
    Promise.all(
      dates.map((date) =>
        fetch(`/api/movies?theater=${theaters[0]}&date=${date}`)
          .then((r) => r.json())
          .then((data: { movies: MovieInfo[] }) => data.movies || [])
          .catch(() => [] as MovieInfo[])
      )
    ).then((results) => {
      // Merge and deduplicate by slug, preserving first-seen order
      const seen = new Set<string>();
      const merged: MovieInfo[] = [];
      for (const batch of results) {
        for (const m of batch) {
          if (!seen.has(m.slug)) {
            seen.add(m.slug);
            merged.push(m);
          }
        }
      }
      setMovies(merged);
      setLoading(false);
    });
  }, [theaters]);

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
        Swipe to browse movies playing now. Tap to select.
      </p>

      {loading ? (
        <MovieCarouselSkeleton />
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
          data-testid="movie-list"
          style={{
            display: "flex",
            gap: "var(--space-md)",
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            scrollPadding: "0 var(--space-md)",
            paddingBottom: "var(--space-md)",
            marginBottom: "var(--space-lg)",
            WebkitOverflowScrolling: "touch",
            msOverflowStyle: "none",
            scrollbarWidth: "none",
          } as React.CSSProperties}
        >
          {movies.map((m) => (
            <MovieCard
              key={m.slug}
              movie={m}
              isSelected={selectedMovie === m.slug}
              onSelect={() => onSelect(m.slug, m.title)}
            />
          ))}
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
    } else if (startDate && endDate && startDate > endDate) {
      onSelect([]);
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
   News Section
   ========================================================================= */
interface NewsArticle {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

function NewsSection({ articles }: { articles: NewsArticle[] }) {
  if (articles.length === 0) return null;

  return (
    <div style={{ marginTop: "var(--space-2xl)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-sm)", marginBottom: "var(--space-lg)" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
          Latest News
        </h2>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontWeight: 500 }}>
          via Google News
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "var(--space-base)",
        }}
      >
        {articles.map((article, i) => (
          <a
            key={i}
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none" }}
          >
            <div
              className="card"
              style={{
                padding: "var(--space-lg)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-sm)",
                height: "100%",
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                    color: "var(--accent)",
                    background: "rgba(99,102,241,0.12)",
                    padding: "2px 7px",
                    borderRadius: 4,
                    maxWidth: "60%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {article.source}
                </span>
                {article.pubDate && (
                  <span style={{ fontSize: 10, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                    {formatNewsDate(article.pubDate)}
                  </span>
                )}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--text-sm)",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  lineHeight: "var(--leading-normal)",
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {article.title}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function formatNewsDate(pubDate: string): string {
  try {
    const d = new Date(pubDate);
    if (isNaN(d.getTime())) return "";
    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffH = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffH < 1) return "just now";
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

/* =========================================================================
   Community Reviews
   ========================================================================= */
interface Review {
  id: number;
  movie_slug: string;
  anonymous_id: string;
  rating: number;
  body: string;
  created_at: string;
}

function StarRating({
  value,
  onChange,
  readonly,
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <span style={{ display: "inline-flex", gap: 2 }} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          onClick={() => !readonly && onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          style={{
            fontSize: 20,
            cursor: readonly ? "default" : "pointer",
            color: star <= (hovered || value) ? "#f59e0b" : "var(--border-default)",
            transition: "color 0.1s",
            userSelect: "none",
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function ReviewsSection({ movieSlug }: { movieSlug: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingList, setLoadingList] = useState(true);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [submitMsg, setSubmitMsg] = useState("");
  const [myReviewId, setMyReviewId] = useState<number | null>(null);

  const aid = typeof window !== "undefined" ? getAnonymousId() : "";

  useEffect(() => {
    if (!movieSlug) return;
    setLoadingList(true);
    fetch(`/api/reviews?movie_slug=${encodeURIComponent(movieSlug)}&limit=20`)
      .then((r) => r.json())
      .then((data: { reviews?: Review[]; total?: number }) => {
        const list = data.reviews ?? [];
        setReviews(list);
        setTotal(data.total ?? list.length);
        const mine = list.find((r) => r.anonymous_id === aid);
        if (mine) {
          setMyReviewId(mine.id);
          setRating(mine.rating);
          setBody(mine.body);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingList(false));
  }, [movieSlug, aid]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setSubmitMsg("Please select a star rating.");
      setSubmitStatus("error");
      return;
    }
    if (body.trim().length < 10) {
      setSubmitMsg("Review must be at least 10 characters.");
      setSubmitStatus("error");
      return;
    }
    setSubmitStatus("loading");
    setSubmitMsg("");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movie_slug: movieSlug, anonymous_id: aid, rating, body: body.trim() }),
      });
      const data = (await res.json()) as { id?: number; created?: boolean; updated?: boolean; error?: string };
      if (!res.ok) {
        setSubmitStatus("error");
        setSubmitMsg(data.error ?? "Failed to submit review.");
        return;
      }
      setSubmitStatus("success");
      setSubmitMsg(data.updated ? "Review updated!" : "Review submitted. Thanks!");
      setMyReviewId(data.id ?? null);
      // Re-fetch reviews
      fetch(`/api/reviews?movie_slug=${encodeURIComponent(movieSlug)}&limit=20`)
        .then((r) => r.json())
        .then((d: { reviews?: Review[]; total?: number }) => {
          setReviews(d.reviews ?? []);
          setTotal(d.total ?? 0);
        })
        .catch(() => {});
    } catch {
      setSubmitStatus("error");
      setSubmitMsg("Network error. Please try again.");
    }
  }

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

  return (
    <div style={{ marginTop: "var(--space-2xl)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-sm)", marginBottom: "var(--space-lg)" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
          Community Reviews
        </h2>
        {avgRating !== null && (
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", fontWeight: 500 }}>
            {avgRating.toFixed(1)} ★ · {total} {total === 1 ? "review" : "reviews"}
          </span>
        )}
      </div>

      {/* Submit form */}
      <div className="card" style={{ padding: "var(--space-lg)", marginBottom: "var(--space-lg)" }}>
        <h3 style={{ margin: "0 0 var(--space-md)", fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>
          {myReviewId ? "Update your review" : "Write a review"}
        </h3>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <div>
            <label style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", display: "block", marginBottom: 6 }}>
              Your rating
            </label>
            <StarRating value={rating} onChange={setRating} />
          </div>
          <div>
            <label style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", display: "block", marginBottom: 6 }}>
              Your review
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share your thoughts after seeing the film…"
              maxLength={1000}
              rows={4}
              style={{
                width: "100%",
                background: "var(--bg-elevated)",
                border: "1.5px solid var(--border-default)",
                borderRadius: 8,
                padding: "var(--space-md)",
                color: "var(--text-primary)",
                fontSize: "var(--text-sm)",
                resize: "vertical",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, textAlign: "right" }}>
              {body.length}/1000
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
            <button
              type="submit"
              disabled={submitStatus === "loading"}
              style={{
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 24px",
                fontWeight: 700,
                fontSize: "var(--text-sm)",
                cursor: submitStatus === "loading" ? "not-allowed" : "pointer",
                opacity: submitStatus === "loading" ? 0.7 : 1,
              }}
            >
              {submitStatus === "loading" ? "Submitting…" : myReviewId ? "Update review" : "Submit review"}
            </button>
            {submitMsg && (
              <span style={{ fontSize: "var(--text-sm)", color: submitStatus === "error" ? "var(--error)" : "var(--success)" }}>
                {submitMsg}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Review list */}
      {loadingList ? (
        <div style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>Loading reviews…</div>
      ) : reviews.length === 0 ? (
        <div className="card" style={{ padding: "var(--space-lg)", color: "var(--text-tertiary)", fontSize: "var(--text-sm)", textAlign: "center" }}>
          No reviews yet. Be the first to share your thoughts after the showing!
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          {reviews.map((r) => (
            <div
              key={r.id}
              className="card"
              style={{
                padding: "var(--space-lg)",
                borderLeft: r.anonymous_id === aid ? "3px solid var(--accent)" : undefined,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-sm)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                  <StarRating value={r.rating} readonly />
                  {r.anonymous_id === aid && (
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--accent)", background: "rgba(99,102,241,0.12)", padding: "2px 7px", borderRadius: 4 }}>
                      You
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                  {formatNewsDate(r.created_at)}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: "var(--leading-normal)" }}>
                {r.body}
              </p>
            </div>
          ))}
        </div>
      )}
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
  const [compareMode, setCompareMode] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [shareMsg, setShareMsg] = useState("");
  const [subEmail, setSubEmail] = useState("");
  const [subChannel, setSubChannel] = useState<"email" | "sms" | "both">("email");
  const [subPhone, setSubPhone] = useState("");
  const [subStatus, setSubStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [subMsg, setSubMsg] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<HTMLDivElement>(null);
  const [abVariant, setAbVariant] = useState<"A" | "B">("A");
  const [inboundRefCode, setInboundRefCode] = useState<string>("");
  const [myReferralCode, setMyReferralCode] = useState<string>("");
  const [referralCopied, setReferralCopied] = useState(false);

  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);

  // Fetch subscriber count for social proof
  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data: { subscribers: number }) => setSubscriberCount(data.subscribers))
      .catch(() => {});
  }, []);

  // A/B test: assign variant on first load, persist in localStorage
  useEffect(() => {
    const LS_AB_KEY = "amc-ab-variant";
    const stored = localStorage.getItem(LS_AB_KEY);
    if (stored === "A" || stored === "B") {
      setAbVariant(stored);
    } else {
      const assigned: "A" | "B" = Math.random() < 0.5 ? "A" : "B";
      localStorage.setItem(LS_AB_KEY, assigned);
      setAbVariant(assigned);
    }
  }, []);

  // Fetch news feed
  useEffect(() => {
    fetch("/api/news")
      .then((r) => r.json())
      .then((data: { articles?: NewsArticle[] }) => {
        if (data.articles && data.articles.length > 0) setNewsArticles(data.articles);
      })
      .catch(() => {});
  }, []);

  // Global reminder checker — fires browser notifications 1hr before saved showtimes
  useEffect(() => {
    const checkReminders = () => {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const reminders = getReminders();
      const now = Date.now();
      const updated = { ...reminders };
      let changed = false;
      for (const [id, isoStr] of Object.entries(reminders)) {
        const showtimeMs = new Date(isoStr).getTime();
        const reminderMs = showtimeMs - 60 * 60 * 1000; // 1hr before
        if (now >= reminderMs && now < showtimeMs) {
          const showtimeTime = new Date(isoStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
          new Notification("Showtime reminder", {
            body: `Your showtime starts at ${showtimeTime} — 1hr to go!`,
            icon: "/favicon.svg",
            tag: `amc-reminder-${id}`,
          });
          delete updated[id];
          changed = true;
        } else if (now >= showtimeMs) {
          // Showtime passed — clean up
          delete updated[id];
          changed = true;
        }
      }
      if (changed) saveReminders(updated);
    };
    checkReminders();
    const id = setInterval(checkReminders, 60000);
    return () => clearInterval(id);
  }, []);

  const handleShare = async () => {
    const text = `Check showtimes for ${movieTitle || "movies"} at AMC — track IMAX 70mm, Dolby Cinema & more`;
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "AMC Showtime Alerts", text, url });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShareMsg("Copied to clipboard!");
      setTimeout(() => setShareMsg(""), 2000);
    }
  };

  // Load Turnstile widget
  useEffect(() => {
    if (step !== "results" || !turnstileRef.current) return;
    const existingScript = document.querySelector('script[src*="turnstile"]');
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => renderTurnstile();
      document.head.appendChild(script);
    } else {
      renderTurnstile();
    }
    function renderTurnstile() {
      const w = window as any;
      if (w.turnstile && turnstileRef.current && !turnstileRef.current.hasChildNodes()) {
        w.turnstile.render(turnstileRef.current, {
          sitekey: "0x4AAAAAAA" + "BAAAAAAAL_test_only",
          callback: (token: string) => setTurnstileToken(token),
          theme: "dark",
          size: "compact",
        });
      }
    }
  }, [step]);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subEmail) return;
    setSubStatus("loading");
    try {
      const resp = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: subEmail,
          dates: selectedDates,
          turnstileToken,
          channel: subChannel,
          phone: subChannel !== "email" ? subPhone : undefined,
          abVariant,
          refCode: inboundRefCode || undefined,
          movieSlug: selectedMovie || undefined,
          movieTitle: movieTitle || undefined,
          theaterSlugs: selectedTheaters.length > 0 ? selectedTheaters : undefined,
        }),
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setSubStatus("success");
        setSubMsg(data.message);
        if (data.referralCode) setMyReferralCode(data.referralCode);
      } else {
        setSubStatus("error");
        setSubMsg(data.error || "Something went wrong.");
      }
    } catch {
      setSubStatus("error");
      setSubMsg("Network error. Please try again.");
    }
  };

  // Initialize from URL params or localStorage
  useEffect(() => {
    setMounted(true);
    // Capture inbound referral code from ?ref=
    const searchParams = new URLSearchParams(window.location.search);
    const ref = searchParams.get("ref");
    if (ref && /^[a-f0-9]{8}$/.test(ref)) setInboundRefCode(ref);

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
        const data = status?.theaters?.[slug];
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

  const currentTheaterData = status?.theaters?.[selectedTheater];
  const currentFormatData = currentTheaterData?.formats?.[selectedFormat];

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

      {/* ===== EMAIL SUBSCRIBE — always visible, sticky below hero ===== */}
      <div
        className="email-subscribe-bar"
        data-testid="email-subscribe"
        style={{
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
          padding: "var(--space-base) var(--space-lg)",
          textAlign: "center",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          {subStatus === "success" ? (
            <div>
              <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: "0 0 var(--space-sm)" }}>{subMsg}</p>
              {myReferralCode && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "var(--space-sm)",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "6px 12px",
                    flexWrap: "wrap",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                    Invite friends for priority alerts:
                  </span>
                  <code style={{ fontSize: "var(--text-xs)", color: "var(--text-primary)", fontFamily: "monospace" }}>
                    {typeof window !== "undefined" ? `${window.location.origin}/invite/${myReferralCode}` : `/invite/${myReferralCode}`}
                  </code>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: "var(--text-xs)", padding: "2px 10px" }}
                    onClick={async () => {
                      const url = `${window.location.origin}/invite/${myReferralCode}`;
                      await navigator.clipboard.writeText(url);
                      setReferralCopied(true);
                      setTimeout(() => setReferralCopied(false), 2000);
                    }}
                  >
                    {referralCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <p style={{ margin: "0 0 var(--space-sm)", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }} data-ab-variant={abVariant}>
                {abVariant === "B"
                  ? "Be first in line — get instant IMAX alerts"
                  : "Get notified when tickets drop"}
              </p>
              <form onSubmit={handleSubscribe} style={{ display: "flex", gap: "var(--space-sm)", maxWidth: 480, margin: "0 auto", flexWrap: "wrap", justifyContent: "center" }}>
                <input
                  type="email"
                  value={subEmail}
                  onChange={(e) => setSubEmail(e.target.value)}
                  placeholder={abVariant === "B" ? "Enter your email for instant alerts" : "you@example.com"}
                  required
                  style={{ flex: 1, minWidth: 200 }}
                />
                {subChannel !== "email" && (
                  <input
                    type="tel"
                    value={subPhone}
                    onChange={(e) => setSubPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    required
                    style={{ flex: 1, minWidth: 160 }}
                    data-testid="phone-input"
                  />
                )}
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={subStatus === "loading" || !subEmail || (subChannel !== "email" && !subPhone)}
                >
                  {subStatus === "loading" ? "Subscribing..." : abVariant === "B" ? "Get instant alerts" : "Notify me"}
                </button>
                <div style={{ width: "100%", display: "flex", gap: "var(--space-md)", justifyContent: "center", marginTop: "var(--space-xs)" }}>
                  {(["email", "sms", "both"] as const).map((ch) => (
                    <label key={ch} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--text-xs)", color: "var(--text-secondary)", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="notif-channel"
                        value={ch}
                        checked={subChannel === ch}
                        onChange={() => setSubChannel(ch)}
                        data-testid={`channel-${ch}`}
                      />
                      {ch === "email" ? "Email" : ch === "sms" ? "SMS" : "Email + SMS"}
                    </label>
                  ))}
                </div>
                <div ref={turnstileRef} style={{ width: "100%", display: "flex", justifyContent: "center", marginTop: "var(--space-xs)" }} />
                {subStatus === "error" && (
                  <p style={{ width: "100%", color: "var(--accent)", fontSize: "var(--text-xs)", margin: "var(--space-xs) 0 0" }}>{subMsg}</p>
                )}
              </form>
            </>
          )}
        </div>
      </div>

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
                  onClick={() => setCompareMode(!compareMode)}
                  style={{
                    fontSize: "var(--text-xs)",
                    borderColor: compareMode ? "#FFFFFF" : undefined,
                    background: compareMode ? "#FFFFFF" : undefined,
                    color: compareMode ? "#000000" : undefined,
                  }}
                >
                  {compareMode ? "Card view" : "Compare all"}
                </button>
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

            {/* Social proof + Share */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)", marginBottom: "var(--space-lg)", flexWrap: "wrap" }}>
              {subscriberCount !== null && subscriberCount > 0 && (
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                  <span style={{ color: "var(--text-secondary)", fontWeight: 700 }}>{subscriberCount}</span>{" "}
                  {subscriberCount === 1 ? "person" : "people"} watching for tickets
                </span>
              )}
              <a
                href="/group/new"
                className="btn-ghost"
                style={{ fontSize: "var(--text-xs)", textDecoration: "none" }}
              >
                👥 Plan with friends
              </a>
              <button
                onClick={handleShare}
                className="btn-ghost"
                style={{ fontSize: "var(--text-xs)", marginLeft: "auto", position: "relative" }}
              >
                Share
                {shareMsg && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 6px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "var(--bg-elevated)",
                      color: "var(--text-primary)",
                      padding: "4px 10px",
                      borderRadius: 4,
                      fontSize: 11,
                      whiteSpace: "nowrap",
                      boxShadow: "var(--shadow-md)",
                    }}
                  >
                    {shareMsg}
                  </span>
                )}
              </button>
            </div>

            {compareMode ? (
              <ComparisonGrid
                theaters={status?.theaters}
                theaterList={theaterList}
                dates={selectedDates}
              />
            ) : (
            <>
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

            {/* Not playing here — format key absent for this theater in the API response */}
            {status && !currentFormatData && (
              <div
                data-testid="not-playing-here"
                style={{
                  textAlign: "center",
                  padding: "var(--space-2xl) var(--space-lg)",
                  color: "var(--text-tertiary)",
                }}
              >
                <div style={{ fontSize: 32, marginBottom: "var(--space-base)" }}>🎭</div>
                <div style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "var(--space-sm)" }}>
                  Not playing here
                </div>
                <div style={{ fontSize: "var(--text-sm)", lineHeight: "var(--leading-normal)" }}>
                  {FORMAT_LIST.find((f) => f.tag === selectedFormat)?.label ?? selectedFormat} is not
                  available at this theater.
                </div>
              </div>
            )}

            {/* Date cards grid — only when format exists for this theater */}
            {currentFormatData && (
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
                  result={currentFormatData.dates[date]}
                  index={i}
                />
              ))}
            </div>
            )}
            </>
            )}

            {/* ===== MOVIE INFO SECTION ===== */}
            <div style={{ marginTop: "var(--space-2xl)", display: "flex", flexDirection: "column", gap: "var(--space-2xl)" }}>

              {/* Ratings */}
              <div className="card" style={{ padding: "var(--space-lg)" }}>
                <h3 style={{ margin: "0 0 var(--space-base)", fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
                  Ratings
                </h3>
                <div style={{ display: "flex", gap: "var(--space-xl)", flexWrap: "wrap" }}>
                  {[
                    { source: "IMDb", score: "8.2/10", color: "var(--gold)" },
                    { source: "Rotten Tomatoes", score: "96%", color: "#FA320A" },
                    { source: "Audience Score", score: "92%", color: "#5BABF2" },
                  ].map((r) => (
                    <div key={r.source} style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: r.color, fontVariantNumeric: "tabular-nums" }}>
                        {r.score}
                      </span>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {r.source}
                      </span>
                    </div>
                  ))}
                </div>
                <p style={{ margin: "var(--space-base) 0 0", fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
                  Based on the novel by Andy Weir. Directed by Phil Lord &amp; Christopher Miller.
                  Starring Ryan Gosling.
                </p>
              </div>

            </div>

            {/* ===== NEWS FEED ===== */}
            <NewsSection articles={newsArticles} />

            {/* ===== COMMUNITY REVIEWS ===== */}
            {selectedMovie && <ReviewsSection movieSlug={selectedMovie} />}

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
