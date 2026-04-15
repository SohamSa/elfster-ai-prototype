import { Redis } from "@upstash/redis";

let redis: Redis | null | undefined;

function looksLikeRealUpstash(url: string, token: string): boolean {
  const u = url.trim();
  const t = token.trim();
  if (!u.startsWith("https://")) return false;
  // Placeholders copied from .env.example should not instantiate a client
  if (u.includes("....") || u.includes("YOUR_") || u.includes("example")) return false;
  if (t === "..." || t.length < 8) return false;
  try {
    const parsed = new URL(u);
    return parsed.hostname.endsWith(".upstash.io");
  } catch {
    return false;
  }
}

export function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redis = null;
    return null;
  }
  if (!looksLikeRealUpstash(url, token)) {
    redis = null;
    return null;
  }
  redis = new Redis({ url: url.trim(), token: token.trim() });
  return redis;
}
