import { test, expect } from "@playwright/test";

test.describe("API — /api/status", () => {
  test("returns 200 with valid JSON", async ({ request }) => {
    const resp = await request.get("/api/status");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty("theaters");
    expect(body).toHaveProperty("checkedAt");
  });

  test("returns all 3 theaters", async ({ request }) => {
    const resp = await request.get("/api/status");
    const body = await resp.json();
    const slugs = Object.keys(body.theaters || {});
    expect(slugs).toContain("amc-lincoln-square-13");
    expect(slugs).toContain("amc-empire-25");
    expect(slugs).toContain("amc-kips-bay-15");
  });

  test("each theater has name and formats", async ({ request }) => {
    const resp = await request.get("/api/status");
    const body = await resp.json();
    for (const [, theater] of Object.entries(body.theaters) as [string, any][]) {
      expect(theater).toHaveProperty("name");
      expect(theater).toHaveProperty("formats");
      expect(typeof theater.formats).toBe("object");
    }
  });

  test("each format has 5 dates", async ({ request }) => {
    const resp = await request.get("/api/status");
    const body = await resp.json();
    const ls = body.theaters["amc-lincoln-square-13"];
    if (ls) {
      for (const [, fmtData] of Object.entries(ls.formats) as [string, any][]) {
        const dates = Object.keys(fmtData.dates);
        expect(dates.length).toBe(5);
      }
    }
  });

  test("date results have correct shape", async ({ request }) => {
    const resp = await request.get("/api/status");
    const body = await resp.json();
    const ls = body.theaters["amc-lincoln-square-13"];
    if (ls) {
      const imax70 = ls.formats["imax70mm"];
      if (imax70) {
        for (const [, dr] of Object.entries(imax70.dates) as [string, any][]) {
          expect(dr).toHaveProperty("date");
          expect(dr).toHaveProperty("available");
          expect(dr).toHaveProperty("showtimes");
          expect(Array.isArray(dr.showtimes)).toBe(true);
        }
      }
    }
  });
});

test.describe("API — /api/subscribe", () => {
  test("rejects empty body", async ({ request }) => {
    const resp = await request.post("/api/subscribe", {
      data: {},
      headers: { "Content-Type": "application/json" },
    });
    expect(resp.status()).toBe(400);
  });

  test("rejects empty email", async ({ request }) => {
    const resp = await request.post("/api/subscribe", {
      data: { email: "", dates: ["2026-04-01"] },
    });
    expect(resp.status()).toBe(400);
  });

  test("rejects invalid email", async ({ request }) => {
    const resp = await request.post("/api/subscribe", {
      data: { email: "notanemail", dates: ["2026-04-01"] },
    });
    expect(resp.status()).toBe(400);
  });

  test("rejects invalid dates", async ({ request }) => {
    const resp = await request.post("/api/subscribe", {
      data: { email: "test@example.com", dates: ["2099-01-01"] },
    });
    expect(resp.status()).toBe(400);
  });

  test("accepts valid email with valid dates", async ({ request }) => {
    const resp = await request.post("/api/subscribe", {
      data: { email: "test@example.com", dates: ["2026-04-01", "2026-04-03"] },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
  });

  test("accepts valid email with all dates (empty array)", async ({ request }) => {
    const resp = await request.post("/api/subscribe", {
      data: { email: "all@example.com", dates: [] },
    });
    // Empty dates should default to all valid dates
    expect(resp.status()).toBe(200);
  });
});

test.describe("API — /api/check", () => {
  test("GET without secret returns 401", async ({ request }) => {
    const resp = await request.get("/api/check");
    expect(resp.status()).toBe(401);
  });

  test("GET with correct secret works", async ({ request }) => {
    const resp = await request.get("/api/check?secret=hailmary");
    expect([200, 500]).toContain(resp.status());
    const body = await resp.json();
    expect(body).toHaveProperty("log");
  });
});
