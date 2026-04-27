import { getRedis } from "@/lib/redis";
import { createHash } from "node:crypto";

type RateLimitResult =
  | { ok: true; enabled: boolean }
  | { ok: false; enabled: true; message: string; status: 429 };

export async function checkOptionalRateLimit(input: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) return { ok: true, enabled: false };

  try {
    const count = await redis.incr(input.key);
    if (count === 1) await redis.expire(input.key, input.windowSeconds);
    if (count > input.limit) {
      return { ok: false, enabled: true, message: "Too many requests - try again in a bit.", status: 429 };
    }
  } catch {
    return { ok: true, enabled: false };
  }
  return { ok: true, enabled: true };
}

export async function readOptionalJsonCache<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const cached = await redis.get<T>(key);
    return cached ?? null;
  } catch {
    return null;
  }
}

export async function writeOptionalJsonCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch {
    // Cache is optional; never fail the request because Redis is absent or unavailable.
  }
}

export function jsonCacheKey(prefix: string, value: unknown): string {
  const hash = createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);
  return `${prefix}:${hash}`;
}
