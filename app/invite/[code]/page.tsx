"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface ReferralInfo {
  valid: boolean;
  referralCode: string;
  referrerEmail?: string;
  movieSlug: string;
  movieTitle: string;
  referralCount: number;
}

export default function InvitePage() {
  const params = useParams();
  const code = params?.code as string;
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!code) return;
    fetch(`/api/referral/${code}`)
      .then((r) => {
        if (r.status === 404 || r.status === 400) {
          setNotFound(true);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) setInfo(data as ReferralInfo);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [code]);

  const handleGetAlerts = () => {
    window.location.href = `/?ref=${code}`;
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: "3px solid var(--border)",
              borderTopColor: "var(--accent)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto",
            }}
          />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 480, width: "100%", padding: "var(--space-2xl)", margin: "0 var(--space-lg)", textAlign: "center" }}>
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
            <span style={{ color: "#fff", fontSize: "var(--text-xs)", fontWeight: 800, letterSpacing: "2px" }}>
              AMC ALERTS
            </span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 var(--space-sm)", color: "var(--text-primary)" }}>
            Invite link not found
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: "0 0 var(--space-xl)" }}>
            This invite link is invalid or has expired.
          </p>
          <a href="/" className="btn-primary" style={{ textDecoration: "none", display: "inline-block" }}>
            Get alerts anyway →
          </a>
        </div>
      </div>
    );
  }

  const movieTitle = info?.movieTitle || "Project Hail Mary";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: 520, width: "100%", padding: "var(--space-2xl)", margin: "0 var(--space-lg)" }}>
        {/* Brand badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: "var(--accent)",
            padding: "4px 12px",
            borderRadius: 4,
            marginBottom: "var(--space-xl)",
          }}
        >
          <span style={{ color: "#fff", fontSize: "var(--text-xs)", fontWeight: 800, letterSpacing: "2px" }}>
            AMC ALERTS
          </span>
        </div>

        {/* Invite heading */}
        <div
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "var(--space-xl)",
            marginBottom: "var(--space-xl)",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              color: "var(--accent)",
              textTransform: "uppercase",
              letterSpacing: "1.5px",
              margin: "0 0 var(--space-sm)",
            }}
          >
            You&apos;re invited
          </p>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "var(--text-primary)",
              margin: "0 0 var(--space-sm)",
              lineHeight: 1.2,
            }}
          >
            Your friend is watching for IMAX tickets
          </h1>
          {info?.referrerEmail && (
            <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", margin: "0 0 var(--space-md)" }}>
              {info.referrerEmail} sent you this invite.
            </p>
          )}
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "var(--text-sm)",
              margin: 0,
              lineHeight: "var(--leading-normal)",
            }}
          >
            Get instant alerts the moment <strong style={{ color: "var(--text-primary)" }}>{movieTitle}</strong> IMAX
            tickets go on sale — before they sell out.
          </p>
        </div>

        {/* Benefits */}
        <div style={{ marginBottom: "var(--space-xl)" }}>
          {[
            "Instant email (and optional SMS) the moment tickets drop",
            "Choose your dates — only get alerted for showtimes you care about",
            "Free — no account required",
          ].map((benefit) => (
            <div
              key={benefit}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "var(--space-sm)",
                marginBottom: "var(--space-sm)",
              }}
            >
              <span
                style={{
                  color: "var(--accent)",
                  fontSize: 16,
                  fontWeight: 800,
                  lineHeight: 1.4,
                  flexShrink: 0,
                }}
              >
                ✓
              </span>
              <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>{benefit}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          className="btn-primary"
          onClick={handleGetAlerts}
          style={{ width: "100%", fontSize: "var(--text-base)", padding: "14px 24px" }}
        >
          Get IMAX ticket alerts →
        </button>

        <p
          style={{
            textAlign: "center",
            color: "var(--text-tertiary)",
            fontSize: "var(--text-xs)",
            margin: "var(--space-md) 0 0",
          }}
        >
          Unsubscribe anytime. No spam.
        </p>
      </div>
    </div>
  );
}
