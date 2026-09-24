/**
 * Token-bucket rate limiter for the hot AI/crawl/upload routes.
 * In-memory per isolate — on serverless this means per warm instance; good
 * enough to absorb accidental abuse and costless to keep. Documented as a
 * soft control; move to Upstash/Redis for hard multi-region limiting.
 */

const buckets = new Map(); // key → { tokens, ts }

/** Fixed-window refill token bucket. Returns { ok, retryAfterSec }. */
export function rateLimit(key, { capacity, windowMs }) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.ts > windowMs) {
    b = { tokens: capacity - 1, ts: now };
    buckets.set(key, b);
    return { ok: true, retryAfterSec: 0 };
  }
  if (b.tokens <= 0) {
    return { ok: false, retryAfterSec: Math.ceil((b.ts + windowMs - now) / 1000) };
  }
  b.tokens -= 1;
  return { ok: true, retryAfterSec: 0 };
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'anon';
}

/** One-liner gate for API handlers — 429 with Retry-After when exceeded. */
export function enforceRateLimit(req, res, tag, budget, windowMs) {
  const verdict = rateLimit(`${tag}:${clientIp(req)}`, { capacity: budget, windowMs });
  if (!verdict.ok) {
    res.setHeader('Retry-After', String(verdict.retryAfterSec));
    res.status(429).json({ error: `Too many requests — try again in ${verdict.retryAfterSec}s.` });
    return false;
  }
  return true;
}

/** Magic-byte sniffing — never trust the client-stated MIME. */
export function sniffImageMime(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf.slice(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (buf.slice(0, 6).toString('latin1') === 'GIF87a' || buf.slice(0, 6).toString('latin1') === 'GIF89a') return 'image/gif';
  if (buf.slice(4, 8).toString('latin1') === 'ftyp' && buf.slice(8, 12).toString('latin1') === 'avif') return 'image/avif';
  return null;
}
