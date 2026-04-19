/**
 * Simple in-process rate limiter (no Redis required).
 * For production, swap with express-rate-limit + redis store.
 */
const HttpError = require("../utils/httpError");

class RateLimiter {
  constructor({ windowMs = 60_000, max = 100 } = {}) {
    this.windowMs = windowMs;
    this.max = max;
    this.store = new Map();
  }

  middleware() {
    return (req, res, next) => {
      const key = req.ip || "unknown";
      const now = Date.now();
      const record = this.store.get(key) || { count: 0, resetAt: now + this.windowMs };

      if (now > record.resetAt) {
        record.count = 0;
        record.resetAt = now + this.windowMs;
      }

      record.count += 1;
      this.store.set(key, record);

      res.setHeader("X-RateLimit-Limit", this.max);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, this.max - record.count));
      res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetAt / 1000));

      if (record.count > this.max) {
        throw new HttpError(429, "Too many requests. Please slow down.");
      }

      next();
    };
  }
}

// Global limiter: 200 req/min
const globalLimiter = new RateLimiter({ windowMs: 60_000, max: 200 });

// Auth limiter: 10 req/min (brute-force protection)
const authLimiter = new RateLimiter({ windowMs: 60_000, max: 10 });

module.exports = { globalLimiter, authLimiter };
