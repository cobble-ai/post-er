// Session cookie: "<expiry-ms>.<hmac>" signed with APP_PASSWORD.
// Uses Web Crypto only, so it runs in both the proxy and route handlers.

export const SESSION_COOKIE = "pc_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

const encoder = new TextEncoder();

async function hmac(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function checkPassword(input: string): Promise<boolean> {
  const secret = process.env.APP_PASSWORD;
  if (!secret) return false;
  // Compare HMACs so both sides are the same length.
  const [a, b] = await Promise.all([hmac(input, "pw-check"), hmac(secret, "pw-check")]);
  return safeEqual(a, b);
}

export async function createSessionToken(): Promise<string> {
  const secret = process.env.APP_PASSWORD ?? "";
  const expires = String(Date.now() + SESSION_MAX_AGE * 1000);
  return `${expires}.${await hmac(expires, secret)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  const secret = process.env.APP_PASSWORD;
  if (!token || !secret) return false;
  const [expires, sig] = token.split(".");
  if (!expires || !sig) return false;
  if (!(Number(expires) > Date.now())) return false;
  return safeEqual(sig, await hmac(expires, secret));
}
