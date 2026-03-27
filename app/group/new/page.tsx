"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_DATES = [
  "2026-04-01",
  "2026-04-02",
  "2026-04-03",
  "2026-04-04",
  "2026-04-05",
];

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function NewGroupPage() {
  const router = useRouter();
  const [groupName, setGroupName] = useState("");
  const [hostName, setHostName] = useState("");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const toggleDate = (date: string) => {
    setSelectedDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim()) { setErrorMsg("Group name is required."); return; }
    if (!hostName.trim()) { setErrorMsg("Your name is required."); return; }

    setStatus("loading");
    setErrorMsg("");

    try {
      const resp = await fetch("/api/group/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName.trim(),
          hostName: hostName.trim(),
          movieSlug: "project-hail-mary-76779",
          movieTitle: "Project Hail Mary",
          votedShowtimes: selectedDates,
        }),
      });
      const data = await resp.json() as { success?: boolean; groupId?: string; inviteUrl?: string; error?: string };
      if (resp.ok && data.success && data.groupId) {
        router.push(`/group/${data.groupId}`);
      } else {
        setStatus("error");
        setErrorMsg(data.error ?? "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again.");
    }
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "var(--space-lg)",
    marginBottom: "var(--space-lg)",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: "var(--space-xs)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    color: "var(--text-primary)",
    fontSize: "var(--text-sm)",
    boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", padding: "var(--space-2xl) var(--space-lg)" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
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
          Plan with friends
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: "0 0 var(--space-xl)", lineHeight: "var(--leading-normal)" }}>
          Create a group plan for <strong>Project Hail Mary</strong>. Share the link with your crew — everyone picks their available dates and you find the perfect showtime together.
        </p>

        {errorMsg && (
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
            {errorMsg}
          </div>
        )}

        <div style={cardStyle}>
          <div style={{ marginBottom: "var(--space-md)" }}>
            <label style={labelStyle}>Group name</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Saturday crew, Work team, Family"
              style={inputStyle}
              maxLength={100}
            />
          </div>

          <div>
            <label style={labelStyle}>Your name</label>
            <input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="e.g. Alex"
              style={inputStyle}
              maxLength={80}
            />
          </div>
        </div>

        <div style={cardStyle}>
          <label style={labelStyle}>Your available dates</label>
          <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)", margin: "0 0 var(--space-md)" }}>
            Which opening weekend dates work for you? (optional — you can vote later)
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)" }}>
            {DEFAULT_DATES.map((date) => {
              const selected = selectedDates.includes(date);
              return (
                <button
                  key={date}
                  onClick={() => toggleDate(date)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 4,
                    border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                    background: selected ? "rgba(229, 9, 20, 0.15)" : "var(--bg-base)",
                    color: selected ? "var(--accent)" : "var(--text-secondary)",
                    fontSize: "var(--text-sm)",
                    fontWeight: selected ? 700 : 400,
                    cursor: "pointer",
                  }}
                >
                  {formatDate(date)}
                </button>
              );
            })}
          </div>
          {selectedDates.length > 0 && (
            <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)", marginTop: "var(--space-sm)" }}>
              {selectedDates.length} date{selectedDates.length !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>

        <button
          onClick={handleCreate}
          disabled={status === "loading"}
          style={{
            width: "100%",
            padding: "14px",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: "var(--text-base)",
            fontWeight: 700,
            cursor: status === "loading" ? "not-allowed" : "pointer",
            opacity: status === "loading" ? 0.7 : 1,
          }}
        >
          {status === "loading" ? "Creating group..." : "Create group & get invite link"}
        </button>

        <p style={{ textAlign: "center", fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: "var(--space-lg)" }}>
          After creating, you&apos;ll get a shareable link your friends can use to vote on dates.
        </p>
      </div>
    </div>
  );
}
