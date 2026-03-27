"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { getTheaterBySlug, getMarketForTheater, MARKETS } from "../../../lib/theaters";

export default function TheaterInfoPage() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : Array.isArray(params?.slug) ? params.slug[0] : "";

  const theater = getTheaterBySlug(slug);
  const marketSlug = getMarketForTheater(slug);
  const market = MARKETS.find((m) => m.slug === marketSlug);

  const cardStyle: React.CSSProperties = {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-default, #333333)",
    borderRadius: 8,
    padding: "var(--space-lg)",
    marginBottom: "var(--space-lg)",
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: "var(--text-xs)",
    fontWeight: 700,
    color: "var(--text-tertiary)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "var(--space-sm)",
  };

  if (!theater) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-base)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--space-xl)",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: "var(--space-md)" }}>🎭</div>
          <h1
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: 700,
              marginBottom: "var(--space-sm)",
            }}
          >
            Theater not found
          </h1>
          <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-xl)" }}>
            We don&apos;t have info for that theater slug.
          </p>
          <Link
            href="/"
            style={{
              display: "inline-block",
              background: "var(--accent)",
              color: "#FFFFFF",
              padding: "10px 24px",
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "var(--text-sm)",
            }}
          >
            Back to showtimes
          </Link>
        </div>
      </div>
    );
  }

  const mapsUrl = theater.googleMapsQuery
    ? `https://www.google.com/maps/search/?api=1&query=${theater.googleMapsQuery}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(theater.name + " " + (theater.address ?? ""))}`;

  const showtimesUrl = `/?theaters=${theater.slug}`;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        color: "var(--text-primary)",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "var(--bg-surface, #1A1A1A)",
          borderBottom: "1px solid var(--border-default, #333333)",
          padding: "var(--space-md) var(--space-lg)",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <Link
            href="/"
            style={{
              color: "var(--text-tertiary)",
              textDecoration: "none",
              fontSize: "var(--text-sm)",
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-xs)",
              marginBottom: "var(--space-md)",
            }}
          >
            ← Back to showtimes
          </Link>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-md)", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1
                style={{
                  fontSize: "var(--text-xl)",
                  fontWeight: 700,
                  margin: 0,
                  marginBottom: "var(--space-xs)",
                  lineHeight: "var(--leading-tight)",
                }}
              >
                {theater.name}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flexWrap: "wrap" }}>
                {market && (
                  <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
                    {market.name}, {market.state}
                  </span>
                )}
                <span
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-default, #333333)",
                    borderRadius: 12,
                    padding: "2px 10px",
                    fontSize: "var(--text-xs)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {theater.neighborhood}
                </span>
                {theater.hasImax70mm && (
                  <span
                    style={{
                      background: "#1a1a2e",
                      border: "1px solid #4444aa",
                      borderRadius: 12,
                      padding: "2px 10px",
                      fontSize: "var(--text-xs)",
                      color: "#8888ff",
                      fontWeight: 600,
                    }}
                  >
                    IMAX 70mm
                  </span>
                )}
              </div>
            </div>
            <Link
              href={showtimesUrl}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-xs)",
                background: "var(--accent)",
                color: "#FFFFFF",
                padding: "10px 20px",
                borderRadius: 6,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "var(--text-sm)",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              View showtimes
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "var(--space-xl) var(--space-lg)",
        }}
      >
        {/* Address & Directions */}
        <div style={cardStyle}>
          <div style={sectionLabelStyle}>Location & Directions</div>
          {theater.address && (
            <p
              style={{
                margin: "0 0 var(--space-md) 0",
                fontSize: "var(--text-base)",
                color: "var(--text-primary)",
              }}
            >
              {theater.address}
            </p>
          )}
          {theater.phone && (
            <p
              style={{
                margin: "0 0 var(--space-md) 0",
                fontSize: "var(--text-sm)",
                color: "var(--text-secondary)",
              }}
            >
              {theater.phone}
            </p>
          )}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-xs)",
              background: "#2A2A3A",
              border: "1px solid #444466",
              color: "#8888ff",
              padding: "10px 20px",
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "var(--text-sm)",
            }}
          >
            <span>&#x1F5FA;</span>
            Get Directions on Google Maps
          </a>
        </div>

        {/* Transit Tips */}
        {theater.transitTips && theater.transitTips.length > 0 && (
          <div style={cardStyle}>
            <div style={sectionLabelStyle}>Getting Here by Transit</div>
            <ul
              style={{
                margin: 0,
                paddingLeft: "var(--space-lg)",
                listStyle: "disc",
              }}
            >
              {theater.transitTips.map((tip, i) => (
                <li
                  key={i}
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "var(--text-sm)",
                    marginBottom: i < theater.transitTips!.length - 1 ? "var(--space-sm)" : 0,
                    lineHeight: "var(--leading-normal)",
                  }}
                >
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Parking */}
        {theater.parkingTips && theater.parkingTips.length > 0 && (
          <div style={cardStyle}>
            <div style={sectionLabelStyle}>Parking Tips</div>
            <ul
              style={{
                margin: 0,
                paddingLeft: "var(--space-lg)",
                listStyle: "disc",
              }}
            >
              {theater.parkingTips.map((tip, i) => (
                <li
                  key={i}
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "var(--text-sm)",
                    marginBottom: i < theater.parkingTips!.length - 1 ? "var(--space-sm)" : 0,
                    lineHeight: "var(--leading-normal)",
                  }}
                >
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Amenities */}
        {theater.amenities && theater.amenities.length > 0 && (
          <div style={cardStyle}>
            <div style={sectionLabelStyle}>Theater Amenities</div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--space-sm)",
              }}
            >
              {theater.amenities.map((amenity, i) => (
                <span
                  key={i}
                  style={{
                    background: "var(--bg-base)",
                    border: "1px solid var(--border-default, #333333)",
                    borderRadius: 16,
                    padding: "4px 12px",
                    fontSize: "var(--text-xs)",
                    color: "var(--text-secondary)",
                    fontWeight: 500,
                  }}
                >
                  {amenity}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Back to showtimes CTA */}
        <div
          style={{
            textAlign: "center",
            paddingTop: "var(--space-lg)",
          }}
        >
          <Link
            href={showtimesUrl}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-sm)",
              background: "var(--accent)",
              color: "#FFFFFF",
              padding: "12px 28px",
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: "var(--text-base)",
            }}
          >
            View showtimes at {theater.name}
          </Link>
        </div>
      </div>
    </div>
  );
}
