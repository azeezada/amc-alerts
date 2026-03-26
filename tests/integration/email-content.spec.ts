/**
 * Layer 2: Integration Tests — Email Content (Bug Fix Verification)
 *
 * Verifies that email functions use dynamic movie/theater context
 * and no longer hardcode "Project Hail Mary" or "AMC Lincoln Square 13".
 */
import { describe, it, expect } from "vitest";
import { buildEmailHtml, buildEmailText } from "@/lib/email";
import type { DateResult } from "@/lib/scraper";

const sampleDates: DateResult[] = [
  {
    date: "2026-05-15",
    available: true,
    showtimes: [
      { id: "999001", time: "7:00", amPm: "PM", status: "Sellable", url: "https://www.amctheatres.com/showtimes/999001" },
      { id: "999002", time: "10:30", amPm: "PM", status: "AlmostFull", url: "https://www.amctheatres.com/showtimes/999002" },
    ],
  },
];

describe("2.8 Email Content — Dynamic Movie/Theater", () => {
  it("HTML email includes provided movie title", () => {
    const html = buildEmailHtml(sampleDates, undefined, undefined, "Mission: Impossible", "AMC Empire 25");
    expect(html).toContain("Mission: Impossible");
  });

  it("HTML email includes provided theater name", () => {
    const html = buildEmailHtml(sampleDates, undefined, undefined, "Mission: Impossible", "AMC Empire 25");
    expect(html).toContain("AMC Empire 25");
  });

  it("HTML email does NOT contain old hardcoded movie title when different movie provided", () => {
    const html = buildEmailHtml(sampleDates, undefined, undefined, "Mission: Impossible", "AMC Empire 25");
    expect(html).not.toContain("Project Hail Mary");
  });

  it("HTML email does NOT contain old hardcoded theater when different theater provided", () => {
    const html = buildEmailHtml(sampleDates, undefined, undefined, "Mission: Impossible", "AMC Empire 25");
    expect(html).not.toContain("AMC Lincoln Square 13");
  });

  it("plain text email includes provided movie title", () => {
    const text = buildEmailText(sampleDates, "Mission: Impossible", "AMC Empire 25");
    expect(text).toContain("Mission: Impossible");
  });

  it("plain text email includes provided theater name", () => {
    const text = buildEmailText(sampleDates, "Mission: Impossible", "AMC Empire 25");
    expect(text).toContain("AMC Empire 25");
  });

  it("both HTML and text include showtime data", () => {
    const html = buildEmailHtml(sampleDates, undefined, undefined, "Test Movie", "Test Theater");
    const text = buildEmailText(sampleDates, "Test Movie", "Test Theater");

    expect(html).toContain("7:00");
    expect(html).toContain("PM");
    expect(text).toContain("7:00 PM");
  });

  it("unsubscribe link included when token and email provided", () => {
    const html = buildEmailHtml(sampleDates, "tok123", "user@example.com");
    expect(html).toContain("tok123");
    expect(html).toContain("user%40example.com");
    expect(html).toContain("Unsubscribe");
  });

  it("no unsubscribe link when token not provided", () => {
    const html = buildEmailHtml(sampleDates);
    expect(html).not.toContain("Unsubscribe");
  });

  it("date count in alert banner is correct", () => {
    const html = buildEmailHtml(sampleDates);
    expect(html).toContain("1 date");

    const multiHtml = buildEmailHtml([sampleDates[0], sampleDates[0]]);
    expect(multiHtml).toContain("2 dates");
  });
});
