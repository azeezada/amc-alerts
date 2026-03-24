"use client";

import { useState, useEffect } from "react";

export default function UnsubscribePage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    const e = params.get("email");
    if (t) setToken(t);
    if (e) setEmail(e);
  }, []);

  const handleUnsubscribe = async () => {
    if (!email || !token) {
      setMessage("Missing email or token. Use the link from your email.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    try {
      const resp = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }),
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setStatus("success");
        setMessage(data.message);
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          padding: "var(--space-2xl)",
          margin: "0 var(--space-lg)",
        }}
      >
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
          Unsubscribe
        </h1>

        {status === "success" ? (
          <div>
            <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: "0 0 var(--space-lg)" }}>
              {message}
            </p>
            <a
              href="/"
              className="btn-ghost"
              style={{ textDecoration: "none", display: "inline-block" }}
            >
              Back to home
            </a>
          </div>
        ) : (
          <div>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "var(--text-sm)",
                margin: "0 0 var(--space-lg)",
                lineHeight: "var(--leading-normal)",
              }}
            >
              Click the button below to stop receiving showtime alerts.
              You can always re-subscribe later.
            </p>

            {!token && (
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
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
            )}

            {token && email && (
              <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)", marginBottom: "var(--space-lg)" }}>
                Unsubscribing: {email}
              </p>
            )}

            {status === "error" && (
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
              >
                {message}
              </div>
            )}

            <button
              className="btn-primary"
              onClick={handleUnsubscribe}
              disabled={status === "loading" || (!email && !token)}
              style={{ width: "100%" }}
            >
              {status === "loading" ? "Unsubscribing..." : "Unsubscribe"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
