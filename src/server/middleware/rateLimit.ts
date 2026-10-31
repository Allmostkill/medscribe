import express from "express";
import { getClientIp } from "../clientIp";

// ── Simple in-memory rate limiter ────────────────────────────────────────────
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
let rateLimitBuckets = 0;

export function rateLimit(maxRequests: number, windowMs: number) {
  // У каждого лимитера собственный счётчик. Раньше ключом был только IP, из-за
  // чего все ограничения делили одну запись, а окно задавал тот лимитер, что
  // создал её первым: лимитер с коротким окном пересоздавал запись, и
  // 15-минутная защита /api/auth/login от перебора пароля обнулялась вместе с ней.
  const bucket = `${++rateLimitBuckets}:`;
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = bucket + getClientIp(req);
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > maxRequests) {
      return res.status(429).json({ error: "Слишком много запросов. Попробуйте позже." });
    }
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);
