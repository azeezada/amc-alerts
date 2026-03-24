import { test, expect } from "@playwright/test";

test.describe("API — /api/status", () => {
  test("returns 200 with valid JSON using query params", async ({ request }) => {
    const resp = await request.get(
      "/api/status?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-03"
    );
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty("theaters");
    expect(body).toHaveProperty("checkedAt");
  });

  test("returns requested theater in response", async ({ request }) => {
    const resp = await request.get(
      "/api/status?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-03"
    );
    const body = await resp.json();
    expect(Object.keys(body.theaters || {})).toContain("amc-lincoln-square-13");
  });

  test("each theater has name and formats", async ({ request }) => {
    const resp = await request.get(
      "/api/status?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-03"
    );
    const body = await resp.json();
    for (const [, theater] of Object.entries(body.theaters) as [string, any][]) {
      expect(theater).toHaveProperty("name");
      expect(theater).toHaveProperty("formats");
      expect(typeof theater.formats).toBe("object");
    }
  });

  test("date results have correct shape", async ({ request }) => {
    const resp = await request.get(
      "/api/status?theaters=amc-lincoln-square-13&movie=project-hail-mary-76779&dates=2026-04-03"
    );
    const body = await resp.json();
    const ls = body.theaters["amc-lincoln-square-13"];
    if (ls) {
      for (const [, fmtData] of Object.entries(ls.formats) as [string, any][]) {
        for (const [, dr] of Object.entries((fmtData as any).dates) as [string, any][]) {
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

test.describe("API — /api/theaters", () => {
  test("returns markets list", async ({ request }) => {
    const resp = await request.get("/api/theaters");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.markets).toBeDefined();
    expect(body.markets.length).toBeGreaterThan(0);
  });

  test("returns theaters for a market", async ({ request }) => {
    const resp = await request.get("/api/theaters?market=new-york-city");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.theaters).toBeDefined();
    expect(body.theaters.length).toBeGreaterThan(0);
  });

  test("search by query works", async ({ request }) => {
    const resp = await request.get("/api/theaters?q=lincoln");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.theaters).toBeDefined();
  });
});

test.describe("API — /api/stats", () => {
  test("returns subscriber count", async ({ request }) => {
    const resp = await request.get("/api/stats");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(typeof body.subscribers).toBe("number");
  });
});

test.describe("API — /api/unsubscribe", () => {
  test("rejects missing email/token", async ({ request }) => {
    const resp = await request.post("/api/unsubscribe", {
      data: {},
    });
    expect(resp.status()).toBe(400);
  });

  test("rejects invalid token", async ({ request }) => {
    const resp = await request.post("/api/unsubscribe", {
      data: { email: "test@test.com", token: "invalidtoken123" },
    });
    expect(resp.status()).toBe(403);
  });
});

test.describe("API — /api/movies", () => {
  test("requires theater param", async ({ request }) => {
    const resp = await request.get("/api/movies");
    expect(resp.status()).toBe(400);
  });
});
