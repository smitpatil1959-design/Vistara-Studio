/**
 * Vistara Studio — crawler security layer.
 *
 * Hardened SSRF & network defense layer.
 * Every user-submitted URL is treated as untrusted input.
 *
 * Protections:
 *   1. Strict protocol allowlist: only http: and https: (rejects file:, ftp:, javascript:, data:, about:)
 *   2. Strict port protection: only standard web ports (80/443); rejects internal ports
 *   3. Credential stripping & rejection (no username/password embedded in URLs)
 *   4. Hostname & TLD blocklist (localhost, metadata endpoints, .local, .internal, .lan, .corp, etc.)
 *   5. Full IPv4 and IPv6 private/reserved/loopback/link-local/ULA/CGNAT range blocking
 *   6. DNS resolution verification before any connection
 *   7. DNS Rebinding protection: socket connection-level DNS hook (undici Agent) checks resolved IPs
 *   8. Redirect chain validation: every single 3xx hop is re-validated against SSRF blocklist
 *   9. Streaming response size cap (maxResponseBytes / maxHtmlBytes): streams are cancelled immediately
 *      once byte limit is reached (DoS / memory exhaustion defense)
 *  10. Content-Type inspection: rejects execution of binary / arbitrary executable files
 *  11. Clean security logging: logs security block events without exposing sensitive queries or secrets
 */

import dns from 'node:dns';
import net from 'node:net';
import { Agent } from 'undici';

export const CRAWL_LIMITS = {
  pageLimit: 5, // max documents captured per scan
  navTimeoutMs: 12000, // per-navigation timeout
  hopTimeoutMs: 8000, // per redirect-probe timeout
  redirectLimit: 5, // max 3xx hops followed
  totalBudgetMs: 45000, // whole-scan hard budget
  maxHtmlBytes: 4 * 1024 * 1024, // HTML parsing cap per document (4MB)
  maxScreenshotBytes: 1_200_000, // re-encode above this
  maxConsoleEntries: 40,
  maxFailedRequests: 40,
  maxResponseBytes: parseInt(process.env.MAX_RESPONSE_BYTES || String(4 * 1024 * 1024), 10),
};

export const REALISTIC_BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const REALISTIC_BROWSER_HEADERS = {
  'User-Agent': REALISTIC_BROWSER_UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

export const BOT_UA = REALISTIC_BROWSER_UA;
export const UA_HEADERS = REALISTIC_BROWSER_HEADERS;

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'metadata.internal',
  'metadata.azure.com',
  'instance-data',
  'instance-data.ec2.internal',
  'kubernetes',
  'kubernetes.default',
  'kubernetes.default.svc',
  'kubernetes.default.svc.cluster.local',
  'broadcasthost',
  'loopback',
  '0.0.0.0',
  '127.0.0.1',
  '169.254.169.254',
  '100.100.100.200',
  '::1',
  '[::1]',
]);

const BLOCKED_SUFFIXES = [
  '.local',
  '.internal',
  '.localhost',
  '.lan',
  '.corp',
  '.home.arpa',
  '.localdomain',
  '.intranet',
  '.onion',
  '.test',
  '.invalid',
  '.example',
];

/**
 * Sanitize a URL for logging: keeps protocol, host, and pathname,
 * but strips search queries, hash fragments, and credentials.
 */
export function sanitizeUrlForLog(rawUrl) {
  if (!rawUrl) return '';
  try {
    const u = new URL(rawUrl);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return String(rawUrl).split('?')[0].split('#')[0].slice(0, 100);
  }
}

/**
 * Audit security logger.
 * Never logs API keys, passwords, cookies, or authorization tokens.
 */
export function logSecurityEvent(reason, details = {}) {
  const safe = {};
  for (const [k, v] of Object.entries(details)) {
    if (k.toLowerCase().includes('url')) safe[k] = sanitizeUrlForLog(v);
    else if (typeof v === 'string') safe[k] = v.slice(0, 120);
    else safe[k] = v;
  }
  console.warn(`[SECURITY] ${reason}:`, JSON.stringify(safe));
}

/** Detects if page content or status represents an anti-bot challenge or Cloudflare screen. */
export function detectBotChallenge(html = '', status = 200, title = '') {
  const sample = (title + ' ' + (html || '').slice(0, 20000)).toLowerCase();
  if (
    sample.includes('just a moment...') ||
    sample.includes('attention required! | cloudflare') ||
    sample.includes('checking your browser before accessing') ||
    sample.includes('verify you are human') ||
    sample.includes('access to this page has been denied') ||
    sample.includes('cf-browser-verification') ||
    sample.includes('challenge-running') ||
    sample.includes('cf-turnstile') ||
    (status === 403 && (sample.includes('cloudflare') || sample.includes('ddos-guard') || sample.includes('incapsula') || sample.includes('access denied'))) ||
    (status === 429 && sample.includes('too many requests'))
  ) {
    return true;
  }
  return false;
}

