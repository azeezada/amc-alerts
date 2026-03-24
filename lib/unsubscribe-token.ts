const SECRET = "amc-alerts-unsub-2026";

async function hmacSha256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function generateUnsubscribeToken(email: string): Promise<string> {
  return hmacSha256(email.toLowerCase().trim(), SECRET);
}

export async function validateUnsubscribeToken(
  email: string,
  token: string
): Promise<boolean> {
  const expected = await generateUnsubscribeToken(email);
  return expected === token;
}
