"use client";

import { useState, useEffect } from "react";

// NYC theaters for the preferences picker (subset of curated list)
const NYC_THEATERS = [
  { slug: "amc-lincoln-square-13", name: "AMC Lincoln Square 13", neighborhood: "Upper West Side" },
  { slug: "amc-empire-25", name: "AMC Empire 25", neighborhood: "Times Square" },
  { slug: "amc-kips-bay-15", name: "AMC Kips Bay 15", neighborhood: "Kips Bay" },
  { slug: "amc-34th-street-14", name: "AMC 34th Street 14", neighborhood: "Herald Square" },
  { slug: "amc-village-7", name: "AMC Village 7", neighborhood: "Greenwich Village" },
  { slug: "amc-84th-street-6", name: "AMC 84th Street 6", neighborhood: "Upper West Side" },
];

function toDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateNice(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function generateNext30Days(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(toDateStr(d));
  }
  return dates;
}

export default function PreferencesPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [saveStatus, setSaveStatus] = useState<"idle" | "loading" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedTheaters, setSelectedTheaters] = useState<string[]>([]);
  const [allTheaters, setAllTheaters] = useState(false);
  const [notificationChannel, setNotificationChannel] = useState<"email" | "sms" | "both">("email");
  const [phoneNumber, setPhoneNumber] = useState("");
  const availableDates = generateNext30Days();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    const e = params.get("email");
    if (t) setToken(t);
    if (e) setEmail(e);
  }, []);

  useEffect(() => {
    if (!email || !token) return;
    setLoadStatus("loading");
    fetch(`/api/preferences?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data: { error?: string; dates?: string[]; theaterSlugs?: string[] | null; notificationChannel?: string; phoneNumber?: string | null }) => {
        if (data.error) {
          setLoadStatus("error");
          setErrorMsg(data.error);
          return;
        }
        setSelectedDates(data.dates ?? []);
        if (!data.theaterSlugs || data.theaterSlugs.length === 0) {
          setAllTheaters(true);
          setSelectedTheaters([]);
        } else {
          setAllTheaters(false);
          setSelectedTheaters(data.theaterSlugs);
        }
        const ch = data.notificationChannel;
        if (ch === "sms" || ch === "both") setNotificationChannel(ch);
        else setNotificationChannel("email");
        setPhoneNumber(data.phoneNumber ?? "");
        setLoadStatus("loaded");
      })
      .catch(() => {
        setLoadStatus("error");
        setErrorMsg("Network error. Please try again.");
      });
  }, [email, token]);

  const toggleDate = (date: string) => {
    setSelectedDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    );
  };

  const toggleTheater = (slug: string) => {
    setSelectedTheaters((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleSave = async () => {
    setSaveStatus("loading");
    setErrorMsg("");
    try {
      const resp = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          token,
          dates: selectedDates,
          theaterSlugs: allTheaters ? null : selectedTheaters,
          notificationChannel,
          phoneNumber: notificationChannel === "email" ? null : phoneNumber,
        }),
      });
      const data = await resp.json() as { success?: boolean; error?: string };
      if (resp.ok && data.success) {
        setSaveStatus("saved");
      } else {
        setSaveStatus("error");
        setErrorMsg(data.error || "Something went wrong.");
      }
    } catch {
      setSaveStatus("error");
      setErrorMsg("Network error. Please try again.");
    }
  };

  const labelStyle = {
    display: "block",
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: "var(--space-xs)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  };

  return (
    <div style={{ minHeight: "100vh", padding: "var(--space-2xl) var(--space-lg)" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        {/* Logo badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: "var(--accent)",
            padding: "4px 12px",
            borderRadius: 4,
            marginBottom: "var(--space-lg)",
          }}
        >
          <span
            style={{
              color: "#FFFFFF",
              fontSize: "var(--text-xs)",
              fontWeight: 800,
              letterSpacing: "2px",
            }}
          >
            AMC ALERTS
          </span>
        </div>

        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            margin: "0 0 var(--space-sm)",
            color: "var(--text-primary)",
          }}
        >
          Manage Preferences
        </h1>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "var(--text-sm)",
            margin: "0 0 var(--space-xl)",
            lineHeight: "var(--leading-normal)",
          }}
        >
          Update which dates and theaters you want alerts for.
        </p>

        {/* Loading state */}
        {loadStatus === "loading" && (
          <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
            Loading your preferences...
          </p>
        )}

        {/* Error state */}
        {(loadStatus === "error" || saveStatus === "error") && errorMsg && (
          <div
            style={{
              background: "rgba(227, 24, 55, 0.1)",
              border: "1px solid var(--accent)",
              borderRadius: 4,
              padding: "var(--space-md)",
              marginBottom: "var(--space-lg)",
              fontSize: "var(--text-sm)",
              color: "var(--accent)",
            }}
            data-testid="pref-error"
          >
            {errorMsg}
          </div>
        )}

        {/* Preferences form */}
        {loadStatus === "loaded" && (
          <div>
            {/* Token/email display */}
            <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)", marginBottom: "var(--space-lg)" }}>
              Managing preferences for: <strong style={{ color: "var(--text-secondary)" }}>{email}</strong>
            </p>

            {/* Dates section */}
            <div className="card" style={{ padding: "var(--space-lg)", marginBottom: "var(--space-lg)" }}>
              <label style={labelStyle}>Alert dates</label>
              <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)", margin: "0 0 var(--space-md)" }}>
                Select the dates you want to be notified about.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)" }}>
                {availableDates.map((date) => {
                  const selected = selectedDates.includes(date);
                  return (
                    <button
                      key={date}
                      onClick={() => toggleDate(date)}
                      data-testid={`date-toggle-${date}`}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 4,
                        border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                        background: selected ? "rgba(229, 9, 20, 0.15)" : "var(--bg-elevated)",
                        color: selected ? "var(--accent)" : "var(--text-secondary)",
                        fontSize: "var(--text-xs)",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {formatDateNice(date)}
                    </button>
                  );
                })}
              </div>
              <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)", marginTop: "var(--space-sm)" }}>
                {selectedDates.length} date{selectedDates.length !== 1 ? "s" : ""} selected
              </p>
            </div>

            {/* Theaters section */}
            <div className="card" style={{ padding: "var(--space-lg)", marginBottom: "var(--space-xl)" }}>
              <label style={labelStyle}>Theaters</label>
              <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)", margin: "0 0 var(--space-md)" }}>
                Choose specific theaters or get alerts for all.
              </p>

              {/* All theaters toggle */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-sm)",
                  marginBottom: "var(--space-md)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={allTheaters}
                  onChange={(e) => {
                    setAllTheaters(e.target.checked);
                    if (e.target.checked) setSelectedTheaters([]);
                  }}
                  data-testid="all-theaters-toggle"
                />
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: 600 }}>
                  Alert me for all theaters
                </span>
              </label>

              {!allTheaters && (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                  {NYC_THEATERS.map((theater) => {
                    const selected = selectedTheaters.includes(theater.slug);
                    return (
                      <label
                        key={theater.slug}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-sm)",
                          padding: "var(--space-sm) var(--space-md)",
                          borderRadius: 4,
                          background: selected ? "rgba(229, 9, 20, 0.08)" : "var(--bg-elevated)",
                          border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleTheater(theater.slug)}
                          data-testid={`theater-toggle-${theater.slug}`}
                        />
                        <div>
                          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
                            {theater.name}
                          </div>
                          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                            {theater.neighborhood}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notification channel section */}
            <div className="card" style={{ padding: "var(--space-lg)", marginBottom: "var(--space-xl)" }}>
              <label style={labelStyle}>Notification method</label>
              <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)", margin: "0 0 var(--space-md)" }}>
                Choose how you want to receive ticket alerts.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
                {(["email", "sms", "both"] as const).map((ch) => {
                  const labels: Record<string, string> = { email: "Email only", sms: "SMS only", both: "Email + SMS" };
                  const selected = notificationChannel === ch;
                  return (
                    <label
                      key={ch}
                      data-testid={`channel-option-${ch}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-sm)",
                        padding: "var(--space-sm) var(--space-md)",
                        borderRadius: 4,
                        background: selected ? "rgba(229, 9, 20, 0.08)" : "var(--bg-elevated)",
                        border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="notificationChannel"
                        value={ch}
                        checked={selected}
                        onChange={() => setNotificationChannel(ch)}
                        data-testid={`channel-radio-${ch}`}
                      />
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>
                        {labels[ch]}
                      </span>
                    </label>
                  );
                })}
              </div>

              {/* Phone number input — shown when SMS is selected */}
              {(notificationChannel === "sms" || notificationChannel === "both") && (
                <div style={{ marginTop: "var(--space-md)" }}>
                  <label style={{ ...labelStyle, marginBottom: "var(--space-xs)" }}>Phone number</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    data-testid="phone-input"
                    style={{
                      width: "100%",
                      padding: "var(--space-sm) var(--space-md)",
                      borderRadius: 4,
                      border: "1px solid var(--border)",
                      background: "var(--bg-elevated)",
                      color: "var(--text-primary)",
                      fontSize: "var(--text-sm)",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              )}
            </div>

            {/* Save button */}
            {saveStatus === "saved" ? (
              <div>
                <div
                  style={{
                    background: "rgba(34, 197, 94, 0.1)",
                    border: "1px solid #22c55e",
                    borderRadius: 4,
                    padding: "var(--space-md)",
                    marginBottom: "var(--space-lg)",
                    fontSize: "var(--text-sm)",
                    color: "#22c55e",
                    textAlign: "center",
                  }}
                  data-testid="pref-success"
                >
                  Preferences saved! You'll be alerted for your selected dates and theaters.
                </div>
                <div style={{ display: "flex", gap: "var(--space-md)" }}>
                  <button
                    className="btn-ghost"
                    onClick={() => setSaveStatus("idle")}
                    style={{ flex: 1 }}
                  >
                    Edit again
                  </button>
                  <a
                    href="/"
                    className="btn-ghost"
                    style={{ flex: 1, textDecoration: "none", textAlign: "center" }}
                  >
                    Back to home
                  </a>
                </div>
              </div>
            ) : (
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saveStatus === "loading" || selectedDates.length === 0}
                style={{ width: "100%" }}
                data-testid="save-preferences"
              >
                {saveStatus === "loading" ? "Saving..." : "Save Preferences"}
              </button>
            )}

            {/* Unsubscribe link */}
            <p style={{ textAlign: "center", marginTop: "var(--space-xl)", fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
              Want to stop receiving alerts?{" "}
              <a
                href={`/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`}
                style={{ color: "var(--text-secondary)" }}
              >
                Unsubscribe
              </a>
            </p>
          </div>
        )}

        {/* No token state */}
        {loadStatus === "idle" && !token && (
          <div>
            <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
              To manage your preferences, use the link from your alert email.
            </p>
            <a
              href="/"
              className="btn-ghost"
              style={{ textDecoration: "none", display: "inline-block", marginTop: "var(--space-lg)" }}
            >
              Back to home
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