/**
 * true when an IPv4 dotted-quad is loopback/private/link-local/reserved.
 * Precise prefixes only — public special-purpose space (e.g. iana.org at
 * 192.0.43.8) must NOT be blocked.
 */
export function isPrivateIPv4(ip) {
  if (typeof ip !== 'string') return true;
  const clean = ip.trim();
  const parts = clean.split('.').map((n) => parseInt(n, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true; // malformed → block
  const [a, b, c] = parts;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // 10.0.0.0/8 RFC1918
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (incl. 169.254.169.254 cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 RFC1918
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 RFC1918
  if (a === 192 && b === 0 && c === 2) return true; // 192.0.2.0/24 TEST-NET-1
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24 IETF protocol assignments
  if (a === 192 && b === 88 && c === 99) return true; // 192.88.99.0/24 6to4 relay anycast
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 TEST-NET-3
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT (incl. 100.100.100.200 cloud metadata)
  if (a >= 224 && a <= 239) return true; // 224.0.0.0/4 multicast
  if (a >= 240) return true; // 240.0.0.0/4 reserved & 255.255.255.255 broadcast
  return false;
}

/** true when an IPv6 literal (with or without brackets) is non-public. */
export function isPrivateIPv6(ip) {
  if (typeof ip !== 'string') return true;
  let s = ip.toLowerCase().replace(/^\[|\]$/g, '').trim();
  if (s === '::' || s === '::1' || s === '0::' || s === '0::1') return true;

  // IPv4-mapped IPv6 (::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (s.startsWith('::ffff:')) {
    const tail = s.slice(7);
    if (tail.includes('.')) return isPrivateIPv4(tail);
    const hexParts = tail.split(':');
    if (hexParts.length === 2) {
      const h1 = parseInt(hexParts[0], 16);
      const h2 = parseInt(hexParts[1], 16);
      if (!Number.isNaN(h1) && !Number.isNaN(h2)) {
        const v4 = `${(h1 >> 8) & 0xff}.${h1 & 0xff}.${(h2 >> 8) & 0xff}.${h2 & 0xff}`;
        return isPrivateIPv4(v4);
      }
    }
    return true; // malformed mapped IPv6 → block
  }

  // fe80::/10 link-local unicast (fe80:: to febf::)
  if (/^fe[89ab]/i.test(s)) return true;

  // fc00::/7 unique local unicast (ULA) (fc00:: to fdff::)
  if (/^f[cd]/i.test(s)) return true;

  // 2001:db8::/32 documentation
  if (s.startsWith('2001:db8') || s.startsWith('2001:0db8')) return true;

  // 64:ff9b::/96 translation
  if (s.startsWith('64:ff9b')) return true;

  // 100::/64 discard
  if (s.startsWith('100:')) return true;

  // 2002::/16 6to4
  if (s.startsWith('2002:')) return true;

  // ff00::/8 multicast
  if (s.startsWith('ff')) return true;

  return false;
}

/** Check if an IP (IPv4, IPv6, integer or hex notation) is private. */
export function isPrivateIP(ip) {
  if (typeof ip !== 'string') return true;
  const clean = ip.replace(/^\[|\]$/g, '').trim();
  const v = net.isIP(clean);
  if (v === 4) return isPrivateIPv4(clean);
  if (v === 6) return isPrivateIPv6(clean);

  // Decimal / hex integer format (e.g. 2130706433 or 0x7f000001)
  if (/^\d+$/.test(clean) || /^0x[0-9a-f]+$/i.test(clean)) {
    const num = Number(clean);
    if (!Number.isNaN(num) && num >= 0 && num <= 0xffffffff) {
      const v4 = `${(num >>> 24) & 0xff}.${(num >>> 16) & 0xff}.${(num >>> 8) & 0xff}.${num & 0xff}`;
      return isPrivateIPv4(v4);
    }
  }

  return true; // Unknown/malformed IP → block
}

export function hostnameBlockedByName(hostname) {
  if (!hostname || typeof hostname !== 'string') return true;
  const h = hostname.toLowerCase().trim().replace(/\.+$/, '');
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (BLOCKED_SUFFIXES.some((s) => h.endsWith(s))) return true;

  if (net.isIP(h) !== 0) {
    return isPrivateIP(h);
  }

  if (/^\d+$/.test(h) || /^0x[0-9a-f]+$/i.test(h)) {
    return isPrivateIP(h);
  }

  if (h.startsWith('[') && h.endsWith(']')) {
    return isPrivateIPv6(h);
  }

  return false;
}

export class CrawlBlockedError extends Error {
  constructor(reason, extra = {}) {
    const msg = typeof reason === 'string' ? reason : (reason && reason.message) || 'Crawl error';
    super(msg);
    this.name = 'CrawlBlockedError';
    this.code = typeof reason === 'string' ? reason : (reason && reason.code) || 'UNKNOWN_CRAWL_ERROR';
    this.httpStatus = extra.httpStatus || (typeof reason === 'object' ? reason.httpStatus : null) || null;
    this.url = extra.url || null;
    this.finalUrl = extra.finalUrl || null;
    this.stage = extra.stage || 'crawl';
    this.retryable = extra.retryable ?? true;
    this.details = extra.details || null;
  }

  toStructured() {
    let errorCode = this.code;
    let message = this.message;
    let retryable = this.retryable;

    switch (this.code) {
      case 'blocked-host':
        errorCode = 'CRAWL_BLOCKED';
        message = 'That address is not crawlable — localhost, private networks and cloud metadata endpoints are blocked for safety.';
        retryable = false;
        break;
      case 'protocol':
        errorCode = 'INVALID_URL';
        message = 'Only http and https websites can be analyzed.';
        retryable = false;
        break;
      case 'port':
        errorCode = 'INVALID_URL';
        message = 'Only standard web ports (80/443) are allowed.';
        retryable = false;
        break;
      case 'dns':
        errorCode = 'DNS_ERROR';
        message = 'DNS lookup failed — check that the domain name is spelled correctly and resolves publicly.';
        retryable = true;
        break;
      case 'tls':
        errorCode = 'TLS_ERROR';
        message = 'TLS/SSL handshake failed while establishing a secure connection to the website.';
        retryable = true;
        break;
      case 'redirect-loop':
        errorCode = 'CRAWL_BLOCKED';
        message = 'The site redirects in a loop or exceeded the maximum safe hop limit.';
        retryable = false;
        break;
      case 'timeout':
        errorCode = 'CRAWL_TIMEOUT';
        message = 'The target website took too long to respond within the allowed time limit.';
        retryable = true;
        break;
      case 'bot-challenge':
      case 'challenge':
        errorCode = 'CRAWL_BLOCKED';
        message = 'The website returned an automated browser challenge or bot protection (e.g. Cloudflare) and could not be analyzed.';
        retryable = false;
        break;
      case 'http-401':
      case '401':
        errorCode = 'HTTP_401';
        message = 'The website requires authentication credentials to view.';
        retryable = false;
        break;
      case 'http-403':
      case '403':
        errorCode = 'HTTP_403';
        message = 'The website returned an HTTP 403 Forbidden response to automated requests.';
        retryable = false;
        break;
      case 'http-429':
      case '429':
        errorCode = 'HTTP_429';
        message = 'The website returned HTTP 429 Too Many Requests (rate-limited).';
        retryable = true;
        break;
      case 'http-5xx':
        errorCode = 'HTTP_5XX';
        message = `The target web server returned an error (HTTP ${this.httpStatus || 500}).`;
        retryable = true;
        break;
      case 'empty':
        errorCode = 'EMPTY_PAGE';
        message = 'The website returned an empty or un-renderable response without readable text content.';
        retryable = true;
        break;
      case 'invalid-url':
        errorCode = 'INVALID_URL';
        message = 'The provided URL is not a valid web address.';
        retryable = false;
        break;
      case 'browser':
        errorCode = 'BROWSER_ERROR';
        message = 'The browser engine encountered an issue while rendering the page.';
        retryable = true;
        break;
      default:
        if (!errorCode || errorCode === 'unreachable') {
          errorCode = 'UNKNOWN_CRAWL_ERROR';
          message = 'We could not reach the target website. Check the address and try again.';
        }
        break;
    }

    return {
      success: false,
      errorCode,
      message,
      url: this.url,
      finalUrl: this.finalUrl || this.url,
      httpStatus: this.httpStatus,
      stage: this.stage,
      retryable,
      details: this.details,
    };
  }
}

function withTimeout(promise, ms, code) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new CrawlBlockedError(code)), ms))]);
}

