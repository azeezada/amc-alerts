"use client";

import { useState, useEffect, useCallback } from "react";

interface GroupMember {
  id: number;
  name: string;
  votedShowtimes: string[];
  joinedAt: string;
}

interface GroupData {
  group: {
    id: string;
    name: string;
    hostName: string;
    movieSlug: string;
    movieTitle: string;
    theaterSlugs: string[] | null;
    createdAt: string;
  };
  members: GroupMember[];
  voteCounts: Record<string, number>;
  memberCount: number;
}

// April 2026 opening weekend dates (default)
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

export default function GroupPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [data, setData] = useState<GroupData | null>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  // Vote form state
  const [memberName, setMemberName] = useState("");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [voteStatus, setVoteStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [voteError, setVoteError] = useState("");
  const [hasVoted, setHasVoted] = useState(false);

  const loadGroup = useCallback(async () => {
    try {
      const resp = await fetch(`/api/group/${id}`);
      if (!resp.ok) {
        const err = await resp.json() as { error?: string };
        setErrorMsg(err.error ?? "Failed to load group.");
        setLoadStatus("error");
        return;
      }
      const d = await resp.json() as GroupData;
      setData(d);
      setLoadStatus("loaded");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setLoadStatus("error");
    }
  }, [id]);

  useEffect(() => {
    void loadGroup();
    // Check if already voted (stored in localStorage)
    const voted = localStorage.getItem(`group-voted-${id}`);
    if (voted) {
      setHasVoted(true);
      setMemberName(voted);
    }
  }, [id, loadGroup]);

  const toggleDate = (date: string) => {
    setSelectedDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    );
  };

  const handleVote = async () => {
    if (!memberName.trim()) {
      setVoteError("Please enter your name.");
      return;
    }
    setVoteStatus("loading");
    setVoteError("");
    try {
      const resp = await fetch(`/api/group/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberName: memberName.trim(), votedShowtimes: selectedDates }),
      });
      const result = await resp.json() as { success?: boolean; error?: string };
      if (resp.ok && result.success) {
        localStorage.setItem(`group-voted-${id}`, memberName.trim());
        setHasVoted(true);
        setVoteStatus("done");
        await loadGroup();
      } else {
        setVoteStatus("error");
        setVoteError(result.error ?? "Something went wrong.");
      }
    } catch {
      setVoteStatus("error");
      setVoteError("Network error. Please try again.");
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: data?.group.name ?? "Group plan", url });
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  // ---- Styles ----
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

  if (loadStatus === "loading") {
    return (
      <div style={{ minHeight: "100vh", padding: "var(--space-2xl) var(--space-lg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--text-tertiary)" }}>Loading group...</p>
      </div>
    );
  }

  if (loadStatus === "error") {
    return (
      <div style={{ minHeight: "100vh", padding: "var(--space-2xl) var(--space-lg)" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <p style={{ color: "var(--accent)" }}>{errorMsg}</p>
          <a href="/" style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>Back to home</a>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { group, members, voteCounts, memberCount } = data;
  const availableDates = DEFAULT_DATES;

  // Sort dates by vote count descending
  const sortedDates = [...availableDates].sort(
    (a, b) => (voteCounts[b] ?? 0) - (voteCounts[a] ?? 0)
  );

  const maxVotes = Math.max(...availableDates.map((d) => voteCounts[d] ?? 0), 0);

  return (
    <div style={{ minHeight: "100vh", padding: "var(--space-2xl) var(--space-lg)" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {/* Header badge */}
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

        {/* Group title */}
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 var(--space-xs)", color: "var(--text-primary)" }}>
          {group.name}
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: "0 0 var(--space-xl)", lineHeight: "var(--leading-normal)" }}>
          {group.movieTitle} · Group plan started by <strong>{group.hostName}</strong>
          {" · "}{memberCount} {memberCount === 1 ? "member" : "members"}
        </p>

        {/* Share button */}
        <button
          onClick={handleShare}
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "8px 16px",
            color: "var(--text-secondary)",
            fontSize: "var(--text-sm)",
            cursor: "pointer",
            marginBottom: "var(--space-xl)",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>🔗</span> Share invite link
        </button>

        {/* Date vote results */}
        {memberCount > 0 && (
          <div style={cardStyle}>
            <label style={labelStyle}>Vote results</label>
            <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)", margin: "0 0 var(--space-md)" }}>
              Which dates work for everyone?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              {sortedDates.map((date) => {
                const count = voteCounts[date] ?? 0;
                const pct = memberCount > 0 ? Math.round((count / memberCount) * 100) : 0;
                const isBest = count === maxVotes && maxVotes > 0;
                return (
                  <div key={date}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: "var(--text-sm)", color: isBest ? "var(--accent)" : "var(--text-primary)", fontWeight: isBest ? 700 : 400 }}>
                        {formatDate(date)} {isBest && "⭐"}
                      </span>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                        {count}/{memberCount}
                      </span>
                    </div>
                    <div style={{ height: 6, background: "var(--bg-base)", borderRadius: 3, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: isBest ? "var(--accent)" : "var(--text-tertiary)",
                          borderRadius: 3,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Members list */}
        {members.length > 0 && (
          <div style={cardStyle}>
            <label style={labelStyle}>Who&apos;s in ({members.length})</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
              {members.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "var(--space-xs) 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: 600 }}>
                    {m.name}
                  </span>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                    {m.votedShowtimes.length > 0
                      ? m.votedShowtimes.map(formatDate).join(", ")
                      : "No dates selected"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vote form */}
        <div style={cardStyle}>
          <label style={labelStyle}>
            {hasVoted ? "Update your vote" : "Add your availability"}
          </label>

          {voteStatus === "done" && (
            <div
              style={{
                background: "rgba(34, 197, 94, 0.1)",
                border: "1px solid #22c55e",
                borderRadius: 4,
                padding: "var(--space-md)",
                marginBottom: "var(--space-lg)",
                fontSize: "var(--text-sm)",
                color: "#22c55e",
              }}
            >
              Vote saved! The group can see your availability above.
            </div>
          )}

          {voteError && (
            <div
              style={{
                background: "rgba(227, 24, 55, 0.1)",
                border: "1px solid var(--accent)",
                borderRadius: 4,
                padding: "var(--space-sm)",
                marginBottom: "var(--space-md)",
                fontSize: "var(--text-xs)",
                color: "var(--accent)",
              }}
            >
              {voteError}
            </div>
          )}

          <div style={{ marginBottom: "var(--space-md)" }}>
            <label style={{ ...labelStyle, textTransform: "none", letterSpacing: 0 }}>Your name</label>
            <input
              type="text"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="e.g. Alex"
              disabled={hasVoted && voteStatus !== "idle"}
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--bg-base)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                color: "var(--text-primary)",
                fontSize: "var(--text-sm)",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "var(--space-lg)" }}>
            <label style={{ ...labelStyle, textTransform: "none", letterSpacing: 0 }}>
              Which dates work for you?
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)", marginTop: "var(--space-xs)" }}>
              {availableDates.map((date) => {
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
          </div>

          <button
            onClick={handleVote}
            disabled={voteStatus === "loading"}
            style={{
              width: "100%",
              padding: "12px",
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              cursor: voteStatus === "loading" ? "not-allowed" : "pointer",
              opacity: voteStatus === "loading" ? 0.7 : 1,
            }}
          >
            {voteStatus === "loading" ? "Saving..." : hasVoted ? "Update vote" : "Add my availability"}
          </button>
        </div>

        <p style={{ textAlign: "center", fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: "var(--space-md)" }}>
          Share this link with your group:{" "}
          <strong style={{ color: "var(--text-secondary)" }}>
            {typeof window !== "undefined" ? window.location.href : ""}
          </strong>
        </p>
      </div>
    </div>
  );
}
