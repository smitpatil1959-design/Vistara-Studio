/** Small formatting helpers shared across the app. */

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  }
}

export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Human validation levels for a website URL. */
export type UrlVerdict =
  | { state: 'empty' }
  | { state: 'invalid'; reason: string }
  | { state: 'valid'; normalized: string; host: string };

const COMMON_TLD_TYPOS: Record<string, string> = {
  comm: 'com',
  coom: 'com',
  con: 'com',
  cmo: 'com',
  cpm: 'com',
  xom: 'com',
  vom: 'com',
  orgg: 'org',
  ogr: 'org',
  og: 'org',
  nett: 'net',
  nte: 'net',
  ner: 'net',
  edd: 'edu',
  eduu: 'edu',
  govv: 'gov',
  iio: 'io',
  ioo: 'io',
  aai: 'ai',
  aii: 'ai',
  appp: 'app',
  coo: 'co',
};

export function validateUrl(input: string): UrlVerdict {
  const raw = input.trim();
  if (!raw) return { state: 'empty' };
  if (/\s/.test(raw)) return { state: 'invalid', reason: 'URLs cannot contain spaces.' };
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return { state: 'invalid', reason: 'That does not parse as a URL — check for typos.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    return { state: 'invalid', reason: 'Only http/https websites can be analyzed.' };
  const host = parsed.hostname.replace(/^www\./, '');
  if (!host.includes('.'))
    return { state: 'invalid', reason: 'Enter a full domain like linear.app or studio.example.com.' };
  if (/\.\./.test(host))
    return { state: 'invalid', reason: 'Domain contains consecutive dots (..).' };
  if (host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith('['))
    return { state: 'invalid', reason: 'Local or IP addresses are not reachable by the crawl engine.' };

  const parts = host.split('.');
  const tld = parts[parts.length - 1].toLowerCase();

  if (COMMON_TLD_TYPOS[tld]) {
    return {
      state: 'invalid',
      reason: `Did you mean .${COMMON_TLD_TYPOS[tld]}? Check the domain extension for typos.`,
    };
  }

  if (tld.length < 2 || !/^[a-z]{2,}$/i.test(tld))
    return { state: 'invalid', reason: 'Enter a valid domain extension like .com, .app, or .io.' };

  return { state: 'valid', normalized: withProtocol, host };
}

const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Math.max(0, Date.now() - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return RTF.format(-m, 'minute');
  const h = Math.floor(m / 60);
  if (h < 24) return RTF.format(-h, 'hour');
  const d = Math.floor(h / 24);
  if (d < 30) return RTF.format(-d, 'day');
  const mo = Math.floor(d / 30);
  return RTF.format(-mo, 'month');
}