/**
 * Validates a URL for crawling: protocol, port, credentials, hostname
 * heuristics, and full DNS resolution with per-address range checks.
 */
export async function validateTarget(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch {
    throw new CrawlBlockedError('invalid-url');
  }

  // 1. Protocol validation: ONLY http: and https:
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    logSecurityEvent('Blocked non-http protocol', { protocol: parsed.protocol, url: rawUrl });
    throw new CrawlBlockedError('protocol');
  }

  // 2. Credentials check: reject embedded credentials
  if (parsed.username || parsed.password) {
    logSecurityEvent('Blocked credentials in URL', { url: rawUrl });
    throw new CrawlBlockedError('blocked-host');
  }

  const host = parsed.hostname.toLowerCase().trim().replace(/\.+$/, '');
  if (!host) throw new CrawlBlockedError('invalid-url');

  // 3. Check hostname/IP blocklist BEFORE port check so internal targets on any port are blocked as blocked-host
  if (hostnameBlockedByName(host)) {
    logSecurityEvent('Blocked restricted host', { host, url: rawUrl });
    throw new CrawlBlockedError('blocked-host');
  }

  // 4. Port protection: ONLY standard web ports 80 and 443
  const port = parsed.port ? Number(parsed.port) : (parsed.protocol === 'https:' ? 443 : 80);
  if (port !== 80 && port !== 443) {
    logSecurityEvent('Blocked non-standard port', { port, host });
    throw new CrawlBlockedError('port');
  }

  // 5. DNS resolution & IP range check
  let addresses = [];
  if (net.isIP(host) !== 0) {
    if (isPrivateIP(host)) {
      logSecurityEvent('Blocked private IP literal', { host });
      throw new CrawlBlockedError('blocked-host');
    }
    addresses = [{ address: host, family: net.isIP(host) }];
  } else {
    try {
      addresses = await withTimeout(
        dns.promises.lookup(host, { all: true, verbatim: true }),
        6000,
        'dns'
      );
    } catch (err) {
      if (err instanceof CrawlBlockedError) throw err;
      throw new CrawlBlockedError('dns');
    }

    if (!addresses || addresses.length === 0) throw new CrawlBlockedError('dns');

    for (const addr of addresses) {
      if (addr.family === 4 && isPrivateIPv4(addr.address)) {
        logSecurityEvent('DNS resolved to private IPv4', { host, ip: addr.address });
        throw new CrawlBlockedError('blocked-host');
      }
      if (addr.family === 6 && isPrivateIPv6(addr.address)) {
        logSecurityEvent('DNS resolved to private IPv6', { host, ip: addr.address });
        throw new CrawlBlockedError('blocked-host');
      }
    }
  }

  return { url: parsed.toString(), host, port, addresses };
}

/**
 * Creates an undici Agent with connection-time DNS hook.
 * Blocks DNS rebinding attacks at the exact moment the TCP connection is initiated.
 */
export function createSafeDispatcher(options = {}) {
  return new Agent({
    connectTimeout: options.connectTimeout || 8000,
    headersTimeout: options.headersTimeout || 8000,
    bodyTimeout: options.bodyTimeout || 12000,
    connect: {
      lookup: (hostname, lookupOpts, callback) => {
        const cleanHost = String(hostname).toLowerCase().trim().replace(/\.+$/, '');
        if (hostnameBlockedByName(cleanHost)) {
          logSecurityEvent('Dispatcher blocked host', { host: cleanHost });
          return callback(new CrawlBlockedError('blocked-host'));
        }

        if (net.isIP(cleanHost) !== 0) {
          if (isPrivateIP(cleanHost)) {
            logSecurityEvent('Dispatcher blocked private IP', { ip: cleanHost });
            return callback(new CrawlBlockedError('blocked-host'));
          }
          return callback(null, [{ address: cleanHost, family: net.isIP(cleanHost) }]);
        }

        dns.lookup(cleanHost, { all: true, verbatim: true }, (err, addresses) => {
          if (err) return callback(err);
          if (!addresses || addresses.length === 0) {
            return callback(new CrawlBlockedError('dns'));
          }

          const safe = [];
          for (const addr of addresses) {
            if (addr.family === 4 && isPrivateIPv4(addr.address)) {
              logSecurityEvent('Dispatcher blocked private IPv4 resolution', { host: cleanHost, ip: addr.address });
              return callback(new CrawlBlockedError('blocked-host'));
            }
            if (addr.family === 6 && isPrivateIPv6(addr.address)) {
              logSecurityEvent('Dispatcher blocked private IPv6 resolution', { host: cleanHost, ip: addr.address });
              return callback(new CrawlBlockedError('blocked-host'));
            }
            safe.push(addr);
          }

          if (safe.length === 0) {
            return callback(new CrawlBlockedError('blocked-host'));
          }

          callback(null, safe);
        });
      },
    },
  });
}

export const safeDispatcher = createSafeDispatcher();

/**
 * Checks whether a Content-Type is safe for crawling (HTML, text, JSON, XML)
 * and rejects binary media / executables (PDF, zip, video, audio, exe, tar, octet-stream).
 */
export function isSafeHtmlOrTextContentType(contentTypeHeader) {
  if (!contentTypeHeader) return true;
  const mimeType = contentTypeHeader.toLowerCase().split(';')[0].trim();
  if (/(image|video|audio|pdf|zip|tar|gzip|octet-stream|x-executable|msdownload|application\/x-)/i.test(mimeType)) {
    return false;
  }
  return true;
}

/**
 * Streams the response body up to maxBytes, then cancels the stream.
 * Prevents memory exhaustion attacks from streaming responses.
 */
export async function readCappedBody(res, maxBytes = CRAWL_LIMITS.maxHtmlBytes) {
  if (!res || !res.body) {
    return { html: '', byteLength: 0, capped: false, binary: false };
  }

  // Verify content-type header
  const contentTypeHeader = (res.headers && typeof res.headers.get === 'function' ? res.headers.get('content-type') || '' : '').toLowerCase();
  const mimeType = contentTypeHeader.split(';')[0].trim();

  // Reject executable or binary media types (PDF, zip, video, audio, exe, tar)
  if (!isSafeHtmlOrTextContentType(contentTypeHeader)) {
    logSecurityEvent('Skipped binary content-type', { mimeType });
    try { await res.body.cancel(); } catch { /* ignore */ }
    return { html: '', byteLength: 0, capped: false, binary: true };
  }

  const reader = res.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  let capped = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.length;
        if (totalBytes > maxBytes) {
          const keepBytes = value.length - (totalBytes - maxBytes);
          if (keepBytes > 0) {
            chunks.push(value.subarray(0, keepBytes));
          }
          capped = true;
          // Immediately cancel the stream so server stops sending bytes
          await reader.cancel('MAX_RESPONSE_BYTES_EXCEEDED').catch(() => {});
          break;
        }
        chunks.push(value);
      }
    }
  } catch {
    // Stream closed or cancelled
  }

  const buf = Buffer.concat(chunks);
  const html = buf.toString('utf8');
  return { html, byteLength: totalBytes, capped, binary: false };
}

/**
 * Walks a URL by hand: every redirect hop is DNS-validated before it is
 * followed. Returns the hop log, the validated final URL, and — when the
 * final hop is a document — its (size-capped) body and headers.
 * The browser crawler uses { chain, finalUrl }; the document fallback also
 * reuses the already-validated response without a second request.
 */
export async function fetchValidated(rawUrl, limits = CRAWL_LIMITS) {
  const start = Date.now();
  const chain = [];
  let current = rawUrl;

  for (let hop = 0; hop <= limits.redirectLimit; hop++) {
    const { url } = await validateTarget(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), limits.hopTimeoutMs);
    let res;
    try {
      res = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: UA_HEADERS,
        dispatcher: safeDispatcher,
      });
    } catch (e) {
      if (e instanceof CrawlBlockedError) throw e;
      if (e?.cause instanceof CrawlBlockedError) throw e.cause;
      if (e?.message?.includes('blocked') || e?.cause?.message?.includes('blocked')) {
        throw new CrawlBlockedError('blocked-host');
      }
      throw new CrawlBlockedError(e && e.name === 'AbortError' ? 'timeout' : 'unreachable');
    } finally {
      clearTimeout(timer);
    }

    const location = res.headers.get('location');
    const isRedirect = [301, 302, 303, 307, 308].includes(res.status) && !!location;
    chain.push({ url, status: res.status, to: isRedirect ? location : null });

    if (!isRedirect) {
      // final hop: read body with hard streaming byte cap and content-type verification
      const { html, byteLength, capped, binary } = await readCappedBody(res, limits.maxHtmlBytes);
      return {
        chain,
        finalUrl: url,
        response: {
          status: res.status,
          headers: res.headers,
          ms: Date.now() - start,
          html,
          byteLength,
          capped,
          binary,
        },
      };
    }

    let next;
    try {
      next = new URL(location, url).toString();
    } catch {
      throw new CrawlBlockedError('invalid-url');
    }

    // Validate the redirect target hop BEFORE following!
    await validateTarget(next);

    try {
      if (res.body) await res.body.cancel();
    } catch {
      /* stream closed */
    }

    current = next;
  }

  throw new CrawlBlockedError('redirect-loop');
}
