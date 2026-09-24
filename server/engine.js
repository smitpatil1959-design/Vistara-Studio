// Vistara Studio — server-side intelligence engine
// Crawl → Extract → Audit → Understand → Generate → Command

import { CRAWL_LIMITS, CrawlBlockedError, detectBotChallenge, fetchValidated, validateTarget, safeDispatcher } from './security.js';
import { crawlRendered } from './browserCrawl.js';
import { runAudit } from './auditEngine.js';
import { understandWebsite, flattenUnderstanding } from './understanding/service.js';
import { buildVistaraDNA } from './dnaEngine.js';
import { decideSlideVisual, generateVisualBrief, searchAndRankVisuals } from './visualSearch.js';
import { validateSlideLayout, repairSlideSpatialCollision } from './layoutEngine.js';
import { critiqueAndRepairDeck, analyzeDeckQuality, analyzeSlideQuality } from './qualityEngine.js';
import { randomUUID } from 'node:crypto';




const UA = {
  'User-Agent':
    'Mozilla/5.0 (compatible; VistaraStudioBot/1.0; +https://vistara.studio/bot)',
  Accept: 'text/html,application/xhtml+xml',
};

/** Stage-scoped degradation — one failed sub-step never sinks the whole analysis. */
/** Deterministic creative brief: built from measured signals, marked basis='fact' throughout. */
export function fallbackBrief({ x, subX, host, pages, audit }) {
  const fact = (value, confidence = 0.95) => ({ value, basis: 'fact', confidence, evidence: ['measured at crawl time'] });
  const list = (arr) => (Array.isArray(arr) ? arr.map((v) => fact(String(v))) : []);
  
  const cleanHost = (host || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
  const hostBrand = cleanHost.split('.')[0] || 'Brand';
  const defaultBrand = hostBrand.charAt(0).toUpperCase() + hostBrand.slice(1);

  const rawTitle = x.title || '';
  const isDeniedTitle = /access.*denied|forbidden|403|cloudflare|robot|just a moment|error \d+/i.test(rawTitle);
  const title = isDeniedTitle ? defaultBrand : (rawTitle || defaultBrand);

  const description = (x.meta?.description || x.meta?.['og:description'] || '').slice(0, 180);

  let rawProductName = x.meta?.['og:site_name'] || (rawTitle && !isDeniedTitle ? rawTitle.split(/[-|—–·:]/)[0].trim().slice(0, 40) : defaultBrand) || defaultBrand;
  if (!rawProductName || rawProductName.toLowerCase() === 'www' || rawProductName.toLowerCase().startsWith('www.')) {
    rawProductName = defaultBrand;
  }
  const cleanProductName = rawProductName.charAt(0).toUpperCase() + rawProductName.slice(1);

  const featureHeads = (x.headings || []).filter((h) => h.level !== 1).slice(0, 6).map((h) => h.text.trim()).filter(Boolean);
  const pagesList = (pages || []).slice(0, 5);
  const tech = (x.tech || []).map((t) => (t.name ? `${t.name} (${t.category})` : '')).filter(Boolean);
  const toneIs = (x.words || 0) > 1400 ? 'long-form/editorial' : /!/.test(x.title || '') ? 'energetic' : 'refined';
  return {
    schemaVersion: 'understanding.v2',
    identity: { websiteName: fact(title.slice(0, 48)), productName: fact(cleanProductName), tagline: fact(description || `The official ${cleanProductName} platform.`) },
    classification: { category: fact('Digital Product', 0.7), subcategory: null },
    audience: { primary: fact(`the site's own audience`, 0.6), segments: list(pagesList.map((p) => p.title || p.path)) },
    purpose: { primary: fact(description || `Tell the story of ${host} clearly.`, 0.8), callToActionHint: null },
    value: { uniqueSellingPoint: fact(description || 'See the site for the core promise.', 0.5), differentiators: [] },
    offering: { keyFeatures: list(featureHeads), services: [], benefits: [] },
    technology: { signals: list(tech), stackSummary: tech.join(' · ') || null },
    content: {
      importantPages: pagesList.map((p) => ({ path: p.path, title: p.title || p.h1 || p.path, basis: 'fact', confidence: 0.95, evidence: [`crawled ${p.path} · HTTP ${p.status}`] })),
      keyMessages: list(featureHeads.slice(0, 4)),
      tone: fact(toneIs, 0.6),
    },
    story: { suggestedNarrative: fact(description || `A clear walkthrough of ${host}.`), sectionArc: ['hero', 'intro', 'problem', 'solution', 'features', 'workflow', 'architecture', 'benefits', 'technology', 'future', 'cta'], watchouts: [] },
    meta: { engine: 'rules+schema', model: null, attempts: 1, validated: true, factShare: 1, note: 'Deterministic brief — every field measured at crawl time.', generatedAt: new Date().toISOString() },
    __host: host,
  };
}

export class StageReport {
  constructor() { this.failed = []; }
  add(stage, message) { this.failed.push({ stage, message }); }
}
export function stage(label, fn, report) {
  try {
    return fn();
  } catch (e) {
    report.add(label, e && e.message ? e.message : 'unknown');
    return undefined;
  }
}

// ---------------------------------------------------------------- utilities

function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]).catch(() => fallback);
}

// Documents beyond the homepage in document mode still go through full SSRF validation.
async function secureSubFetch(u) {
  const v = await fetchValidated(u, { ...CRAWL_LIMITS, redirectLimit: 3, hopTimeoutMs: 6000 });
  if (!v.response) throw new Error('no-response');
  return { ok: v.response.status === 200, status: v.response.status, html: v.response.html, ms: v.response.ms, headers: v.response.headers, finalUrl: v.finalUrl };
}

function decode(s) {
  if (!s) return '';
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ')
    .trim();
}

const stripTags = (s) => decode((s || '').replace(/<[^>]*>/g, ' '));
const contentOnly = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

function absolutize(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

/** Browser response headers can contain values that Node's Headers rejects
 * (large CSPs from CDNs occasionally contain line breaks). Keep the header
 * for audit purposes after normalizing invalid control characters. */
function normalizeResponseHeaders(rawHeaders) {
  const normalized = new Headers();
  if (!rawHeaders || typeof rawHeaders !== 'object') return normalized;
  for (const [name, rawValue] of Object.entries(rawHeaders)) {
    const value = Array.isArray(rawValue) ? rawValue.join(', ') : String(rawValue ?? '');
    const cleanValue = value.replace(/[\r\n\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').trim();
    if (!cleanValue) continue;
    try {
      normalized.set(name, cleanValue);
    } catch {
      // Ignore one malformed header; the document and remaining audit headers remain usable.
    }
  }
  return normalized;
}

// ---------------------------------------------------------------- extraction

function getMeta(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${key}["'][^>]*>`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decode(m[1]);
  }
  return '';
}

function getHeadings(html) {
  const clean = contentOnly(html);
  const out = [];
  const re = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = re.exec(clean)) && out.length < 120) {
    const text = stripTags(m[2]);
    if (text && text.length > 1 && text.length < 200) out.push({ level: +m[1], text });
  }
  return out;
}

function getParagraphs(html) {
  const clean = contentOnly(html);
  const out = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(clean)) && out.length < 60) {
    const t = stripTags(m[1]);
    if (t.length > 40 && t.length < 600) out.push(t);
  }
  return out;
}

function getLinks(html, base, host) {
  const clean = contentOnly(html);
  const out = [];
  const seen = new Set();
  const re = /<a\s[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(clean)) && out.length < 400) {
    const href = m[1];
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) continue;
    if (/\.(png|jpe?g|gif|webp|svg|zip|pdf|mp4|mp3)(\?|$)/i.test(href)) continue;
    const abs = absolutize(href, base);
    if (!abs || seen.has(abs)) continue;
    seen.add(abs);
    let internal = false;
    try {
      internal = new URL(abs).hostname.replace(/^www\./, '') === host;
    } catch {}
    out.push({ url: abs, text: stripTags(m[2]).slice(0, 80), internal });
  }
  return out;
}

export function getImages(html, base) {
  const out = [];
  const seen = new Set();

  // 1. Extract Open Graph & Twitter hero images
  const ogImg = getMeta(html, 'og:image') || getMeta(html, 'twitter:image');
  if (ogImg) {
    const abs = absolutize(ogImg, base);
    if (abs && !seen.has(abs)) {
      seen.add(abs);
      out.push({ src: abs, alt: 'Website Open Graph banner', kind: 'hero', isHero: true, isProduct: false });
    }
  }

  // 2. Extract <img> and <picture> sources
  const re = /<img\s[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < 50) {
    const tag = m[0];
    const srcM = tag.match(/\ssrc=["']([^"']+)["']/i) || tag.match(/data-src=["']([^"']+)["']/i) || tag.match(/srcset=["']([^"'\s,]+)/i);
    if (!srcM) continue;
    const abs = absolutize(srcM[1], base);
    if (!abs || /^data:/.test(abs) || seen.has(abs) || /\.(svg|ico)$/i.test(abs)) continue;
    seen.add(abs);
    const altM = tag.match(/\salt=["']([^"']*)["']/i);
    const alt = altM ? altM[1] : '';
    const isLogo = /logo|brand|icon/i.test(abs + ' ' + alt);
    const isProduct = /product|app|feature|screen|dashboard|ui|interface/i.test(abs + ' ' + alt);
    const isHero = /hero|banner|cover|main/i.test(abs + ' ' + alt);
    const kind = isHero ? 'hero' : isProduct ? 'product' : isLogo ? 'logo' : 'photo';
    const lazy = /loading=["']lazy["']/i.test(tag);
    out.push({ src: abs, alt: alt || null, kind, isHero, isProduct, isLogo, lazy });
  }

  // 3. Extract CSS background-images from hero/banner elements
  const bgRe = /background(?:-image)?:\s*url\(["']?([^"')]+)["']?\)/gi;
  while ((m = bgRe.exec(html)) && out.length < 50) {
    const abs = absolutize(m[1], base);
    if (abs && !seen.has(abs) && !/^data:/.test(abs) && !/\.(svg|ico)$/i.test(abs)) {
      seen.add(abs);
      out.push({ src: abs, alt: 'Website hero background', kind: 'hero', isHero: true, isProduct: false });
    }
  }

  return out;
}


export function normHex(h) {
  if (!h || typeof h !== 'string') return '#000000';
  h = h.toLowerCase().trim();
  if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  if (/^#[0-9a-f]{6}$/.test(h)) return h;
  return '#000000';
}

export function hexToRgb(hex) {
  const clean = normHex(hex);
  const n = parseInt(clean.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r, g, b) {
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [cl(r), cl(g), cl(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

export function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

export function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function tintHex(hex, factor) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * factor, g + (255 - g) * factor, b + (255 - b) * factor);
}

export function shadeHex(hex, factor) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - factor), g * (1 - factor), b * (1 - factor));
}

export function extractVisualDna(x, subX = [], host = '', probe = null) {
  const live = probe?.visualDna || {};
  const isLiveDark = typeof live.isDark === 'boolean' ? live.isDark : null;
  const colors = x.colors || [];

  const brandColors = [];
  if (live.btnBg && live.btnBg.startsWith('#')) brandColors.push(normHex(live.btnBg));
  for (const c of live.colorSamples || []) {
    if (c && typeof c === 'string' && c.startsWith('#')) {
      const nh = normHex(c);
      if (!brandColors.includes(nh)) brandColors.push(nh);
    }
  }
  for (const c of colors) {
    if (c.hex) {
      const nh = normHex(c.hex);
      if (!brandColors.includes(nh)) brandColors.push(nh);
    }
  }

  let primary = null;
  let secondary = null;
  for (const hex of brandColors) {
    const { s, l } = hexToHsl(hex);
    if (s >= 0.22 && l >= 0.2 && l <= 0.82) {
      if (!primary) primary = hex;
      else if (!secondary && Math.abs(hexToHsl(primary).h - hexToHsl(hex).h) > 25) {
        secondary = hex;
      }
    }
  }

  if (!primary) {
    primary = brandColors[0] || '#10B981';
  }
  if (!secondary) {
    const { h, s, l } = hexToHsl(primary);
    secondary = s > 0.18 ? hslToHex((h + 38) % 360, Math.min(1, s * 0.9), Math.max(0.3, Math.min(0.7, l))) : '#0EA5E9';
  }

  const isDark = isLiveDark !== null ? isLiveDark : (
    (live.bodyBg && relativeLuminance(live.bodyBg) < 0.35) || false
  );

  const h1Font = live.h1Font || (x.fonts && x.fonts[0]) || 'Inter Tight';
  const bodyFont = live.bodyFont || (x.fonts && x.fonts[1]) || 'Inter';

  const corpus = [x.title, x.description, ...(x.headings || []).map((h) => h.text)].join(' ').toLowerCase();
  let personality = 'refined';
  if (/api|sdk|runtime|latency|developer|database|infrastructure|terminal|deploy|git/i.test(corpus)) {
    personality = 'technical';
  } else if (/luxury|couture|estate|private|bespoke|heritage|artisan|jewel/i.test(corpus)) {
    personality = 'luxury';
  } else if (/magazine|journal|editorial|story|essay|read|publication|author/i.test(corpus)) {
    personality = 'editorial';
  } else if (/minimal|simple|clean|calm|quiet|focus/i.test(corpus)) {
    personality = 'minimalist';
  } else if (/fast|speed|lightning|turbo|power|supercharge|rocket|boost|game/i.test(corpus)) {
    personality = 'energetic';
  } else if (/enterprise|compliance|governance|security|soc2|hipaa|audit/i.test(corpus)) {
    personality = 'corporate';
  } else if (/creative|studio|design|agency|canvas|motion|3d|brand/i.test(corpus)) {
    personality = 'creative';
  }

  const radius = typeof live.cardRadius === 'number' && live.cardRadius > 0
    ? Math.min(28, Math.max(4, live.cardRadius))
    : (personality === 'technical' ? 10 : personality === 'luxury' ? 4 : personality === 'minimalist' ? 12 : 18);

  return {
    primary,
    secondary,
    isDark,
    h1Font,
    bodyFont,
    headingWeight: live.headingWeight || '600',
    radius,
    personality,
    rawBg: live.bodyBg || (isDark ? '#0A0A0C' : '#FFFFFF'),
    rawColor: live.bodyColor || (isDark ? '#FAFAFA' : '#17170F'),
  };
}

export function generatePresentationDesignSystem(visualDna, skinPreference = null, designPrompt = '') {
  const p = (designPrompt || '').toLowerCase();
  const promptDark = /\b(dark|black|obsidian|midnight|night)\b/.test(p);
  const promptLight = /\b(light|white|paper|clean|cream)\b/.test(p);
  const skin = promptDark ? 'dark' : promptLight ? 'light' : (skinPreference || (visualDna.isDark ? 'dark' : 'light'));

  const prim = visualDna.primary || visualDna.dominantColor || '#65A30D';
  const sec = visualDna.secondary || visualDna.secondaryColor || '#0E7490';
  const primHsl = hexToHsl(prim);


  let bg, surface, surfaceAlt, text, mutedText, line, accent, accent2;

  accent = prim;
  accent2 = sec;
  if (/\b(gold|champagne|amber)\b/.test(p)) {
    accent = '#F5B453'; accent2 = '#F59E0B';
  } else if (/\b(emerald|green|forest)\b/.test(p)) {
    accent = '#10B981'; accent2 = '#059669';
  } else if (/\b(crimson|red|ruby|scarlet)\b/.test(p)) {
    accent = '#F43F5E'; accent2 = '#DC2626';
  } else if (/\b(cyan|blue|cobalt|electric)\b/.test(p)) {
    accent = '#38BDF8'; accent2 = '#2563EB';
  } else if (/\b(violet|purple|neon)\b/.test(p)) {
    accent = '#8B5CF6'; accent2 = '#06B6D4';
  }

  const isGreenSite = primHsl.h >= 75 && primHsl.h <= 165 && primHsl.s >= 0.2;
  const isRedSite = (primHsl.h >= 340 || primHsl.h <= 20) && primHsl.s >= 0.25;
  const isBlueSite = primHsl.h >= 190 && primHsl.h <= 250 && primHsl.s >= 0.2;
  const isMonochrome = primHsl.s < 0.15;

  if (skin === 'dark') {
    if (isGreenSite) {
      bg = '#080E0B';
      surface = '#0F1A14';
      surfaceAlt = '#16241C';
      text = '#F0FDF4';
      mutedText = '#869C8E';
      line = 'rgba(240, 253, 244, 0.09)';
    } else if (isRedSite) {
      bg = '#0C0A09';
      surface = '#181514';
      surfaceAlt = '#241E1C';
      text = '#FAFAF9';
      mutedText = '#A8A29E';
      line = 'rgba(250, 250, 249, 0.09)';
    } else if (isBlueSite) {
      bg = '#080C14';
      surface = '#0F1726';
      surfaceAlt = '#162238';
      text = '#F0F7FF';
      mutedText = '#88A2C2';
      line = 'rgba(240, 247, 255, 0.09)';
    } else if (isMonochrome) {
      bg = '#09090B';
      surface = '#141417';
      surfaceAlt = '#1E1E24';
      text = '#FAFAFA';
      mutedText = '#A1A1AA';
      line = 'rgba(255, 255, 255, 0.08)';
    } else {
      bg = hslToHex(primHsl.h, Math.min(0.25, primHsl.s * 0.3), 0.05);
      surface = hslToHex(primHsl.h, Math.min(0.28, primHsl.s * 0.35), 0.09);
      surfaceAlt = hslToHex(primHsl.h, Math.min(0.3, primHsl.s * 0.4), 0.14);
      text = '#F8FAFC';
      mutedText = '#94A3B8';
      line = 'rgba(248, 250, 252, 0.08)';
    }
  } else {
    if (isGreenSite) {
      bg = '#F7FAF7';
      surface = '#FFFFFF';
      surfaceAlt = '#EBF4EA';
      text = '#131B15';
      mutedText = '#586A5E';
      line = 'rgba(19, 27, 21, 0.08)';
    } else if (isRedSite) {
      bg = '#FAFAF8';
      surface = '#FFFFFF';
      surfaceAlt = '#F6ECE8';
      text = '#1C1917';
      mutedText = '#685D57';
      line = 'rgba(28, 25, 23, 0.08)';
    } else if (isBlueSite) {
      bg = '#F6F9FD';
      surface = '#FFFFFF';
      surfaceAlt = '#EAF2FA';
      text = '#0F172A';
      mutedText = '#475569';
      line = 'rgba(15, 23, 42, 0.08)';
    } else if (isMonochrome) {
      bg = '#F8F8FA';
      surface = '#FFFFFF';
      surfaceAlt = '#EFEFF2';
      text = '#111113';
      mutedText = '#5C5C66';
      line = 'rgba(17, 17, 19, 0.08)';
    } else {
      bg = '#FAFAF9';
      surface = '#FFFFFF';
      surfaceAlt = hslToHex(primHsl.h, Math.min(0.18, primHsl.s * 0.25), 0.94);
      text = '#17171C';
      mutedText = '#646473';
      line = 'rgba(23, 23, 28, 0.08)';
    }
  }

  let headingFont = visualDna.h1Font || 'Inter Tight';
  let bodyFont = visualDna.bodyFont || 'Inter';
  if (/\b(serif|editorial|luxury|fashion|literary)\b/.test(p)) {
    headingFont = 'Instrument Serif';
  } else if (/\b(mono|code|terminal|hacker|geek)\b/.test(p)) {
    headingFont = 'JetBrains Mono';
  } else if (/\b(geometric|tech|modern|futuristic)\b/.test(p)) {
    headingFont = 'Space Grotesk';
  }

  let motion = 'smooth';
  if (/\b(cinematic|movie|epic|drama)\b/.test(p)) motion = 'cinematic';
  else if (/\b(snappy|fast|quick|sharp|energetic)\b/.test(p)) motion = 'snappy';
  else if (/\b(calm|peaceful|soft|gentle|elegant)\b/.test(p)) motion = 'calm';
  else if (/\b(minimal|subtle)\b/.test(p)) motion = 'minimal';

  const radius = visualDna.radius || 18;

  return {
    skin,
    accent,
    accent2,
    headingFont,
    bodyFont,
    motion,
    radius,
    colors: {
      bg,
      surface,
      surfaceAlt,
      text,
      mutedText,
      accent,
      accent2,
      line,
    },
    visualDna,
  };
}

function getColors(html) {
  const styleBlocks = (html.match(/<style[\s\S]*?<\/style>/gi) || []).join(' ');
  const styleAttrs = (html.match(/style=["'][^"']*["']/gi) || []).join(' ');
  const pool = styleBlocks + ' ' + styleAttrs;
  const tally = {};
  const re = /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi;
  let m;
  while ((m = re.exec(pool))) {
    const h = normHex(m[0]);
    if (h.length !== 7) continue;
    const { s, l } = hexToHsl(h);
    if (s < 0.12 || l < 0.06 || l > 0.94) continue;
    tally[h] = (tally[h] || 0) + 1;
  }
  const picked = [];
  for (const [hex, count] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    const { h } = hexToHsl(hex);
    if (picked.some((p) => Math.abs(hexToHsl(p.hex).h - h) < 18)) continue;
    picked.push({ hex, count });
    if (picked.length >= 8) break;
  }
  return picked;
}


function getFonts(html) {
  const fonts = new Set();
  let m;
  const gRe = /fonts\.googleapis\.com\/css2?\?[^"']*family=([^&"']+)/gi;
  while ((m = gRe.exec(html))) fonts.add(decodeURIComponent(m[1]).replace(/[:@].*$/, '').replace(/\+/g, ' '));
  const styleBlocks = (html.match(/<style[\s\S]*?<\/style>/gi) || []).join(' ');
  const fRe = /font-family\s*:\s*["']?([A-Za-z][A-Za-z0-9\- ]+)/gi;
  while ((m = fRe.exec(styleBlocks))) fonts.add(m[1].trim());
  const inlineRe = /style=["'][^"']*font-family:\s*["']?([A-Za-z][A-Za-z0-9\- ]+)/gi;
  while ((m = inlineRe.exec(html))) fonts.add(m[1].trim());
  return [...fonts].filter((f) => !/^(inherit|initial|unset|sans|serif|system|default|-apple)/i.test(f)).slice(0, 6);
}

const TECH_SIGNS = [
  { name: 'Next.js', cat: 'Framework', re: /_next\/static|__NEXT_DATA__|next-head-count/ },
  { name: 'React', cat: 'Framework', re: /data-reactroot|react-dom|__REACT_DEVTOOLS|react\.production/ },
  { name: 'Vue.js', cat: 'Framework', re: /data-v-[a-f0-9]{8}|vue(?:\.min)?\.js|__VUE__/ },
  { name: 'Nuxt', cat: 'Framework', re: /__NUXT__|_nuxt\// },
  { name: 'Angular', cat: 'Framework', re: /ng-version=|angular(?:\.min)?\.js/ },
  { name: 'SvelteKit', cat: 'Framework', re: /__sveltekit|svelte-/ },
  { name: 'Gatsby', cat: 'Framework', re: /___gatsby/ },
  { name: 'Remix', cat: 'Framework', re: /__remixContext/ },
  { name: 'Astro', cat: 'Framework', re: /astro-island/ },
  { name: 'WordPress', cat: 'CMS', re: /wp-content\/|wp-includes\// },
  { name: 'Webflow', cat: 'CMS', re: /webflow\.js|data-wf-|\.webflow\.io/ },
  { name: 'Framer', cat: 'CMS', re: /framerusercontent\.com|framer\.com\/-/ },
  { name: 'Shopify', cat: 'Commerce', re: /cdn\.shopify\.com|Shopify\.theme/ },
  { name: 'Squarespace', cat: 'CMS', re: /static1\.squarespace\.com/ },
  { name: 'Wix', cat: 'CMS', re: /static\.wixstatic\.com/ },
  { name: 'Tailwind CSS', cat: 'Styling', re: /tailwind(?:\.min)?\.css|--tw-/ },
  { name: 'Bootstrap', cat: 'Styling', re: /bootstrap(?:\.min)?\.(?:css|js)/ },
  { name: 'GSAP', cat: 'Motion', re: /gsap(?:\.min)?\.js|ScrollTrigger/ },
  { name: 'Three.js', cat: '3D', re: /three(?:\.min)?\.js/ },
  { name: 'Stripe', cat: 'Payments', re: /js\.stripe\.com/ },
  { name: 'Google Analytics', cat: 'Analytics', re: /googletagmanager\.com|google-analytics\.com|gtag\(/ },
  { name: 'Segment', cat: 'Analytics', re: /cdn\.segment\.com/ },
  { name: 'Intercom', cat: 'Support', re: /widget\.intercom\.io|intercomcdn/ },
  { name: 'Cloudflare', cat: 'Infra', header: 'cf-ray' },
  { name: 'Vercel', cat: 'Hosting', header: 'x-vercel-id' },
  { name: 'Netlify', cat: 'Hosting', header: 'x-nf-request-id' },
];

function detectTech(html, headers) {
  const found = [];
  for (const s of TECH_SIGNS) {
    if (s.re && s.re.test(html)) found.push({ name: s.name, category: s.cat });
    else if (s.header && headers.get(s.header)) found.push({ name: s.name, category: s.cat });
  }
  const gen = getMeta(html, 'generator');
  if (gen && gen.length < 40) found.push({ name: gen, category: 'Generator' });
  const server = headers.get('server');
  if (server && !/cloudflare|vercel|netlify/i.test(server) && server.length < 30)
    found.push({ name: server.split('/')[0], category: 'Server' });
  const powered = headers.get('x-powered-by');
  if (powered && powered.length < 30) found.push({ name: powered.split('/')[0], category: 'Runtime' });
  const seen = new Set();
  return found.filter((t) => (seen.has(t.name) ? false : (seen.add(t.name), true))).slice(0, 10);
}

function getButtons(html) {
  const buttons = [];
  const btnRe = /<(?:button|a[^>]*class=["'][^"']*(?:btn|button|cta)[^"']*["'])[^>]*>([\s\S]*?)<\/(?:button|a)>/gi;
  let m;
  while ((m = btnRe.exec(html)) && buttons.length < 16) {
    const text = stripTags(m[1]).replace(/\s+/g, ' ').trim();
    if (text && text.length >= 2 && text.length <= 60 && !buttons.includes(text)) {
      buttons.push(text);
    }
  }
  return buttons;
}

function getNavStructure(html, finalUrl, host) {
  const navBlocks = (html.match(/<nav[\s\S]*?<\/nav>/gi) || []).join(' ');
  const headerBlocks = (html.match(/<header[\s\S]*?<\/header>/gi) || []).join(' ');
  const footerBlocks = (html.match(/<footer[\s\S]*?<\/footer>/gi) || []).join(' ');
  return {
    hasHeader: headerBlocks.length > 0,
    hasNav: navBlocks.length > 0,
    hasFooter: footerBlocks.length > 0,
    headerLinks: getLinks(headerBlocks || navBlocks, finalUrl, host).slice(0, 8),
    footerLinks: getLinks(footerBlocks, finalUrl, host).slice(0, 8),
  };
}

function extractPage(html, finalUrl, host) {
  const titleTag = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  const meta = {
    description: getMeta(html, 'description'),
    'og:title': getMeta(html, 'og:title'),
    'og:description': getMeta(html, 'og:description'),
    'og:site_name': getMeta(html, 'og:site_name'),
    'og:image': getMeta(html, 'og:image'),
    viewport: getMeta(html, 'viewport'),
    generator: getMeta(html, 'generator'),
  };
  const lang = (html.match(/<html[^>]*lang=["']([^"']+)["']/i) || [])[1] || '';
  const headings = getHeadings(html);
  const paragraphs = getParagraphs(html);
  const links = getLinks(html, finalUrl, host);
  const images = getImages(html, finalUrl);
  const colors = getColors(html);
  const fonts = getFonts(html);
  const buttons = getButtons(html);
  const nav = getNavStructure(html, finalUrl, host);
  const ariaCount = (html.match(/\saria-[a-z]+=/gi) || []).length + (html.match(/\srole=/gi) || []).length;
  const landmarks = ['main', 'nav', 'header', 'footer', 'section'].reduce(
    (n, t) => n + (html.match(new RegExp(`<${t}[\\s>]`, 'gi')) || []).length,
    0
  );
  const mediaQueries = (html.match(/@media[^{]*\{/g) || []).length;
  const srcsetCount = (html.match(/srcset=/gi) || []).length;
  const scriptCount = (html.match(/<script[\s>]/gi) || []).length;
  const skipLink = /skip to (content|main)/i.test(html);
  const h1Count = headings.filter((h) => h.level === 1).length;
  const words = stripTags(contentOnly(html)).split(/\s+/).filter(Boolean).length;
  // form usability measurement (real markup counts)
  const inputTags = html.match(/<input[\s>]|<textarea[\s>]|<select[\s>]/gi) || [];
  const labeledTags =
    (html.match(/aria-label(ledby)?\s*=\s*["'][^"']+["']/gi) || []).length;
  const labelFor = new Set();
  const labelRe = /<label[^>]*for\s*=\s*["']([^"']+)["']/gi;
  let lm;
  while ((lm = labelRe.exec(html))) labelFor.add(lm[1]);
  const idLabeled = inputTags.length
    ? (html.match(/<input[^>]*id\s*=\s*["'][^"']+["']/gi) || []).filter((t) => {
        const idM = t.match(/id\s*=\s*["']([^"']+)["']/i);
        return idM && labelFor.has(idM[1]);
      }).length
    : 0;
  const forms = { inputs: inputTags.length, labeled: Math.min(inputTags.length, idLabeled + Math.min(labeledTags, inputTags.length)) };
  return {
    title: decode(titleTag || ''),
    meta, lang, headings, paragraphs, links, images, colors, fonts, forms, buttons, nav,
    ariaCount, landmarks, mediaQueries, srcsetCount, scriptCount, skipLink, h1Count, words,
  };
}

// ---------------------------------------------------------------- audit

function issue(status, label, detail, hint) {
  return { status, label, detail: detail || '', hint: hint || '' };
}
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

/** legacy heuristic scorer — superseded by runAudit (server/auditEngine.js). Kept exported for reference. */
export function buildAudit({ home, x, pages, probed, robots, host, url }) {
  const broken = probed.filter((p) => !p.ok);
  const https = url.startsWith('https');
  const H = (k) => home.headers.get(k);

  // ---------- technical
  const tech = [];
  let techScore = 100;
  if (home.status === 200) tech.push(issue('pass', 'Origin reachable', `HTTP 200 in ${home.ms} ms`));
  else { tech.push(issue('fail', 'Unexpected status', `Homepage returned HTTP ${home.status}.`)); techScore -= 45; }
  if (broken.length === 0) tech.push(issue('pass', 'Link integrity', `All ${probed.length} probed links returned healthy status codes.`));
  else {
    tech.push(issue('fail', `${broken.length} broken link${broken.length > 1 ? 's' : ''} detected`,
      broken.slice(0, 3).map((b) => `${new URL(b.url).pathname || b.url} → ${b.status || 'unreachable'}`).join('  ·  '),
      'Repair or redirect dead destinations — crawlers and users abandon sites with dead ends.'));
    techScore -= Math.min(40, broken.length * 8);
  }
  const okPages = pages.filter((p) => p.status === 200).length;
  if (okPages === pages.length) tech.push(issue('pass', 'Crawl health', `${okPages}/${pages.length} crawled pages returned HTTP 200.`));
  else { tech.push(issue('warn', 'Some pages failed to load', `${pages.length - okPages} of ${pages.length} crawled pages returned errors.`)); techScore -= 12; }
  if (x.meta.description) tech.push(issue('pass', 'Meta description present', `"${x.meta.description.slice(0, 90)}…"`));
  else { tech.push(issue('warn', 'Missing meta description', 'Search snippets will be auto-generated.', 'Add a 150–160 character description that sells the click.')); techScore -= 10; }
  if (robots) tech.push(issue('pass', 'robots.txt available', 'Crawler directives are published.'));
  else { tech.push(issue('warn', 'No robots.txt found', 'Crawlers index without guidance.', 'Publish /robots.txt with sitemap references.')); techScore -= 5; }

  // ---------- responsive
  const resp = [];
  let respScore = 100;
  const viewportOk = /width\s*=\s*device-width/i.test(x.meta.viewport || '');
  if (viewportOk) resp.push(issue('pass', 'Viewport configured', `"${x.meta.viewport}"`));
  else { resp.push(issue('fail', 'No responsive viewport meta', 'Pages render at desktop width on phones.', 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.')); respScore -= 35; }
  if (x.mediaQueries >= 4) resp.push(issue('pass', `${x.mediaQueries} media queries`, 'Layout adapts across breakpoints.'));
  else if (x.mediaQueries > 0) { resp.push(issue('warn', `Only ${x.mediaQueries} media queries`, 'Limited responsive coverage detected.')); respScore -= 12; }
  else { resp.push(issue('warn', 'No media queries detected in inline CSS', 'The layout may rely on a framework reset only.')); respScore -= 18; }
  if (x.srcsetCount > 0) resp.push(issue('pass', 'Responsive images', `${x.srcsetCount} image(s) declare srcset/src variants.`));
  else if (x.images.length > 3) { resp.push(issue('warn', 'Images lack srcset', 'Mobile devices may download desktop-size assets.')); respScore -= 10; }

  // ---------- accessibility
  const acc = [];
  const withAlt = x.images.filter((i) => i.alt && i.alt.trim()).length;
  const altRatio = x.images.length ? withAlt / x.images.length : 1;
  let accScore = 100;
  if (x.lang) acc.push(issue('pass', 'Document language declared', `lang="${x.lang}"`));
  else { acc.push(issue('fail', 'Missing lang attribute', 'Screen readers cannot infer pronunciation.', 'Set lang on the <html> element.')); accScore -= 15; }
  if (x.images.length === 0) acc.push(issue('pass', 'No imagery to annotate', 'Nothing requires alt text.'));
  else if (altRatio >= 0.9) acc.push(issue('pass', `Alt text coverage ${Math.round(altRatio * 100)}%`, `${withAlt}/${x.images.length} images carry alt text.`));
  else {
    acc.push(issue(altRatio >= 0.5 ? 'warn' : 'fail', `Alt text coverage ${Math.round(altRatio * 100)}%`,
      `${x.images.length - withAlt} of ${x.images.length} images are announced as decoration or filename.`,
      'Write alt text that conveys the purpose of each image.'));
    accScore -= Math.round((1 - altRatio) * 35);
  }
  if (x.h1Count === 1) acc.push(issue('pass', 'Single H1', 'Document outline is unambiguous.'));
  else if (x.h1Count === 0) { acc.push(issue('fail', 'No H1 found', 'Pages need one clear top-level heading.')); accScore -= 15; }
  else { acc.push(issue('warn', `${x.h1Count} competing H1s`, 'Multiple top-level headings dilute the outline.')); accScore -= 8; }
  if (x.ariaCount >= 8) acc.push(issue('pass', `${x.ariaCount} ARIA annotations`, 'Assistive technology hooks detected.'));
  else { acc.push(issue('warn', 'Sparse ARIA usage', `${x.ariaCount} ARIA attributes found.`, 'Annotate interactive regions with roles and labels.')); accScore -= 10; }
  if (x.landmarks >= 4) acc.push(issue('pass', `${x.landmarks} semantic landmarks`, 'main/nav/header/footer structure detected.'));
  else { acc.push(issue('warn', 'Few semantic landmarks', 'Divs do most of the structural work.', 'Use landmark elements so users can jump sections.')); accScore -= 8; }
  if (x.skipLink) acc.push(issue('pass', 'Skip-to-content link', 'Keyboard users can bypass navigation.'));
  else { acc.push(issue('warn', 'No skip link detected', 'Keyboard users tab through the entire header.')); accScore -= 6; }

  // ---------- performance
  const perf = [];
  let perfScore = 100;
  const sizeKb = Math.round(home.html.length / 1024);
  if (home.ms < 800) perf.push(issue('pass', `Server responded in ${home.ms} ms`, 'Excellent time-to-first-byte.'));
  else if (home.ms < 1800) { perf.push(issue('warn', `Server responded in ${home.ms} ms`, 'Acceptable, but sub-800 ms is the premium bar.')); perfScore -= 12; }
  else { perf.push(issue('fail', `Slow response: ${home.ms} ms`, 'TTFB above 1.8 s bleeds conversions.', 'Add edge caching, optimize backend queries, enable CDN.')); perfScore -= 30; }
  if (sizeKb < 200) perf.push(issue('pass', `${sizeKb} KB document`, 'Lean HTML payload.'));
  else if (sizeKb < 600) { perf.push(issue('warn', `${sizeKb} KB document`, 'Consider pruning hydration payloads.')); perfScore -= 8; }
  else { perf.push(issue('fail', `${sizeKb} KB document`, 'Very heavy HTML — likely inlined state or assets.', 'Move data fetching to the client, compress markup.')); perfScore -= 20; }
  if (x.scriptCount <= 10) perf.push(issue('pass', `${x.scriptCount} script tags`, 'Restrained JavaScript surface.'));
  else if (x.scriptCount <= 25) { perf.push(issue('warn', `${x.scriptCount} script tags`, 'Third-party tags accumulate main-thread cost.')); perfScore -= 10; }
  else { perf.push(issue('fail', `${x.scriptCount} script tags`, 'Extreme script weight blocks interactivity.', 'Audit third parties; defer everything non-critical.')); perfScore -= 22; }
  const enc = H('content-encoding');
  if (enc) perf.push(issue('pass', `Compression: ${enc}`, 'Transfer size reduced on the wire.'));
  else { perf.push(issue('warn', 'No compression header', 'Responses may be sent uncompressed.')); perfScore -= 8; }
  const lazyCount = x.images.filter((i) => i.lazy).length;
  if (x.images.length > 4 && lazyCount === 0) { perf.push(issue('warn', 'No lazy-loaded images', 'All imagery loads eagerly.')); perfScore -= 8; }
  else if (lazyCount > 0) perf.push(issue('pass', `${lazyCount} lazy-loaded image(s)`, 'Below-the-fold media deferred.'));

  // ---------- security
  const sec = [];
  let secScore = 100;
  if (https) sec.push(issue('pass', 'HTTPS enforced', `${host} serves over TLS.`));
  else { sec.push(issue('fail', 'Site served over plain HTTP', 'Traffic is interceptable.')); secScore -= 40; }
  const std = (h, label, pts, hint) => {
    if (H(h)) sec.push(issue('pass', label, `${h}: ${H(h).slice(0, 60)}`));
    else { sec.push(issue('warn', `Missing ${label}`, hint)); secScore -= pts; }
  };
  std('strict-transport-security', 'HSTS header', 10, 'Browsers remember to upgrade to HTTPS automatically.');
  std('content-security-policy', 'Content-Security-Policy', 12, 'CSP neutralizes most XSS and injection attempts.');
  if (H('x-frame-options') || /frame-ancestors/.test(H('content-security-policy') || ''))
    sec.push(issue('pass', 'Clickjacking protection', 'Framing is restricted.'));
  else { sec.push(issue('warn', 'No clickjacking protection', 'Pages can be embedded in hostile iframes.')); secScore -= 8; }
  std('x-content-type-options', 'MIME sniffing protection', 6, 'Prevents browsers from interpreting files as other types.');
  std('referrer-policy', 'Referrer-Policy', 5, 'Controls URL leakage to third parties.');
  const mixed = https && /src=["']http:\/\//i.test(home.html);
  if (mixed) { sec.push(issue('fail', 'Mixed content detected', 'HTTP resources on an HTTPS page.')); secScore -= 12; }
  else if (https) sec.push(issue('pass', 'No mixed content', 'All subresources ride the secure channel.'));

  const categories = [
    { key: 'technical', label: 'Technical', score: clamp(techScore), issues: tech },
    { key: 'responsive', label: 'Responsive', score: clamp(respScore), issues: resp },
    { key: 'accessibility', label: 'Accessibility', score: clamp(accScore), issues: acc },
    { key: 'performance', label: 'Performance', score: clamp(perfScore), issues: perf },
    { key: 'security', label: 'Security', score: clamp(secScore), issues: sec },
  ];
  const overall = clamp(categories.reduce((s, c) => s + c.score, 0) / categories.length);
  const verdict =
    overall >= 90 ? 'Exceptional — this site operates at a premium standard.' :
    overall >= 75 ? 'Strong foundation with a few cracks worth sealing.' :
    overall >= 60 ? 'Serviceable, but the experience leaks trust in places.' :
    'Critical gaps — the site needs attention before it earns attention.';
  return { overall, verdict, generatedAt: new Date().toISOString(), categories };
}

// ---------------------------------------------------------------- understanding

const STOP_TITLES = /^(home|blog|contact|about( us)?|log ?in|sign ?(up|in)|pricing|careers?|docs?|documentation|support|help|menu|search|cookie|privacy|terms|get started|subscribe|newsletter|footer|read more|learn more|all rights|skip to|©|faq|press|media kit|english|back to)/i;

const CATEGORIES = [
  { key: 'aiml', label: 'AI Platform', words: ['ai', 'artificial intelligence', 'machine learning', 'llm', 'model', 'neural', 'gpt', 'agent', 'inference', 'generative'],
    audience: ['product teams', 'developers', 'data teams'],
    goal: 'turn AI capability into shipped product',
    problem: [['AI demos impress — production AI is brutal', 'Latency, cost and quality collapse the moment real users arrive.'], ['Tooling is fragmented', 'Teams stitch together notebooks, scripts and vendor APIs with duct tape.'], ['Stakes are invisible', 'Without observability, every release is a leap of faith.']],
    workflow: [['Connect', 'Plug in your data, prompts or models in minutes.'], ['Compose', 'Assemble pipelines visually, with evaluation at every step.'], ['Ship', 'Deploy behind a single endpoint with guardrails on.'], ['Observe', 'Watch quality, latency and cost in real time.']],
    future: [['Multi-modal support', 'From text to voice, vision and video in one pipeline.'], ['Agent workflows', 'Long-running autonomous tasks with human checkpoints.'], ['Private deployments', 'Bring the platform inside customer VPCs.'], ['Marketplace', 'Reusable pipelines and evaluation packs.']]},
  { key: 'devtool', label: 'Developer Tool', words: ['developer', 'api', 'sdk', 'code', 'deploy', 'git', 'cli', 'open source', 'repository', 'build', 'runtime', 'serverless'],
    audience: ['developers', 'engineering teams', 'platform teams'],
    goal: 'compress the distance between idea and production',
    problem: [['Toolchains eat the week', 'Engineers lose days to configuration, yak-shaving and YAML.'], ['Feedback loops are glacial', 'Slow builds and deploys kill flow state and morale.'], ['Best practices rot in wikis', 'Standards live in documents nobody opens at 2 a.m.']],
    workflow: [['Install', 'One CLI command and the toolchain is live.'], ['Develop', 'Local-first workflow with instant feedback.'], ['Review', 'Ship changes through previews your whole team can see.'], ['Ship', 'Push to production with rollbacks built in.']],
    future: [['AI-assisted workflows', 'Codegen and review woven into the CLI.'], ['Deeper integrations', 'First-class plugins for the tools teams already live in.'], ['Team analytics', 'DORA metrics without the spreadsheet theater.'], ['Self-hosted tier', 'Enterprise control plane behind your firewall.']]},
  { key: 'commerce', label: 'E-Commerce', words: ['shop', 'cart', 'buy', 'price', 'product', 'order', 'shipping', 'collection', 'store', 'checkout', 'sale'],
    audience: ['online shoppers', 'brand loyalists', 'gift buyers'],
    goal: 'turn casual browsers into repeat buyers',
    problem: [['Choice paralysis is real', 'Endless catalogs without guidance kill momentum.'], ['Trust must be earned pixel by pixel', 'One janky checkout moment and the cart is abandoned.'], ['Attention is rented', 'Every visit competes with a dozen open tabs.']],
    workflow: [['Discover', 'Arrive through story-driven collections, not grids of SKUs.'], ['Explore', 'Rich product pages with honest detail and proof.'], ['Commit', 'A checkout so fast it feels like one thought.'], ['Return', 'Post-purchase care that creates regulars.']],
    future: [['Personalized storefronts', 'Homepages assembled per visitor intent.'], ['Social commerce', 'Shoppable content where the audience already lives.'], ['Subscriptions', 'Replenishment and membership programs.'], ['Global expansion', 'Localized currencies, duties and fulfillment.']]},
  { key: 'fintech', label: 'Fintech', words: ['payment', 'bank', 'finance', 'money', 'card', 'invoice', 'billing', 'crypto', 'invest', 'loan', 'treasury'],
    audience: ['finance teams', 'founders', 'operators'],
    goal: 'make money movement feel instant and obvious',
    problem: [['Financial ops run on spreadsheets and hope', 'Reconciliation by hand guarantees errors and audits.'], ['Legacy rails move like it is 1998', 'Settlement delays strand working capital.'], ['Compliance is a full-time fear', 'Regulations shift faster than teams can adapt.']],
    workflow: [['Connect accounts', 'Securely link banks, cards and ledgers.'], ['Automate flows', 'Rules route, approve and reconcile automatically.'], ['Monitor', 'Dashboards surface cash position in real time.'], ['Report', 'Auditable exports your accountant will frame.']],
    future: [['Embedded lending', 'Underwriting powered by live cash-flow data.'], ['Global treasury', 'Multi-currency operations in one view.'], ['Copilots for finance', 'AI that drafts the month-end narrative.'], ['Open banking depth', 'Richer data as regulations mature.']]},
  { key: 'productivity', label: 'Productivity Platform', words: ['team', 'project', 'task', 'workflow', 'collaborate', 'plan', 'track', 'workspace', 'calendar', 'notes', 'docs'],
    audience: ['cross-functional teams', 'operators', 'project leads'],
    goal: 'give teams one calm place where work actually ships',
    problem: [['Work is scattered across ten tabs', 'Context evaporates between chat, docs and trackers.'], ['Status meetings are the tax', 'When tools lie, humans sync by calendar.'], ['Process ossifies', 'Tools force their religion instead of fitting yours.']],
    workflow: [['Capture', 'Get ideas and requests in with zero friction.'], ['Organize', 'Structure projects your way — views, not rules.'], ['Execute', 'Assign, track and unblock in one place.'], ['Review', 'Progress reports that write themselves.']],
    future: [['AI grooming', 'Backlogs triaged and deduplicated automatically.'], ['Cross-workspace graph', 'Dependencies visualized across teams.'], ['Offline-first sync', 'Full power on planes and trains.'], ['Workflow marketplace', 'Community-built templates and automations.']]},
  { key: 'agency', label: 'Studio & Agency', words: ['design', 'studio', 'agency', 'brand', 'creative', 'portfolio', 'case study', 'clients', 'craft', 'award'],
    audience: ['founders', 'marketing leaders', 'venture-backed teams'],
    goal: 'translate ambition into brands people remember',
    problem: [['Great work is invisible without framing', 'Case studies must sell the thinking, not just the pixels.'], ['Every pitch starts from zero', 'No system means reinventing the story each time.'], ['Taste is subjective until it is packaged', 'Clients buy confidence, shown not claimed.']],
    workflow: [['Discover', 'Immerse in the client’s market and mythology.'], ['Define', 'Strategy and narrative before a single pixel.'], ['Design', 'Systems, not screens — identity, motion, voice.'], ['Deliver', 'Launch support and a handover that sticks.']],
    future: [['Productized services', 'Fixed-scope offerings with transparent pricing.'], ['Motion-first identity', 'Brands built for video-native channels.'], ['AI-augmented craft', 'Exploration at 10x with a human filter.'], ['Venture partnerships', 'Skin-in-the-game engagements with startups.']]},
  { key: 'edtech', label: 'Education', words: ['learn', 'course', 'student', 'teach', 'class', 'lesson', 'academy', 'school', 'curriculum', 'tutorial'],
    audience: ['lifelong learners', 'students', 'career switchers'],
    goal: 'make mastery feel addictive instead of arduous',
    problem: [['Courses are where motivation goes to die', 'Lecture playlists can’t compete with completion rates of games.'], ['Feedback arrives weeks too late', 'Without tight loops, errors fossilize.'], ['Credentials don’t map to capability', 'Employers trust proof of work, not certificates of attendance.']],
    workflow: [['Assess', 'Place every learner at the right starting line.'], ['Learn', 'Interactive lessons with immediate feedback.'], ['Practice', 'Projects that mirror the real job.'], ['Prove', 'Portfolio-grade work and verified skill badges.']],
    future: [['Adaptive curricula', 'Paths that reshape themselves per learner.'], ['AI tutors', 'Socratic help available at 3 a.m.'], ['Cohort sync', 'Live rooms that recreate classroom energy.'], ['Hiring pipelines', 'Direct bridges from coursework to interviews.']]},
  { key: 'marketing', label: 'Marketing Platform', words: ['marketing', 'seo', 'campaign', 'audience', 'growth', 'email', 'conversion', 'analytics', 'leads', 'brand'],
    audience: ['growth marketers', 'founders', 'content teams'],
    goal: 'make growth a system instead of a scramble',
    problem: [['Attribution is a beautiful lie', 'Channels fight for credit while the truth hides.'], ['Content velocity can’t keep up', 'Every campaign needs ten assets by yesterday.'], ['Data lives in silos', 'Analytics in one tab, spend in another, truth nowhere.']],
    workflow: [['Plan', 'Campaigns mapped to goals, not vibes.'], ['Produce', 'Asset creation with brand guardrails on.'], ['Launch', 'Multi-channel publishing from one calendar.'], ['Measure', 'Incrementality-aware reporting that ends arguments.']],
    future: [['Predictive audiences', 'Segments scored before a dollar is spent.'], ['Generative variations', 'On-brand creative at infinite scale.'], ['Journey orchestration', 'Cross-channel flows that adapt in-flight.'], ['Revenue attribution', 'Board-ready proof of marketing’s P&L.']]},
  { key: 'media', label: 'Media & Publication', words: ['news', 'article', 'story', 'magazine', 'journal', 'editorial', 'podcast', 'episode', 'author', 'read'],
    audience: ['curious readers', 'subscribers', 'industry insiders'],
    goal: 'turn attention into a durable relationship',
    problem: [['Feeds devour nuance', 'Algorithms reward outrage over insight.'], ['Ads taught readers to bounce', 'Cluttered pages train skim-and-leave behavior.'], ['Loyalty is hard to measure', 'Pageviews flatter; they don’t predict renewal.']],
    workflow: [['Pitch', 'Editorial calendars tied to audience signals.'], ['Craft', 'Stories edited for depth and clarity.'], ['Publish', 'Beautiful reading experiences on every device.'], ['Grow', 'Newsletters and memberships that compound.']],
    future: [['Audio editions', 'Every story narrated for the commute.'], ['Member communities', 'From readership to fellowship.'], ['Personal digests', 'AI-curated briefings from trusted voices.'], ['Live journalism', 'Real-time coverage rooms for big events.']]},
  { key: 'generic', label: 'Digital Product', words: [],
    audience: ['modern teams', 'ambitious builders', 'discerning customers'],
    goal: 'turn a strong idea into an experience people return to',
    problem: [['Attention is the scarcest currency', 'Most products get three seconds to make their case.'], ['Complexity compounds silently', 'Every undecided detail becomes user friction.'], ['Stories are told after the fact', 'Value stays invisible until someone packages it.']],
    workflow: [['Discover', 'Understand the landscape and the audience.'], ['Design', 'Shape the experience around one clear promise.'], ['Build', 'Ship with quality visible in every detail.'], ['Grow', 'Measure what matters and iterate in the open.']],
    future: [['Deeper personalization', 'Experiences that adapt to each visitor.'], ['Platform expansion', 'Adjacent use cases invited by the core.'], ['Community layer', 'Users connected to each other, not just the product.'], ['Intelligence everywhere', 'AI quietly removing effort at every step.']]},
];

const PERSONAS = [
  ['developer', 'developers'], ['engineer', 'engineering teams'], ['designer', 'designers'],
  ['team', 'collaborative teams'], ['enterprise', 'enterprises'], ['startup', 'startups'],
  ['creator', 'creators'], ['marketer', 'marketers'], ['founder', 'founders'],
  ['student', 'students'], ['small business', 'small businesses'], ['freelance', 'independent professionals'],
  ['research', 'researchers'], ['data', 'data teams'], ['security', 'security teams'], ['shop', 'online shoppers'],
];

function firstSentence(s, max = 220) {
  if (!s) return '';
  const m = s.match(/^(.{40,}?[.!?])(\s|$)/);
  const out = m ? m[1] : s;
  return out.length > max ? out.slice(0, max).replace(/\s\S*$/, '') + '…' : out;
}

function cleanTitleWord(t) {
  return t.replace(/\s+/g, ' ').replace(/^[\s\-—–|·]+|[\s\-—–|·]+$/g, '').trim();
}

export function buildUnderstanding({ x, subX, host }) {
  const cleanHost = (host || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
  const hostBrand = cleanHost.split('.')[0] || 'Brand';
  const defaultBrand = hostBrand.charAt(0).toUpperCase() + hostBrand.slice(1);

  const ogSite = x.meta?.['og:site_name'];
  let name = ogSite;
  if (!name || /denied|forbidden|access.*denied|cloudflare|error \d+|robot/i.test(name)) {
    const rawTitle = x.title || '';
    if (rawTitle && !/denied|forbidden|access.*denied|cloudflare|error \d+|robot|just a moment/i.test(rawTitle)) {
      const parts = rawTitle.split(/\s+[-|—–·:]\s+/);
      const cand = cleanTitleWord(parts[0]);
      if (cand && !cand.toLowerCase().startsWith('www') && cand.length >= 2 && cand.length <= 40) {
        name = cand;
      }
    }
  }
  if (!name || name.toLowerCase() === 'www' || name.toLowerCase().startsWith('www.')) {
    name = defaultBrand;
  }
  name = name.charAt(0).toUpperCase() + name.slice(1);

  const tagline = x.meta['og:description'] || x.meta['description'] || '';
  const allHeadings = [...x.headings, ...(subX || []).flatMap((s) => s.headings).slice(0, 24)];
  const allParas = [...x.paragraphs, ...(subX || []).flatMap((s) => s.paragraphs).slice(0, 10)];
  const corpus = [x.title, tagline, ...allHeadings.map((h) => h.text), ...allParas].join('. ').toLowerCase();

  let best = CATEGORIES[CATEGORIES.length - 1];
  let bestScore = 0;
  for (const c of CATEGORIES) {
    // short keywords must match on word boundaries ("ai" must not fire inside "domain")
    const sc = c.words.reduce((n, w) => n + (w.length <= 3 ? new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(corpus) : corpus.includes(w) ? 1 : 0), 0);
    if (sc > bestScore) { bestScore = sc; best = c; }
  }

  const audience = PERSONAS.filter(([kw]) => corpus.includes(kw)).map(([, p]) => p).slice(0, 4);
  if (audience.length === 0) audience.push(...best.audience.slice(0, 3));

  // features from real headings
  const seen = new Set();
  const features = [];
  for (const h of allHeadings) {
    if (h.level === 1) continue;
    const t = cleanTitleWord(h.text);
    const key = t.toLowerCase();
    if (!t || t.length < 3 || t.length > 64 || STOP_TITLES.test(t) || seen.has(key)) continue;
    if (/\d{4}|©|cookie|subscribe|newsletter/i.test(t)) continue;
    seen.add(key);
    const rel = allParas.find((p) => p.toLowerCase().includes(key.slice(0, 16)));
    features.push({ name: t, desc: rel ? firstSentence(rel, 150) : '' });
    if (features.length >= 6) break;
  }
  while (features.length < 4) {
    const w = best.workflow[features.length % best.workflow.length];
    features.push({ name: w[0], desc: w[1] });
  }

  const metricRe = /(\d+(?:\.\d+)?\s?(?:x|×|%|ms|hours?|minutes?|days?))/i;
  const benefits = [];
  for (const p of allParas) {
    if (!/\b(save|increase|reduce|grow|boost|launch|automate|ship|accelerate|eliminate|unlock|improve|cut|streamline|faster|less time)\b/i.test(p)) continue;
    const s = firstSentence(p, 180);
    if (benefits.some((b) => b.desc.slice(0, 40) === s.slice(0, 40))) continue;
    const m = s.match(metricRe);
    benefits.push({
      title: cleanTitleWord(s.split(/\b(?:save|increase|reduce|grow|boost|launch|automate|ship|accelerate|eliminate|unlock|improve|cut|streamline)\b/i)[0]).slice(0, 48) || 'Measurable outcomes',
      desc: s,
      metric: m ? m[1].replace(/\s+/g, '') : '',
    });
    if (benefits.length >= 4) break;
  }
  if (benefits.length === 0) {
    for (const [t, d] of best.problem.slice(0, 3)) benefits.push({ title: t.split('—')[0].trim().slice(0, 40), desc: d, metric: '' });
  }

  const usps = [];
  for (const p of allParas.concat(allHeadings.map((h) => h.text))) {
    if (!/\b(only|first|fastest|all-in-one|no credit card|free forever|world'?s first|#1|unmatched|zero[- ]config)\b/i.test(p)) continue;
    const s = firstSentence(p, 160);
    if (s.length > 30 && !usps.includes(s)) usps.push(s);
    if (usps.length >= 3) break;
  }
  if (usps.length === 0) usps.push(`Purpose-built for ${audience[0] || best.audience[0]}, not adapted from something else.`);

  const tech = x.tech.map((t) => t.name);
  const bangs = (corpus.match(/!/g) || []).length;
  const devWords = ['api', 'sdk', 'deploy', 'runtime', 'latency'].filter((w) => corpus.includes(w)).length;
  const tone = devWords >= 3 ? 'technical' : bangs >= 2 ? 'playful' : /enterprise|compliance|governance|mission-critical/.test(corpus) ? 'formal' : 'refined';

  const summary = firstSentence(allParas[0] || tagline || `${name} — a ${best.label.toLowerCase()} experience.`, 260);

  return {
    productName: name,
    tagline: tagline.slice(0, 180),
    category: best.label,
    summary,
    audience: [...new Set(audience)].slice(0, 4),
    businessGoal: best.goal,
    features: features.slice(0, 6),
    benefits: benefits.slice(0, 4),
    usps: usps.slice(0, 3),
    technology: tech.slice(0, 8),
    tone,
    host,
  };
}

// ---------------------------------------------------------------- analyze

export async function analyzeWebsite(rawUrl) {
  // ---------- SSRF gate: protocol, credentials, hostname, port, DNS ranges
  let start = (rawUrl || '').trim();
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(start)) {
    start = 'https://' + start;
  }
  const { host } = await validateTarget(start); // CrawlBlockedError codes bubble up

  // ---------- Multi-level crawl capture
  let capture = null;
  let captureMode = 'browser';
  let captureError = null;

  // Level 1: Try Playwright/Chromium rendered crawl
  try {
    capture = await crawlRendered(start, { pageLimit: CRAWL_LIMITS.pageLimit });
    if (!capture || !capture.pages || !capture.pages.length || !capture.pages[0].html || capture.pages[0].html.length < 50) {
      capture = null;
    }
  } catch (err) {
    captureError = err;
    capture = null;
  }

  let home;
  let pageDocs;
  let redirects = [];
  let capturedBuffer = null;
  const stages = new StageReport();

  if (capture && capture.pages && capture.pages.length) {
    pageDocs = capture.pages;
    const h = capture.pages[0];
    capturedBuffer = h.screenshotBuffer || null;
    home = {
      status: h.status || 200,
      ms: h.loadMs || 0,
      html: h.html || '',
      headers: normalizeResponseHeaders(h.headers),
      finalUrl: h.finalUrl || start,
    };
  } else {
    // Level 2: Fallback to fast validated HTTP fetch with realistic browser headers
    captureMode = 'document';
    const v = await fetchValidated(start, CRAWL_LIMITS);
    redirects = v.chain || [];
    if (!v.response) {
      throw new CrawlBlockedError('unreachable', { url: start, stage: 'http_fetch' });
    }
    home = {
      status: v.response.status,
      ms: v.response.ms,
      html: v.response.html || '',
      headers: v.response.headers || new Headers(),
      finalUrl: v.finalUrl || start,
    };
    pageDocs = [{
      url: v.finalUrl,
      finalUrl: v.finalUrl,
      status: v.response.status,
      loadMs: v.response.ms,
      html: v.response.html,
      consoleErrors: [],
      failedRequests: [],
      navError: null,
      screenshotBuffer: null,
    }];
  }

  console.log('[CRAWL_SUCCESS]', JSON.stringify({ host, mode: captureMode, status: home.status }));

  // Check for Bot Challenge / Cloudflare / WAF
  const isChallenge = detectBotChallenge(home.html, home.status, '');
  if (isChallenge) {
    throw new CrawlBlockedError('bot-challenge', {
      httpStatus: home.status,
      stage: 'bot_challenge_detection',
      url: start,
      finalUrl: home.finalUrl,
    });
  }

  // Check for explicit HTTP error responses on the main page
  if (home.status === 401) {
    throw new CrawlBlockedError('http-401', { httpStatus: 401, stage: 'http_response', url: start, finalUrl: home.finalUrl });
  }
  if (home.status === 403) {
    throw new CrawlBlockedError('http-403', { httpStatus: 403, stage: 'http_response', url: start, finalUrl: home.finalUrl });
  }
  if (home.status === 429) {
    throw new CrawlBlockedError('http-429', { httpStatus: 429, stage: 'http_response', url: start, finalUrl: home.finalUrl });
  }
  if (home.status >= 500) {
    throw new CrawlBlockedError('http-5xx', { httpStatus: home.status, stage: 'http_response', url: start, finalUrl: home.finalUrl });
  }

  // Check if completely empty
  if (!home.html || home.html.trim().length < 40) {
    throw new CrawlBlockedError('empty', { httpStatus: home.status, stage: 'content_extraction', url: start, finalUrl: home.finalUrl });
  }

  const url = home.finalUrl;
  const x = extractPage(home.html, url, host);
  x.tech = detectTech(home.html, home.headers);

  // ---------- subpages (browser mode already captured them; document mode validates + fetches)
  const h1of = (px) => (px.headings.find((hh) => hh.level === 1) || {}).text || '';
  const pathOf = (u) => {
    try {
      return new URL(u).pathname || '/';
    } catch {
      return '/';
    }
  };
  const pages = [
    { url: pageDocs[0].finalUrl, path: pathOf(pageDocs[0].finalUrl), title: x.title, h1: h1of(x), words: x.words, status: pageDocs[0].status, loadMs: pageDocs[0].loadMs, images: x.images.length, links: x.links.length },
  ];
  const subX = [];

  if (capture) {
    for (const doc of capture.pages.slice(1)) {
      const px = extractPage(doc.html, doc.finalUrl, host);
      subX.push(px);
      pages.push({ url: doc.finalUrl, path: pathOf(doc.finalUrl), title: doc.title || px.title, h1: h1of(px), words: px.words, status: doc.status, loadMs: doc.loadMs, images: px.images.length, links: px.links.length, navError: doc.navError });
    }
  } else {
    const skipPath = /login|signin|sign-in|signup|sign-up|auth|cart|checkout|account|unsubscribe/i;
    const internalUrls = [];
    const seenPath = new Set([pathOf(url)]);
    for (const l of x.links) {
      if (!l.internal) continue;
      const path = pathOf(l.url).replace(/\/$/, '') || '/';
      if (seenPath.has(path) || skipPath.test(path)) continue;
      seenPath.add(path);
      internalUrls.push(l.url);
      if (internalUrls.length >= CRAWL_LIMITS.pageLimit - 1) break;
    }
    const subResults = await Promise.allSettled(internalUrls.map((u) => secureSubFetch(u)));
    for (const r of subResults) {
      if (r.status !== 'fulfilled') continue;
      const px = extractPage(r.value.html, r.value.finalUrl, host);
      subX.push(px);
      pages.push({ url: r.value.finalUrl, path: pathOf(r.value.finalUrl), title: px.title, h1: h1of(px), words: px.words, status: r.value.status, loadMs: r.value.ms, images: px.images.length, links: px.links.length });
    }
  }

  // ---------- robots.txt — same-origin only, no redirect following
  const robots = await withTimeout(
    (async () => {
      try {
        await validateTarget(`https://${host}/robots.txt`);
        const r = await fetch(`https://${host}/robots.txt`, { headers: UA, redirect: 'manual', signal: AbortSignal.timeout(4500), dispatcher: safeDispatcher });
        const ok = r.ok;
        try {
          if (r.body) await r.body.cancel();
        } catch { /* stream closed */ }
        return ok;
      } catch {
        return false;
      }
    })(),
    6000,
    false
  );

  // ---------- live link probes — every target validated first; blocked ones recorded honestly
  const probeList = [...x.links.filter((l) => l.internal).slice(0, 8), ...x.links.filter((l) => !l.internal).slice(0, 4)];
  const probed = await Promise.all(
    probeList.map(async (l) => {
      try {
        await validateTarget(l.url);
      } catch {
        return { url: l.url, status: 0, ok: false, blocked: true };
      }
      try {
        let r = await fetch(l.url, { method: 'HEAD', redirect: 'manual', headers: UA, signal: AbortSignal.timeout(6000), dispatcher: safeDispatcher });
        if (r.status === 405 || r.status === 501) {
          r = await fetch(l.url, { method: 'GET', redirect: 'manual', headers: UA, signal: AbortSignal.timeout(6000), dispatcher: safeDispatcher });
        }
        try {
          if (r.body) await r.body.cancel();
        } catch { /* closed */ }
        return { url: l.url, status: r.status, ok: r.status < 400 };
      } catch {
        return { url: l.url, status: 0, ok: false };
      }
    })
  );

  const isPartial = pages.length <= 1 && x.words < 80;
  const crawlStatus = isPartial ? 'partial' : 'complete';
  const dataQuality = isPartial ? 'limited' : 'high';

  const homeDoc = pageDocs[0];
  const analysis = {
    fetchedAt: new Date().toISOString(),
    url,
    finalUrl: url,
    host,
    status: home.status,
    httpStatus: home.status,
    loadMs: home.ms,
    sizeKb: Math.round(home.html.length / 1024),
    title: x.title,
    description: x.meta.description || x.meta['og:description'] || '',
    language: x.lang || 'en',
    screenshot: capturedBuffer ? `data:image/jpeg;base64,${capturedBuffer.toString('base64')}` : (url ? `https://image.thum.io/get/width/1280/crop/720/${url}` : ''),
    captureMode,
    crawlStatus,
    dataQuality,
    pages,
    headings: x.headings.slice(0, 24),
    paragraphs: x.paragraphs.slice(0, 6),
    images: x.images.slice(0, 12),
    buttons: x.buttons || [],
    forms: x.forms || null,
    nav: x.nav || null,
    colors: x.colors,
    fonts: x.fonts,
    tech: x.tech,
    links: {
      internal: x.links.filter((l) => l.internal).length,
      external: x.links.filter((l) => !l.internal).length,
      probed,
    },
    redirects,
    consoleErrors: (homeDoc.consoleErrors || []).slice(0, CRAWL_LIMITS.maxConsoleEntries),
    failedRequests: (homeDoc.failedRequests || []).slice(0, CRAWL_LIMITS.maxFailedRequests),
  };

  // evidence-first audit — every finding carries measured proof
  x.rawHtml = home.html.slice(0, 300000); // head-region signals only, never persisted
  const probeBundle = capture && capture.probe
    ? { ...capture.probe, consoleErrors: homeDoc.consoleErrors || [], failedRequests: homeDoc.failedRequests || [], failedAssets: homeDoc.failedAssets || [], docResourceCount: (homeDoc.failedAssets || []).length }
    : null;
  let audit;
  try {
    audit = runAudit({ host, url, redirects, home, x, subX, pages, probed, robots, probe: probeBundle, captureMode });
    console.log('[SCORING_SUCCESS]', JSON.stringify({ host, overall: audit?.overall }));
  } catch (e) {
    stages.add('scoring', e && e.message ? e.message : 'unknown');
    console.warn('[SCORING_FAILED]', JSON.stringify({ host, error: e && e.message }));
    audit = { overall: 0, verdict: 'Unable to score — see stage failure', generatedAt: new Date().toISOString(), categories: [] };
  }

  // AI understanding runs last — it uses real extracted page data
  let understanding;
  try {
    console.log('[CREATIVE_BRIEF_START]', JSON.stringify({ host }));
    understanding = await understandWebsite({ x, subX, host, pages, probed, robots, home, redirects, audit, url, captureMode });
    understanding.__host = host;
    console.log('[CREATIVE_BRIEF_SUCCESS]', JSON.stringify({ host, engine: understanding.meta?.engine || 'rules+schema' }));
  } catch (e) {
    stages.add('creative-brief', e && e.message ? e.message : 'unknown');
    console.warn('[CREATIVE_BRIEF_FAILED]', JSON.stringify({ host, error: e && e.message ? e.message : 'unknown' }));
    understanding = fallbackBrief({ x, subX, host, pages, audit });
    understanding.__host = host;
    understanding.meta = {...(understanding.meta || {}), engine: 'rules+schema', attempts: 1, validated: true, factShare: 1, note: 'Brief recovered deterministically from measured website signals.', generatedAt: new Date().toISOString()};
  }

  // extract comprehensive visual DNA
  const visualDna = extractVisualDna(x, subX, host, probeBundle);
  analysis.visualDna = visualDna;
  const designSystem = generatePresentationDesignSystem(visualDna);

  // synthesize authentic 7-pillar Vistara DNA profile
  const vistaraDna = understanding?.dna || buildVistaraDNA({
    x,
    subX,
    host,
    pages,
    probed,
    visualDna,
    understanding,
    targetUrl: url,
  });
  analysis.dna = vistaraDna;
  if (understanding) understanding.dna = vistaraDna;

  // subpage screenshots collected during the rendered pass
  const pageShots = capture
    ? capture.pages
        .slice(1)
        .filter((p) => p.screenshotBuffer && p.status === 200)
        .map((p) => ({ path: pathOf(p.finalUrl), buffer: p.screenshotBuffer }))
    : [];

  if (stages.failed.length) analysis.failedStages = stages.failed;
  analysis.briefEngine = understanding?.meta?.engine || 'rules+schema';

  return { analysis, audit, understanding, dna: vistaraDna, suggestedAccent: designSystem.accent, visualDna, designSystem, screenshotBuffer: capturedBuffer, pageShots };
}

// ---------------------------------------------------------------- generation

/** Purpose taxonomy from the create flow — steers what the deck leads with. */
export const PURPOSE_META = {
  college: { kicker: 'College project', ctaLine: 'Presented with method, evidence and an honest scope.' },
  investor: { kicker: 'Investor briefing', ctaLine: 'The evidence is live — the ask is a pilot next quarter.' },
  client: { kicker: 'Client presentation', ctaLine: 'Confidence first; every detail is on call for the follow-up.' },
  'product-demo': { kicker: 'Product demo', ctaLine: 'The fastest pitch is the product itself — in motion.' },
  portfolio: { kicker: 'Portfolio review', ctaLine: 'Craft and range, carried end to end.' },
  general: { kicker: null, ctaLine: null },
};

/** Applies the intake purpose to a generated slide array (pure). */
export function applyPurposeToSlides(slides, purpose) {
  const meta = PURPOSE_META[purpose] || PURPOSE_META.general;
  if (!meta.kicker && !meta.ctaLine) return slides;
  return slides.map((s) => {
    if (s.type === 'hero' && meta.kicker) return { ...s, custom_label: meta.kicker };
    if (s.type === 'intro' && meta.kicker) {
      return { ...s, subtitle: [s.subtitle, meta.kicker].filter(Boolean).join(' · ') };
    }
    if (s.type === 'cta' && meta.ctaLine) return { ...s, body: meta.ctaLine };
    return s;
  });
}

/** Executes engine ops against Supabase — shared by /api/ai and /api/generate. */
export async function executeOps(supabase, projectId, ops) {
  for (const op of ops) {
    if (op.op === 'noop') continue;
    if (op.op === 'updateSlide') {
      const { error } = await supabase.from('slides').update(op.fields).eq('id', op.id);
      if (error) throw error;
    } else if (op.op === 'insertSlide') {
      const { id: _omit, ...row } = op.data;
      const { error } = await supabase.from('slides').insert(row);
      if (error) throw error;
    } else if (op.op === 'deleteSlide') {
      const { error } = await supabase.from('slides').delete().eq('id', op.id);
      if (error) throw error;
    } else if (op.op === 'updateProject') {
      if (Object.keys(op.fields).length) {
        const { error } = await supabase.from('projects').update(op.fields).eq('id', projectId);
        if (error) throw error;
      }
    } else if (op.op === 'reorder') {
      for (const u of op.updates) {
        const { error } = await supabase.from('slides').update({ sort_order: u.sort_order }).eq('id', u.id);
        if (error) throw error;
      }
    } else if (op.op === 'regenerate') {
      const { data: fresh, error: projectError } = await supabase.from('projects').select('*').eq('id', projectId).single();
      if (projectError) throw projectError;
      const { error: deleteError } = await supabase.from('slides').delete().eq('project_id', projectId);
      if (deleteError) throw deleteError;
      const gen = generateSlides(fresh);
      const { error: insertError } = await supabase.from('slides').insert(gen);
      if (insertError) throw insertError;
      const { error: statusError } = await supabase.from('projects').update({ status: 'generated' }).eq('id', projectId);
      if (statusError) throw statusError;
    }
  }
}

export const SECTION_LABELS = {
  hero: 'Cover', company: 'The Company', problem: 'The Challenge', solution: 'The Solution',
  features: 'Key Capabilities', howItWorks: 'How It Works', valueProposition: 'Value Proposition',
  audience: 'Who It Serves', ecosystem: 'Product Ecosystem', useCases: 'Use Cases',
  differentiation: 'What Sets It Apart', trust: 'Trust & Proof', pricing: 'Offering & Plans',
  story: 'The Story', opportunities: 'Future & Opportunities', conclusion: 'Conclusion',
  custom: 'Section',
  // Legacy types for backward compatibility
  intro: 'Introduction', workflow: 'Workflow', architecture: 'Architecture',
  benefits: 'Benefits', technology: 'Technology', future: 'Future Scope',
  cta: 'Call to Action', market: 'Market Position', businessValue: 'Business Value',
  growth: 'Growth', implementation: 'Adoption', impact: 'Impact',
};

const SECTION_ORDER = ['hero', 'company', 'problem', 'solution', 'features', 'howItWorks', 'ecosystem', 'valueProposition', 'differentiation', 'opportunities', 'conclusion'];

/** Which story arc the deck takes — decided by the presentation purpose. */
export const PURPOSE_ARCS = {
  college:        ['hero', 'company', 'problem', 'solution', 'features', 'howItWorks', 'ecosystem', 'story', 'conclusion'],
  investor:       ['hero', 'company', 'problem', 'solution', 'differentiation', 'valueProposition', 'audience', 'useCases', 'trust', 'opportunities', 'conclusion'],
  client:         ['hero', 'company', 'problem', 'solution', 'features', 'howItWorks', 'valueProposition', 'trust', 'conclusion'],
  'product-demo': ['hero', 'solution', 'howItWorks', 'features', 'useCases', 'valueProposition', 'conclusion'],
  portfolio:      ['hero', 'company', 'features', 'ecosystem', 'useCases', 'trust', 'conclusion'],
  general:        SECTION_ORDER,
};

function resolveArc(purpose, u) {
  const base = PURPOSE_ARCS[purpose] || SECTION_ORDER;
  if (purpose === 'general' && u && u.__storyArc && Array.isArray(u.__storyArc)) {
    const known = new Set([...SECTION_ORDER, 'company', 'howItWorks', 'valueProposition', 'audience', 'ecosystem', 'useCases', 'differentiation', 'trust', 'pricing', 'story', 'opportunities', 'conclusion', 'market', 'businessValue', 'growth', 'implementation', 'impact', 'intro', 'workflow', 'architecture', 'benefits', 'technology', 'future', 'cta']);
    const allowed = u.__storyArc.filter((s) => known.has(s));
    if (allowed.length >= 6) return ['hero', ...allowed.filter((s) => s !== 'hero' && s !== 'conclusion' && s !== 'cta'), 'conclusion'];
  }
  return base;
}

/* concise = measurable rewrite rules: kill hedges, cap lengths, keep claims grounded */
export function tight(s, max) {
  if (!s) return '';
  let t = String(s)
    .replace(/\b(very|really|just|actually|basically|simply|quite)\s+/gi, '')
    .replace(/\b(lots of|a lot of)\b/gi, 'plenty of')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const cut = t.split(/(?<=[.!?])\s+/)[0] || t;
  if (cut.length <= max) return cut;
  return cut.slice(0, max).replace(/\s\S*$/, '').replace(/[,;:]$/, '') + '…';
}

function catOf(u) {
  return CATEGORIES.find((c) => c.label === u.category) || CATEGORIES[CATEGORIES.length - 1];
}

function gradLast(title) {
  const words = (title || '').split(/\s+/);
  if (words.length < 2) return `*${title}*`;
  const last = words.pop();
  return `${words.join(' ')} *${last}*`;
}

export function buildSlide(type, u, a, au, order, overrides = {}, visualDna = {}, usedVisualUrls = new Set(), options = {}) {
  const cat = catOf(u);
  const aud = Array.isArray(u.audience) && u.audience.length ? u.audience : (cat.audience || ['modern teams']);
  const usps = Array.isArray(u.usps) && u.usps.length ? u.usps : [`Purpose-built for ${aud[0]}`];
  const pName = u.productName || 'The Platform';
  const base = { id: overrides.id || randomUUID(), type, sort_order: order, title: '', subtitle: '', body: '', bullets: [], stats: [], image_url: '', visualDecision: null, layout: 'left', animation: 'fade', theme_override: null, ...overrides };

  let slideResult;
  switch (type) {
    // 1. Cover / Hero
    case 'hero': {
      const realMetrics = (u.benefits || []).filter((b) => b.metric).slice(0, 3).map((b) => ({ value: b.metric, label: tight(b.title, 34) }));
      slideResult = {
        ...base,
        layout: a.screenshot ? 'split' : 'center',
        animation: 'stagger',
        title: gradLast(pName),
        subtitle: u.tagline || (u.summary ? firstSentence(u.summary, 110) : `Built for ${aud[0] || 'modern teams'}.`),
        body: u.summary ? firstSentence(u.summary, 220) : '',
        stats: realMetrics.length > 0 ? realMetrics : [
          { value: u.category || 'Platform', label: 'Category' },
          { value: aud[0] || 'Modern teams', label: 'Designed for' },
          { value: 'Verified', label: 'Core promise' },
        ],
        image_url: a.screenshot || '',
      };
      break;
    }

    // 2. The Company / Product
    case 'company':
    case 'intro': {
      const segList = (u.segments || []).map((s) => s.name || s).filter(Boolean);
      slideResult = {
        ...base,
        layout: 'split',
        animation: 'stagger',
        title: gradLast(`About ${pName}`),
        subtitle: u.tagline || u.category || 'Product Overview',
        body: u.summary || `${pName} is a dedicated ${u.category || 'platform'} engineered to ${u.businessGoal || 'streamline execution and deliver breakthrough outcomes'}.`,
        bullets: [
          `Category focus — ${u.category || 'Digital Solution'}${u.subcategory ? ` · ${u.subcategory}` : ''}`,
          `Target audience — Designed specifically for ${aud.slice(0, 3).join(', ') || 'modern teams'}`,
          `Core mission — ${u.businessGoal || 'Empower teams with unified, intuitive tools'}`,
          `Key advantage — ${usps[0] || 'Engineered from the ground up for peak efficiency'}`,
        ],
        stats: [
          { value: u.category || 'Platform', label: 'Category' },
          { value: aud[0] || 'Teams', label: 'Primary user' },
          { value: (u.features || []).length > 0 ? `${u.features.length}+` : 'Integrated', label: 'Capabilities' },
        ],
      };
      break;
    }

    // 3. The Problem
    case 'problem': {
      const probItems = cat.problem && cat.problem.length ? cat.problem.map(([t, d]) => `${t} — ${d}`) : [
        'Fragmented toolchains — Critical workflows are scattered across disconnected apps and tabs',
        'Operational friction — Valuable hours are lost to manual coordination and administrative overhead',
        'Slow time-to-value — Complex setups and steep learning curves delay meaningful outcomes',
      ];
      slideResult = {
        ...base,
        layout: 'grid',
        animation: 'stagger',
        title: gradLast('The challenge'),
        subtitle: `Why current approaches hold ${aud[0] || 'teams'} back`,
        body: `Traditional workflows create friction, fragment communication, and slow down execution before real value is ever realized.`,
        bullets: probItems.slice(0, 4),
      };
      break;
    }

    // 4. The Solution
    case 'solution': {
      const solBullets = (u.differentiators && u.differentiators.length > 0 ? u.differentiators.map((d) => d.text || d) : usps).slice(0, 4);
      slideResult = {
        ...base,
        layout: 'split',
        animation: 'stagger',
        title: gradLast(`The ${pName} solution`),
        subtitle: firstSentence(u.tagline || u.businessGoal || 'A unified platform built for modern demands', 110),
        body: `${pName} reframes the entire experience around one core promise: ${u.businessGoal || 'effortless productivity and reliable execution'}.`,
        bullets: solBullets.length > 0 ? solBullets.map((s) => s.includes('—') ? s : `Core advantage — ${s}`) : [
          `Unified workflow — Consolidates critical tasks into a single intuitive interface`,
          `High velocity — Engineered to reduce cycle times and eliminate bottlenecks`,
          `Scalable architecture — Built to grow seamlessly alongside your organization`,
        ],
      };
      break;
    }

    // 5. Key Features / Capabilities
    case 'features': {
      const featList = (u.features && u.features.length > 0 ? u.features : cat.workflow.map(([t, d]) => ({ name: t, desc: d }))).slice(0, 6);
      slideResult = {
        ...base,
        layout: 'grid',
        animation: 'stagger',
        title: gradLast('Key capabilities'),
        subtitle: 'Core capabilities discovered across the platform',
        body: `Every capability in ${pName} is purpose-built to accelerate team velocity and simplify execution.`,
        bullets: featList.map((f) => `${f.name} — ${f.desc || 'Engineered for seamless performance and immediate utility.'}`),
      };
      break;
    }

    // 6. How It Works
    case 'howItWorks':
    case 'workflow': {
      const flowItems = cat.workflow && cat.workflow.length ? cat.workflow.map(([t, d], i) => `0${i + 1} ${t} — ${d}`) : [
        '01 Onboard — Quick setup and seamless integration with existing tools',
        '02 Configure — Define preferences, set up workflows, and invite teammates',
        '03 Execute — The platform powers execution with built-in automation and clarity',
        '04 Scale — Track progress, refine processes, and expand across teams',
      ];
      slideResult = {
        ...base,
        layout: 'center',
        animation: 'slide',
        title: gradLast('How it works'),
        subtitle: 'A clear, friction-free journey from start to finish',
        body: `Getting started is intuitive and delivers immediate clarity from the first session.`,
        bullets: flowItems.slice(0, 4),
      };
      break;
    }

    // 7. Value Proposition
    case 'valueProposition':
    case 'benefits': {
      const metrics = (u.benefits || []).filter((b) => b.metric).map((b) => ({ value: b.metric, label: tight(b.title, 34) }));
      const qualStats = [
        { value: 'Speed', label: 'Accelerated execution' },
        { value: 'Clarity', label: 'Zero friction workflows' },
        { value: 'Reliability', label: 'Enterprise-grade uptime' },
      ];
      const benBullets = (u.benefits && u.benefits.length > 0 ? u.benefits : [
        { title: 'Accelerated Velocity', desc: 'Reduce cycle times and eliminate operational bottlenecks.' },
        { title: 'Reduced Overhead', desc: 'Automate manual steps and focus team energy on high-leverage work.' },
        { title: 'Consistent Execution', desc: 'Standardize quality and outcomes across every project.' },
      ]).slice(0, 4);

      slideResult = {
        ...base,
        layout: 'center',
        animation: 'stagger',
        title: gradLast('Value proposition'),
        subtitle: `Measurable advantages delivered by ${pName}`,
        body: u.benefits && u.benefits[0] ? u.benefits[0].desc : `${pName} delivers compound efficiency and dependable returns across your entire workflow.`,
        bullets: benBullets.map((b) => `${b.title} — ${b.desc || 'Delivers continuous value and measurable impact.'}`),
        stats: metrics.length > 0 ? metrics.slice(0, 3) : qualStats,
      };
      break;
    }

    // 8. Who It Is For
    case 'audience': {
      const audBullets = aud.slice(0, 4).map((aItem) => `${aItem} — Tailored tools and specialized workflows designed to solve daily operational bottlenecks.`);
      slideResult = {
        ...base,
        layout: 'grid',
        animation: 'stagger',
        title: gradLast('Who it is for'),
        subtitle: `Built to empower modern professionals and growing teams`,
        body: `${pName} is designed to meet the distinct operational needs of specialized roles and collaborative teams.`,
        bullets: audBullets.length > 0 ? audBullets : [
          `Startups & Builders — Rapid deployment and minimal configuration to get ideas live quickly`,
          `Operators & Teams — Centralized workflows that keep all stakeholders aligned and moving`,
          `Enterprise Organizations — Robust governance, security, and scalable infrastructure`,
        ],
      };
      break;
    }

    // 9. Product / Service Ecosystem
    case 'ecosystem':
    case 'architecture':
    case 'technology': {
      const techList = (a.tech && a.tech.length > 0 ? a.tech.map((t) => `${t.name} (${t.category})`) : (u.technology || [])).slice(0, 4);
      slideResult = {
        ...base,
        layout: 'left',
        animation: 'stagger',
        title: gradLast('Product ecosystem'),
        subtitle: 'A dependable, modern platform architecture',
        body: `${pName} runs on a high-performance foundation engineered for security, reliability, and developer velocity.`,
        bullets: [
          `Core engine — Real-time processing and modular architecture designed for agility`,
          `Seamless integrations — Connects effortlessly into your existing software environment`,
          `Enterprise security — Engineered with privacy, data protection, and resilience from day one`,
          `Extensible platform — Flexible configuration and APIs that adapt to expanding requirements`,
        ],
        stats: [
          { value: 'Modern', label: 'Stack foundation' },
          { value: 'Resilient', label: 'Security posture' },
          { value: 'Scalable', label: 'Growth ready' },
        ],
      };
      break;
    }

    // 10. Use Cases
    case 'useCases': {
      slideResult = {
        ...base,
        layout: 'grid',
        animation: 'stagger',
        title: gradLast('Target use cases'),
        subtitle: `How teams achieve breakthrough results with ${pName}`,
        body: `From day-to-day coordination to mission-critical execution, the platform adapts to diverse business scenarios.`,
        bullets: [
          `Workflow standardization — Establishing unified processes that eliminate confusion and duplicative effort`,
          `Cross-functional collaboration — Aligning diverse team members with clear visibility and shared context`,
          `Rapid execution — Compressing the time required to take projects from concept to completion`,
          `Scalable operations — Expanding team capacity without proportional increases in operational overhead`,
        ],
      };
      break;
    }

    // 11. Differentiation
    case 'differentiation': {
      const diffList = (u.differentiators && u.differentiators.length > 0 ? u.differentiators.map((d) => d.text || d) : usps).slice(0, 3);
      slideResult = {
        ...base,
        layout: 'grid',
        animation: 'stagger',
        title: gradLast('What sets it apart'),
        subtitle: 'A distinctive approach grounded in core principles',
        body: `${pName} stands out through thoughtful design, robust capability, and a relentless focus on user outcomes.`,
        bullets: diffList.map((s2) => `${s2.split('—')[0].trim()} — ${s2.includes('—') ? s2.split('—')[1].trim() : 'Purpose-built for modern demands.'}`),
      };
      break;
    }

    // 12. Trust / Proof
    case 'trust':
    case 'testimonials': {
      const trustBullets = (u.keyMessages && u.keyMessages.length > 0 ? u.keyMessages : usps).slice(0, 4);
      slideResult = {
        ...base,
        layout: 'center',
        animation: 'stagger',
        title: gradLast('Trust & proof'),
        subtitle: 'Proven performance and dependable capability',
        body: `Built for operators who demand dependable execution, transparent principles, and uncompromised quality.`,
        bullets: trustBullets.length > 0 ? trustBullets.map((m) => m.includes('—') ? m : `Verified capability — ${m}`) : [
          `Reliable performance — Consistent availability and swift responsiveness under heavy load`,
          `Data privacy & protection — Industry-standard security practices safeguarding your assets`,
          `Continuous evolution — Regular updates and feature enhancements driven by user feedback`,
        ],
        stats: [
          { value: 'Verified', label: 'Platform trust' },
          { value: 'Secure', label: 'Data safeguards' },
          { value: 'Active', label: 'Continuous updates' },
        ],
      };
      break;
    }

    // 13. Pricing / Offering
    case 'pricing': {
      slideResult = {
        ...base,
        layout: 'grid',
        animation: 'stagger',
        title: gradLast('Offering & plans'),
        subtitle: 'Flexible options designed to support every stage of growth',
        body: `Choose the model that fits your organization's scope, requirements, and long-term vision.`,
        bullets: [
          `Starter tier — Essential tools and access to get moving quickly with zero friction`,
          `Professional tier — Full suite of advanced capabilities, deeper controls, and team features`,
          `Enterprise tier — Custom scale, dedicated support, and enterprise-grade security controls`,
        ],
      };
      break;
    }

    // 14. Business / Product Story
    case 'story': {
      slideResult = {
        ...base,
        layout: 'split',
        animation: 'stagger',
        title: gradLast('The story'),
        subtitle: `Why ${pName} exists and what we are building`,
        body: u.summary || u.suggestedNarrative || `${pName} was built to eliminate the unnecessary friction that holds ambitious teams back from achieving their full potential.`,
        bullets: [
          `The vision — Creating a modern environment where work moves forward effortlessly`,
          `The approach — Purpose-built tools that prioritize speed, clarity, and reliability`,
          `The momentum — Constantly refining capabilities based on real-world team feedback`,
        ],
      };
      break;
    }

    // 15. Future / Opportunities
    case 'opportunities':
    case 'future': {
      const futBullets = cat.future && cat.future.length ? cat.future.map(([t, d]) => `${t} — ${d}`) : [
        'Deeper intelligence — Expanding automated assistance across complex multi-step workflows',
        'Broader ecosystem — Seamless integrations with adjacent tools and partner platforms',
        'Enhanced collaboration — Real-time multi-party synchronization and shared workspaces',
      ];
      slideResult = {
        ...base,
        layout: 'left',
        animation: 'slide',
        title: gradLast('Where it goes next'),
        subtitle: 'A strategic product roadmap driven by customer momentum',
        body: `Continuous innovation focused on unlocking higher productivity and broader platform capabilities.`,
        bullets: futBullets.slice(0, 4),
      };
      break;
    }

    // 16. Conclusion / Call to Action
    case 'conclusion':
    case 'cta': {
      slideResult = {
        ...base,
        layout: 'center',
        animation: 'zoom',
        title: gradLast(`Experience ${pName}`),
        subtitle: 'The best pitch is the product itself',
        body: `Explore ${u.host || 'the platform'} and discover what ${pName} can do for your team.`,
        bullets: [
          `Purpose-built — Designed specifically for ${aud[0] || 'modern teams'}`,
          `Immediate clarity — Rapid time-to-value from day one`,
          `Scalable foundation — Ready to grow alongside your organization`,
        ],
        stats: [
          { value: u.host || 'Get Started', label: 'Explore live' },
          { value: 'Active', label: 'Platform status' },
        ],
      };
      break;
    }

    // Additional specific arcs (investor / client / demo)
    case 'market': {
      slideResult = {
        ...base,
        layout: 'split',
        title: gradLast('Market position'),
        subtitle: `How ${pName} serves the modern ecosystem`,
        body: `${pName} operates as a dedicated ${(u.category || 'product').toLowerCase()} tailored for ${aud.slice(0, 2).join(' and ') || 'its core users'}.`,
        bullets: [
          `Target audience — ${aud[0] || 'Modern teams and operators'}`,
          `Category focus — ${u.category || 'Digital innovation'}`,
          `Core mission — ${u.businessGoal || 'Empower teams to achieve peak performance'}`,
        ],
        stats: [
          { value: u.category || 'Focused', label: 'Category' },
          { value: aud[0] || 'Teams', label: 'Primary audience' },
        ],
      };
      break;
    }

    case 'businessValue': {
      const metrics = (u.benefits || []).filter((b) => b.metric).map((b) => ({ value: b.metric, label: tight(b.title, 30) }));
      slideResult = {
        ...base,
        layout: 'center',
        animation: 'stagger',
        title: gradLast('Business value'),
        subtitle: 'Measurable advantages for growing teams',
        body: u.benefits && u.benefits[0] ? u.benefits[0].desc : `${pName} delivers clear, compound returns across your entire workflow.`,
        bullets: [
          `Immediate time-to-value — Accelerate delivery without protracted onboarding`,
          `Operational cost savings — Streamline processes and eliminate duplicative tooling`,
          `Consistent quality — Reliable outcomes that scale with organizational growth`,
        ],
        stats: metrics.length > 0 ? metrics.slice(0, 3) : [
          { value: 'Impact', label: 'Immediate value delivery' },
          { value: 'Efficiency', label: 'Eliminates repetitive tasks' },
          { value: 'Confidence', label: 'Built for enterprise trust' },
        ],
      };
      break;
    }

    case 'growth': {
      slideResult = {
        ...base,
        layout: 'left',
        animation: 'slide',
        title: gradLast('Growth trajectory'),
        subtitle: 'Expanding capabilities and long-term vision',
        bullets: cat.future.map(([t, d]) => `${t} — ${d}`),
        stats: [
          { value: 'Continuous', label: 'Feature velocity' },
          { value: 'Scalable', label: 'Platform growth' },
        ],
      };
      break;
    }

    case 'implementation': {
      slideResult = {
        ...base,
        layout: 'left',
        title: gradLast('Seamless adoption'),
        subtitle: 'Getting started takes minutes, not months',
        bullets: [
          `01 Fast setup — Connect your workflow and configure preferences instantly`,
          `02 Immediate value — Experience automated improvements on day one`,
          `03 Team rollout — Invite members and collaborate with intuitive controls`,
          `04 Ongoing scale — Adapt rules and capabilities as your organization grows`,
        ],
        stats: [
          { value: 'Zero-friction', label: 'Onboarding' },
          { value: 'Intuitive', label: 'Team adoption' },
        ],
      };
      break;
    }

    case 'impact': {
      const metrics = (u.benefits || []).filter((b) => b.metric).map((b) => ({ value: b.metric, label: tight(b.title, 30) }));
      slideResult = {
        ...base,
        layout: 'center',
        animation: 'stagger',
        title: gradLast('Proven impact'),
        subtitle: 'Transforming how teams operate and ship',
        body: u.benefits && u.benefits[0] ? u.benefits[0].desc : `Discover the compound advantages of a purpose-built platform.`,
        bullets: [
          `Faster cycle times — Accelerate decision-making and execution speed`,
          `Higher team focus — Eliminate cognitive friction and busywork`,
          `Predictable outcomes — Achieve consistent, high-standard deliverables`,
        ],
        stats: metrics.length > 0 ? metrics.slice(0, 3) : [
          { value: 'Velocity', label: 'Faster cycle times' },
          { value: 'Focus', label: 'Less friction' },
          { value: 'Quality', label: 'Consistent execution' },
        ],
      };
      break;
    }

    default:
      slideResult = {
        ...base,
        type: 'custom',
        title: gradLast(overrides.title || 'Overview'),
        subtitle: overrides.subtitle || u.category || 'Platform highlights',
        body: overrides.body || firstSentence(u.summary || u.tagline || 'Engineered for modern teams.', 200),
        bullets: overrides.bullets || (u.features || []).slice(0, 4).map((f) => `${f.name} — ${f.desc || 'Core capability of the platform.'}`),
      };
      break;
  }

  // Automatic Visual Intelligence selection (only using website screenshots & company visuals)
  const visualDecision = decideSlideVisual(slideResult, { analysis: a, understanding: u, ...overrides }, visualDna, usedVisualUrls, options);
  slideResult.visualDecision = visualDecision;
  if (visualDecision.url && !slideResult.image_url) {
    slideResult.image_url = visualDecision.url;
  }
  if (visualDecision.placement === 'browser' || visualDecision.placement === 'split') {
    slideResult.layout = 'split';
  }

  return slideResult;
}

/** Quality check & auto-repair gate before deck persistence. */
export function validateAndRepairDeck(slides, designSystem = null, project = null) {
  const result = critiqueAndRepairDeck(slides, designSystem, project);
  return result.slides;
}

export { critiqueAndRepairDeck, analyzeDeckQuality, analyzeSlideQuality };

export function generateSlides(project, purpose = 'general', options = {}) {
  // understanding.v2 (rich, fact-tagged) → flat working shape for the composer
  const uRaw = project.understanding;
  const u = uRaw && uRaw.schemaVersion === 'understanding.v2' ? flattenUnderstanding(uRaw) : uRaw;
  if (uRaw && uRaw.story && Array.isArray(uRaw.story.sectionArc)) u.__storyArc = uRaw.story.sectionArc;
  const a = project.analysis || { pages: [], tech: [] };
  const visualDna = a.visualDna || extractVisualDna(a, [], a.host || project.url);
  const designSystem = generatePresentationDesignSystem(visualDna, project.theme?.skin, project.intake?.design_prompt);
  const arc = resolveArc(purpose, u);
  const usedVisualUrls = new Set();
  const built = arc.map((type, i) =>
    buildSlide(type, u, a, null, (i + 1) * 10, { project_id: project.id }, visualDna, usedVisualUrls, options)
  );
  return validateAndRepairDeck(built, designSystem, project);
}

// ---------------------------------------------------------------- NL commands

const SECTION_SYNONYMS = {
  hero: 'hero', cover: 'hero', home: 'hero', landing: 'hero', title: 'hero',
  company: 'company', about: 'company', overview: 'company', intro: 'company', introduction: 'company', summary: 'company',
  problem: 'problem', pain: 'problem', challenge: 'problem', challenges: 'problem',
  solution: 'solution', product: 'solution', answer: 'solution',
  feature: 'features', features: 'features', capabilities: 'features',
  howitworks: 'howItWorks', workflow: 'howItWorks', process: 'howItWorks', steps: 'howItWorks', journey: 'howItWorks',
  value: 'valueProposition', valueproposition: 'valueProposition', benefit: 'valueProposition', benefits: 'valueProposition', why: 'valueProposition',
  audience: 'audience', who: 'audience', customers: 'audience', users: 'audience',
  ecosystem: 'ecosystem', architecture: 'ecosystem', system: 'ecosystem', infra: 'ecosystem', tech: 'ecosystem', technology: 'ecosystem', stack: 'ecosystem', platform: 'ecosystem',
  usecases: 'useCases', usecase: 'useCases', cases: 'useCases',
  differentiation: 'differentiation', unique: 'differentiation', competitive: 'differentiation',
  trust: 'trust', proof: 'trust', testimonial: 'trust', testimonials: 'trust', social: 'trust',
  pricing: 'pricing', plans: 'pricing', offering: 'pricing',
  story: 'story', narrative: 'story', mission: 'story',
  opportunities: 'opportunities', future: 'opportunities', roadmap: 'opportunities', vision: 'opportunities', next: 'opportunities',
  conclusion: 'conclusion', closing: 'conclusion', end: 'conclusion', cta: 'conclusion', contact: 'conclusion', action: 'conclusion',
  team: 'team', faq: 'faq', metrics: 'metrics', numbers: 'metrics',
};

const PALETTE_WORDS = {
  lime: ['#65A30D', '#1A2E05'], sage: ['#6B8E5A', '#3E5C3A'],
  violet: ['#7C5CFF', '#22D3EE'], purple: ['#A855F7', '#22D3EE'], ultraviolet: ['#7C5CFF', '#22D3EE'],
  emerald: ['#10B981', '#A3E635'], green: ['#10B981', '#A3E635'], forest: ['#34D399', '#FDE68A'],
  azure: ['#3B82F6', '#22D3EE'], blue: ['#3B82F6', '#22D3EE'], ocean: ['#0EA5E9', '#6366F1'],
  cyan: ['#22D3EE', '#818CF8'], teal: ['#14B8A6', '#38BDF8'],
  crimson: ['#F43F5E', '#FB923C'], red: ['#F43F5E', '#FB923C'], scarlet: ['#EF4444', '#F59E0B'],
  rose: ['#FB7185', '#C084FC'], pink: ['#F472B6', '#A78BFA'], magenta: ['#E879F9', '#FB7185'],
  gold: ['#F5B453', '#FB7185'], champagne: ['#F5B453', '#F59E0B'], amber: ['#F59E0B', '#F97316'], copper: ['#F97316', '#FBBF24'], orange: ['#FB923C', '#FDE047'],
  mono: ['#E4E4E7', '#71717A'], monochrome: ['#E4E4E7', '#71717A'], silver: ['#CBD5E1', '#64748B'],
  lime: ['#A3E635', '#34D399'], indigo: ['#6366F1', '#38BDF8'],
};


const FORMAL_REPL = [
  [/\bcan't\b/gi, 'cannot'], [/\bwon't\b/gi, 'will not'], [/\bdon't\b/gi, 'do not'],
  [/\bit's\b/gi, 'it is'], [/\blet's\b/gi, 'let us'], [/\bget\b/gi, 'obtain'],
  [/\bawesome|amazing\b/gi, 'exceptional'], [/\bstuff\b/gi, 'materials'], [/!+/g, '.'],
];
const PUNCHY_REPL = [
  [/\b(very|really|just|actually|basically|simply)\s+/gi, ''],
  [/\s+,/g, ','], [/!+/g, '.'],
];

function shortenText(t, max = 110) {
  if (!t) return t;
  const s = t.split(/(?<=[.!?])\s+/)[0] || t;
  return s.length > max ? s.slice(0, max).replace(/\s\S*$/, '') + '…' : s;
}
function applyRepl(text, repls) {
  let t = text;
  for (const [re, to] of repls) t = (t || '').replace(re, to);
  return t.replace(/\s{2,}/g, ' ').trim();
}

function findSlide(slides, kw) {
  if (!kw) return null;
  const key = SECTION_SYNONYMS[kw] || kw;
  return (
    slides.find((s) => s.type === key) ||
    slides.find((s) => (s.title || '').toLowerCase().replace(/\*/g, '').includes(kw.toLowerCase())) ||
    null
  );
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function applyCommand(project, slidesIn, rawCmd) {
  const cmd = (rawCmd || '').trim();
  const c = cmd.toLowerCase().replace(/[?.!]+$/, '');
  const ops = [];
  const changes = [];
  let reply = '';
  const slides = [...slidesIn].sort((a, b) => a.sort_order - b.sort_order);
  const theme = { ...(project.theme || {}) };
  const u = { ...(project.understanding || {}) };
  const push = (op, msg) => { ops.push(op); changes.push(msg); };

  const targetMatch = c.match(/(?:the\s+)?(hero|cover|intro|introduction|about|overview|problem|pain|solution|product|features?|workflow|process|architecture|system|benefits?|value|outcomes|tech|technology|stack|future|roadmap|cta|closing|testimonials?|pricing|team|faq|metrics)\s+(?:slide|section|page)/);
  const numMatch = c.match(/\b(?:slide|section|page)\s*(?:#|no\.?|num(?:ber)?)?\s*(\d+)\b/i) || c.match(/\b(\d+)(?:st|nd|rd|th)\s*(?:slide|section|page)\b/i);
  let target = targetMatch ? findSlide(slides, targetMatch[1]) : null;
  if (!target && numMatch) {
    const idx = parseInt(numMatch[1], 10) - 1;
    if (idx >= 0 && idx < slides.length) target = slides[idx];
  }
  const tname = target ? (target.title || target.type).replace(/\*/g, '') : null;

  // --- ✦ AI Redesign & comprehensive deck polish
  if (/\b(ai redesign|redesign deck|redesign slide|redesign the entire deck|make the entire deck more premium|make it more premium|polish deck|full redesign)\b/.test(c)) {
    const visualDna = project.analysis?.visualDna || extractVisualDna(project.analysis || {}, [], project.url);
    const bespokeSystem = generatePresentationDesignSystem(visualDna, theme.skin || 'dark', project.intake?.design_prompt);
    theme.accent = bespokeSystem.accent;
    theme.accent2 = bespokeSystem.accent2;
    theme.headingFont = bespokeSystem.headingFont;
    theme.bodyFont = bespokeSystem.bodyFont;
    theme.motion = bespokeSystem.motion;
    theme.radius = bespokeSystem.radius;

    push({ op: 'updateProject', fields: { theme } }, '✦ AI Redesign: Synchronized bespoke design system & Visual DNA');

    const repairedSlides = validateAndRepairDeck(slides, bespokeSystem, project);
    for (const rs of repairedSlides) {
      push({ op: 'updateSlide', id: rs.id, fields: { title: rs.title, subtitle: rs.subtitle, body: rs.body, bullets: rs.bullets, stats: rs.stats, layout: rs.layout } }, null);
    }
    reply = '✦ AI Redesign complete: Harmonized brand palette, elevated typography hierarchy, eliminated clutter, enriched visuals, and verified 100% 16:9 safe-canvas layout.';
    return { ops, changes, reply };
  }

  // --- Purpose and audience reframing (investor / college / client / demo / portfolio)
  const purpMatch = c.match(/\b(?:make (?:this|it|the deck)|suit(?:able)? for|convert to|tailor for|pitch to|present to)\s+(?:an?\s+)?(investor|client|college|demo|product demo|portfolio|competition)\b/i) || c.match(/\b(investor|client|college|demo|portfolio|competition)\s+(?:focused|pitch|deck|presentation|mode)\b/i);
  if (purpMatch) {
    const rawPurp = purpMatch[1].toLowerCase();
    const purpose = rawPurp.includes('investor') ? 'investor' : rawPurp.includes('client') ? 'client' : rawPurp.includes('college') || rawPurp.includes('competition') ? 'college' : rawPurp.includes('demo') ? 'product-demo' : rawPurp.includes('portfolio') ? 'portfolio' : 'general';
    theme.motion = purpose === 'investor' ? 'elegant' : purpose === 'college' ? 'snappy' : 'smooth';
    push({ op: 'updateProject', fields: { theme } }, `Configured deck for ${purpose} presentation`);
    push({ op: 'regenerate' }, `Regenerated narrative arc for ${purpose}`);
    reply = `Deck tailored for a ${purpose} audience. Narrative reframed with dedicated ${purpose === 'investor' ? 'market position, business value and growth trajectory' : 'problem, solution, workflow and impact'} sections.`;
    return { ops, changes, reply };
  }

  // --- Luxury Technology & Apple aesthetic prompts
  if (/\b(luxury technology|luxury tech|luxury presentation|luxurious|prestige|expensive)\b/.test(c)) {
    theme.skin = 'dark';
    theme.accent = '#10B981';
    theme.accent2 = '#34D399';
    theme.headingFont = 'Instrument Serif';
    theme.bodyFont = 'Inter';
    theme.motion = 'cinematic';
    theme.radius = 18;
    push({ op: 'updateProject', fields: { theme } }, 'Shifted to Luxury Technology aesthetic');
    reply = 'Elevated to a Luxury Technology aesthetic: deep obsidian canvas, emerald & jade accents, editorial Instrument Serif headlines, and cinematic motion.';
    return { ops, changes, reply };
  }

  if (/\b(apple style|apple aesthetic|minimal apple|cupertino)\b/.test(c)) {
    theme.skin = 'light';
    theme.accent = '#17171C';
    theme.accent2 = '#0071E3';
    theme.headingFont = 'Inter';
    theme.bodyFont = 'Inter';
    theme.motion = 'calm';
    theme.radius = 22;
    push({ op: 'updateProject', fields: { theme } }, 'Applied Minimal Apple aesthetic');
    reply = 'Apple aesthetic engaged: pure paper canvas, crisp monochrome type, signature Cupertino blue accents, generous negative space, and calm transitions.';
    return { ops, changes, reply };
  }

  // --- regenerate
  if (/\b(regenerate|start over|start fresh|rebuild|re-roll|from scratch)\b/.test(c)) {
    push({ op: 'regenerate' }, 'Rebuilt the entire deck from the website understanding');
    reply = 'Done — I regenerated all eleven sections from the current website profile. The canvas is fresh; tell me what to sculpt next.';
    return { ops, changes, reply };
  }


  // --- understanding edits
  const undMatch = c.match(/^(?:the\s+)?(audience|tagline|name|product name|goal|mission|category)\s+(?:is|are|=|:)\s+(.+)$/);
  if (undMatch) {
    const key = { 'product name': 'productName', name: 'productName', mission: 'businessGoal', goal: 'businessGoal' }[undMatch[1]] || undMatch[1];
    const val = cap(undMatch[2].trim());
    const next = { ...u, [key]: key === 'audience' ? val.split(/,| and /).map((s) => s.trim()).filter(Boolean) : val };
    push({ op: 'updateProject', fields: { understanding: next } }, `Updated ${key} to “${val}”`);
    push({ op: 'regenerate' }, 'Regenerated the deck against the new profile');
    reply = `Noted — ${key} is now “${val}”. I regenerated the presentation so every section speaks to that.`;
    return { ops, changes, reply };
  }

  // --- add section
  const addMatch = c.match(/(?:^|\b)(?:add|create|insert|include)\s+(?:a\s+|an\s+|the\s+)?([a-z][a-z ]*?)(?:\s+(?:section|slide|page))?(?:\s+(before|after)\s+(?:the\s+)?([a-z]+))?$/) && !/color|colour|animation|motion|contrast|image|photo/.test(c) ?
    c.match(/(?:^|\b)(?:add|create|insert|include)\s+(?:a\s+|an\s+|the\s+)?([a-z][a-z ]*?)(?:\s+(?:section|slide|page))?(?:\s+(before|after)\s+(?:the\s+)?([a-z]+))?$/) : null;
  if (addMatch && addMatch[1] && addMatch[1].length >= 3) {
    const topic = addMatch[1].replace(/\s+(section|slide|page)$/, '').trim();
    const type = SECTION_SYNONYMS[topic] && !['testimonials', 'pricing', 'team', 'faq', 'metrics'].includes(SECTION_SYNONYMS[topic]) ? SECTION_SYNONYMS[topic] : (['testimonials', 'pricing', 'team', 'faq', 'metrics'].includes(SECTION_SYNONYMS[topic]) ? SECTION_SYNONYMS[topic] : 'custom');
    let after = slides[slides.length - 1];
    if (addMatch[3]) {
      const ref = findSlide(slides, addMatch[3]);
      if (ref) after = ref;
    }
    let order = after ? after.sort_order + 5 : (slides.length + 1) * 10;
    if (addMatch[2] === 'before' && after) {
      const prev = slides.filter((s) => s.sort_order < after.sort_order).pop();
      order = prev ? (prev.sort_order + after.sort_order) / 2 : after.sort_order - 5;
    } else if (after) {
      const next = slides.find((s) => s.sort_order > after.sort_order);
      if (next) order = (after.sort_order + next.sort_order) / 2;
    }
    let data;
    if (type === 'custom' || ['testimonials', 'pricing', 'team', 'faq', 'metrics'].includes(type)) {
      const topicTitle = addMatch[1].replace(/\s+(section|slide|page)$/, '').trim();
      const extras = {
        testimonials: { title: 'Loved in the *wild*', bullets: u.usps.map((s2) => s2) },
        pricing: { title: 'Simple *pricing*', bullets: ['Starter — Everything to begin, free while in beta', 'Pro — The full platform for growing teams', 'Enterprise — Security, support and scale on your terms'] },
        team: { title: 'The people behind *it*', bullets: u.audience.map((a2) => cap(a2)) },
        faq: { title: 'Questions, *answered*', bullets: ['Who is it for? — ' + (u.audience[0] || 'Modern teams'), 'Why now? — ' + cap(u.businessGoal), 'Where do I start? — ' + u.host] },
        metrics: { title: 'By the *numbers*', bullets: [] },
      }[type] || {};
      data = buildSlide('custom', u, project.analysis, project.audit, order, {
        project_id: project.id,
        title: extras.title || gradLast(cap(topicTitle)),
        bullets: extras.bullets || undefined,
        layout: type === 'metrics' ? 'center' : 'left',
      });
      data.custom_label = cap(topicTitle);
    } else {
      data = buildSlide(type, u, project.analysis, project.audit, order, { project_id: project.id });
    }
    push({ op: 'insertSlide', data }, `Added a “${(data.title || '').replace(/\*/g, '')}” section ${addMatch[2] ? addMatch[2] + ' ' + (addMatch[3] || 'the end') : 'at the end'}`);
    reply = `Added. The new “${(data.title || '').replace(/\*/g, '')}” section is live on the canvas — drag through the rail to review it, or tell me to rewrite any line.`;
    return { ops, changes, reply };
  }

  // --- remove section
  const rmMatch = c.match(/(?:remove|delete|drop|cut)\s+(?:the\s+)?([a-z]+)(?:\s+(?:section|slide|page))?/);
  if (rmMatch && !/image|photo|picture|color|animation/.test(c)) {
    const slide = findSlide(slides, rmMatch[1]);
    if (slide) {
      push({ op: 'deleteSlide', id: slide.id }, `Removed the “${(slide.title || slide.type).replace(/\*/g, '')}” section`);
      reply = `Gone. The “${(slide.title || slide.type).replace(/\*/g, '')}” section has been removed from the deck.`;
      return { ops, changes, reply };
    }
  }

  // --- move section
  const mvMatch = c.match(/move\s+(?:the\s+)?([a-z]+)(?:\s+(?:section|slide|page))?\s+(before|after)\s+(?:the\s+)?([a-z]+)/);
  if (mvMatch) {
    const a2 = findSlide(slides, mvMatch[1]);
    const b2 = findSlide(slides, mvMatch[3]);
    if (a2 && b2 && a2.id !== b2.id) {
      const others = slides.filter((s) => s.id !== a2.id);
      const idx = others.findIndex((s) => s.id === b2.id);
      const insertAt = mvMatch[2] === 'before' ? idx : idx + 1;
      others.splice(insertAt, 0, a2);
      const updates = others.map((s, i) => ({ id: s.id, sort_order: (i + 1) * 10 }));
      push({ op: 'reorder', updates }, `Moved “${(a2.title || a2.type).replace(/\*/g, '')}” ${mvMatch[2]} “${(b2.title || b2.type).replace(/\*/g, '')}”`);
      reply = 'Reorder complete — the narrative now flows the way you asked.';
      return { ops, changes, reply };
    }
  }

  // --- rename
  const renMatch = c.match(/(?:rename|retitle)\s+(?:the\s+)?([a-z]+)(?:\s+(?:section|slide|page))?\s+(?:to|as)\s+["']?(.+?)["']?$/) || c.match(/change\s+(?:the\s+)?([a-z]+)(?:\s+(?:section|slide))?\s+title\s+to\s+["']?(.+?)["']?$/);
  if (renMatch) {
    const slide = findSlide(slides, renMatch[1]);
    if (slide) {
      const newTitle = cap(renMatch[2].replace(/\*$/, ''));
      push({ op: 'updateSlide', id: slide.id, fields: { title: gradLast(newTitle) } }, `Retitled “${(slide.title || '').replace(/\*/g, '')}” → “${newTitle}”`);
      reply = `Retitled. It now reads “${newTitle}” — with the gradient accent on the final word, as always.`;
      return { ops, changes, reply };
    }
  }

  // --- multi-signal style sweep: palette + typography + skin + motion in one directive
  const bag = ' ' + c.toLowerCase().replace(/[^a-z0-9#]+/g, ' ') + ' ';
  const hasWord = (...words) => words.some((w) => bag.includes(' ' + w + ' '));
  const sigPalette = Object.keys(PALETTE_WORDS).find((w) => bag.includes(' ' + w + ' '));
  const sigHex = c.match(/#(?:[0-9a-f]{3}){1,2}/i);
  const sigFont = hasWord('serif', 'editorial', 'luxury', 'luxurious', 'fashion', 'literary')
    ? 'Instrument Serif'
    : hasWord('mono', 'monospace', 'terminal', 'code', 'hacker')
      ? 'JetBrains Mono'
      : hasWord('grotesk', 'geometric', 'modern', 'brutal', 'space')
        ? 'Space Grotesk'
        : hasWord('tight', 'condensed')
          ? 'Inter Tight'
          : hasWord('clean', 'neutral', 'swiss', 'minimal', 'apple')
            ? 'Inter'
            : null;

  const sigDark = hasWord('dark', 'darker', 'midnight', 'amoled', 'noir');
  const sigLight = hasWord('light', 'lighter', 'bright', 'white', 'paper', 'daylight', 'airy');
  const sigZoom = hasWord('cinematic', 'dramatic', 'zoom', 'theatrical') ? 'zoom' : null;
  const sigSnappy = hasWord('snappy', 'snappier', 'energetic') ? 'slide' : null;
  const sigCalm = hasWord('sophisticated', 'calm', 'gentle', 'soft', 'subtle') ? 'stagger' : null;
  const sweepCount = [sigPalette, sigHex, sigFont, sigDark, sigLight, sigZoom, sigCalm, sigSnappy].filter(Boolean).length;
  if (sweepCount >= 2) {
    const applied = [];
    if (sigPalette) {
      theme.accent = PALETTE_WORDS[sigPalette][0];
      theme.accent2 = PALETTE_WORDS[sigPalette][1];
      applied.push(sigPalette + ' palette');
    } else if (sigHex) {
      theme.accent = sigHex[0];
      applied.push('accent ' + sigHex[0]);
    }
    if (sigFont) {
      theme.headingFont = sigFont;
      applied.push(sigFont + ' headlines');
    }
    const skinTo = sigDark && !sigLight ? 'dark' : sigLight ? 'light' : null;
    if (skinTo) {
      theme.skin = skinTo;
      applied.push(skinTo === 'dark' ? 'ink skin' : 'paper skin');
    }
    const animTo = sigZoom || sigSnappy || sigCalm;
    if (animTo) {
      theme.motion = sigSnappy && !sigZoom ? 'snappy' : 'smooth';
      applied.push(animTo === 'zoom' ? 'cinematic entrances' : animTo === 'slide' ? 'snappy entrances' : 'graceful staggers');
    }
    push({ op: 'updateProject', fields: { theme } }, null);
    if (animTo) for (const s of slides) if (s.animation !== 'none') push({ op: 'updateSlide', id: s.id, fields: { animation: animTo } }, null);
    push({ op: 'noop' }, 'Restyled deck — ' + applied.join(', '));
    reply = 'Full restyle applied: ' + applied.join(', ') + '. Take it to Present mode to feel the whole system move together.';
    return { ops, changes, reply };
  }

  // --- skin
  if (/\b(darker|dark mode|midnight|black|amoled|noir|dim)\b/.test(c) || (/\bdark\b/.test(c) && !/darken/.test(c))) {
    theme.skin = 'dark';
    push({ op: 'updateProject', fields: { theme } }, 'Shifted the deck to a dark skin');
    reply = 'Lights off. The deck now sits on deep obsidian with the accent doing all the talking.';
    return { ops, changes, reply };
  }
  if (/\b(light|lighter|bright|white|paper|daylight|light mode)\b/.test(c)) {
    theme.skin = 'light';
    push({ op: 'updateProject', fields: { theme } }, 'Shifted the deck to a light skin');
    reply = 'Paper mode. Light surfaces, ink-dark type, same gradient soul.';
    return { ops, changes, reply };
  }

  // --- palette / color
  const hexMatch = c.match(/#([0-9a-f]{6}|[0-9a-f]{3})\b/i);
  const wordMatch = Object.keys(PALETTE_WORDS).find((w) => new RegExp(`\\b${w}\\b`).test(c));
  if (hexMatch || (wordMatch && /color|colour|palette|accent|theme|brand|paint|make it|switch|use|go/.test(c) || Object.keys(PALETTE_WORDS).some((w) => c === w))) {
    const accent = hexMatch ? '#' + hexMatch[1] : PALETTE_WORDS[wordMatch][0];
    const accent2 = hexMatch ? theme.accent2 || '#22D3EE' : PALETTE_WORDS[wordMatch][1];
    theme.accent = accent;
    theme.accent2 = accent2;
    const slideTarget = target;
    if (slideTarget && /only|just|slide|section/.test(c) && /slide|section/.test(c)) {
      push({ op: 'updateSlide', id: slideTarget.id, fields: { theme_override: { accent, accent2 } } }, `Painted “${tname}” with accent ${accent}`);
      reply = `Done — only “${tname}” wears the new accent. The rest of the deck keeps its palette.`;
    } else {
      push({ op: 'updateProject', fields: { theme } }, `Recolored the deck around ${accent}`);
      reply = `New palette locked in around ${accent}${hexMatch ? '' : ` with ${accent2} as its duet partner`}. Every gradient, glow and highlight just changed key.`;
    }
    return { ops, changes, reply };
  }

  // --- named motion presets (cinematic / elegant / minimal / futuristic / energetic / corporate)
  {
    const bag = ' ' + c.toLowerCase().replace(/[^a-z0-9#]+/g, ' ') + ' ';
    const PRESET_WORDS = ['cinematic', 'futuristic', 'corporate', 'energetic', 'elegant', 'minimal', 'minimalist'];
    const found = PRESET_WORDS.find((w) => bag.includes(' ' + w + ' '));
    const soft = !found && /(like a movie|hollywood|blockbuster|film-like)/.test(bag) ? 'cinematic' : null;
    const presetId = (found === 'minimalist' ? 'minimal' : found) || soft;
    const hasMotionContext = /motion|anim|transition|preset|entrance|tempo|pace|vibe|energy|cinematic|futuristic|corporate|energetic|minimal|minimalist/.test(bag);
    if (presetId && hasMotionContext && !/serif|font|typeface|typography|headline/.test(bag)) {
      const PRESET_CHOICE = {
        cinematic: { entrance: 'blur', motion: 'cinematic', transition: 'morph', dur: 900, stagger: 130 },
        elegant: { entrance: 'rise', motion: 'elegant', transition: 'fade', dur: 780, stagger: 110 },
        minimal: { entrance: 'fade', motion: 'minimal', transition: 'fade', dur: 340, stagger: 60 },
        futuristic: { entrance: 'slide', motion: 'futuristic', transition: 'slide', dur: 460, stagger: 70 },
        energetic: { entrance: 'scale', motion: 'energetic', transition: 'zoom', dur: 320, stagger: 65 },
        corporate: { entrance: 'fade', motion: 'corporate', transition: 'fade', dur: 520, stagger: 90 },
      }[presetId];
      theme.motion = PRESET_CHOICE.motion;
      theme.motionPreset = presetId;
      changes.length = 0;
      push({ op: 'updateProject', fields: { theme } }, `Motion preset “${presetId}” applied end to end`);
      for (const s of slides) push({ op: 'updateSlide', id: s.id, fields: { animation: PRESET_CHOICE.entrance } }, null);
      reply = `Motion is now ${presetId}: ${PRESET_CHOICE.dur}ms entrances, ${PRESET_CHOICE.stagger}ms cadence, ${PRESET_CHOICE.transition === 'morph' ? 'morph-like' : PRESET_CHOICE.transition} section transitions. Present mode will feel it immediately.`;
      return { ops, changes, reply };
    }
  }

  // --- typography
  if (/\b(serif|editorial|elegant|fashion|luxury)\b/.test(c)) {
    theme.headingFont = 'Instrument Serif';
    push({ op: 'updateProject', fields: { theme } }, 'Set headlines in Instrument Serif');
    reply = 'Headlines now carry an editorial serif — sharp, literary, expensive. Body copy stays neutral for contrast.';
    return { ops, changes, reply };
  }
  if (/\b(grotesk|modern|bold|brutal|swiss|space)\b/.test(c) && /font|type|headline|typography|make it/.test(c)) {
    theme.headingFont = 'Space Grotesk';
    push({ op: 'updateProject', fields: { theme } }, 'Set headlines in Space Grotesk');
    reply = 'Space Grotesk is back on headlines — engineered, geometric, confident.';
    return { ops, changes, reply };
  }
  if (/\b(mono|monospace|terminal|code|hacker)\b/.test(c) && /font|type|headline|typography|make it/.test(c)) {
    theme.headingFont = 'JetBrains Mono';
    push({ op: 'updateProject', fields: { theme } }, 'Set headlines in JetBrains Mono');
    reply = 'Monospace headlines engaged. The deck now reads like a beautifully typeset terminal.';
    return { ops, changes, reply };
  }
  if (/\b(clean|neutral|inter|minimal)\b/.test(c) && /font|type|headline|typography|make it/.test(c)) {
    theme.headingFont = 'Inter';
    push({ op: 'updateProject', fields: { theme } }, 'Set headlines in Inter');
    reply = 'Inter everywhere — quiet, neutral, lets the content hold the room.';
    return { ops, changes, reply };
  }

  // --- motion
  if (/no animation|disable animation|remove animation|remove animations|stop animation|turn off animation|turn off animations|without animation|static/.test(c)) {
    for (const s of slides) push({ op: 'updateSlide', id: s.id, fields: { animation: 'none' } }, null);
    push({ op: 'updateProject', fields: { theme: { ...theme, motion: 'minimal' } } }, 'Disabled all slide animations');
    changes.pop();
    changes.push('Disabled all slide animations');
    reply = 'Motion off. The deck now presents itself with pure stillness.';
    return { ops, changes, reply };
  }

  if (/\b(animate the features one by one|stagger features|stagger the features|animate features)\b/.test(c)) {
    const fSlide = slides.find((s) => s.type === 'features') || target || slides[0];
    if (fSlide) {
      push({ op: 'updateSlide', id: fSlide.id, fields: { animation: 'stagger' } }, 'Configured sequential feature stagger');
      reply = 'Features now reveal sequentially one by one in Present mode.';
      return { ops, changes, reply };
    }
  }

  if (/\b(make the opening more dramatic|dramatic opening|cinematic opening|hero cinematic|dramatic hero)\b/.test(c)) {
    const hSlide = slides.find((s) => s.type === 'hero') || slides[0];
    if (hSlide) {
      push({ op: 'updateSlide', id: hSlide.id, fields: { animation: 'zoom' } }, 'Set dramatic opening zoom on Hero');
      reply = 'The opening section is now tuned for high-impact cinematic zoom.';
      return { ops, changes, reply };
    }
  }

  if (target && /\b(more dynamic|animate|dynamic|lively|motion)\b/.test(c)) {
    push({ op: 'updateSlide', id: target.id, fields: { animation: 'slide' } }, `Set dynamic entrance on “${tname}”`);
    reply = `“${tname}” now enters with dynamic lateral glide and progressive reveal.`;
    return { ops, changes, reply };
  }

  if (/\b(more cinematic|cinematic motion|cinematic presentation|cinematic transitions?)\b/.test(c)) {
    theme.motion = 'cinematic';
    for (const s of slides) if (s.animation !== 'none') push({ op: 'updateSlide', id: s.id, fields: { animation: 'zoom' } }, null);
    push({ op: 'updateProject', fields: { theme } }, 'Set presentation motion to Cinematic');
    reply = 'Cinematic motion engaged: slow blur reveals, subtle zooms, and morphing transitions.';
    return { ops, changes, reply };
  }

  if (/\b(more elegant|elegant transitions?|elegant motion)\b/.test(c)) {
    theme.motion = 'elegant';
    for (const s of slides) if (s.animation !== 'none') push({ op: 'updateSlide', id: s.id, fields: { animation: 'fade' } }, null);
    push({ op: 'updateProject', fields: { theme } }, 'Set presentation motion to Elegant');
    reply = 'Elegant motion tuned: gentle silk rises and unhurried opacity transitions.';
    return { ops, changes, reply };
  }

  if (/\b(subtle animations?|subtle motion|minimal animation|minimal motion)\b/.test(c)) {
    theme.motion = 'minimal';
    for (const s of slides) if (s.animation !== 'none') push({ op: 'updateSlide', id: s.id, fields: { animation: 'fade' } }, null);
    push({ op: 'updateProject', fields: { theme } }, 'Set subtle, restrained animations');
    reply = 'Subtle motion applied: restrained opacity fades with zero visual distraction.';
    return { ops, changes, reply };
  }

  if (/\b(snappy|snappier|faster|quick|energetic)\b/.test(c) && /anim|motion|transition|feel|make it/.test(c)) {
    theme.motion = 'snappy';
    for (const s of slides) if (s.animation !== 'none') push({ op: 'updateSlide', id: s.id, fields: { animation: 'slide' } }, null);
    push({ op: 'updateProject', fields: { theme } }, 'Motion tuned to snappy slide-ins');
    reply = 'Snappy mode: every section now enters with a quick lateral glide. Present to feel it.';
    return { ops, changes, reply };
  }
  if (/\b(calm|gentle|slow|soft|subtle)\b/.test(c) && /anim|motion|transition|feel|make it/.test(c)) {
    theme.motion = 'calm';
    for (const s of slides) if (s.animation !== 'none') push({ op: 'updateSlide', id: s.id, fields: { animation: 'fade' } }, null);
    push({ op: 'updateProject', fields: { theme } }, 'Motion slowed to calm fades');
    reply = 'Calm fades throughout. Nothing arrives loudly anymore — it simply appears, sure of itself.';
    return { ops, changes, reply };
  }
  if (/\b(dramatic|cinematic|zoom)\b/.test(c) && /anim|motion|transition|feel|make it/.test(c)) {
    theme.motion = 'smooth';
    for (const s of slides) if (s.animation !== 'none') push({ op: 'updateSlide', id: s.id, fields: { animation: 'zoom' } }, null);
    push({ op: 'updateProject', fields: { theme } }, 'Motion set to dramatic zoom entrances');
    reply = 'Cinematic zoom on every entrance. Present mode is where this shines — take it for a spin.';
    return { ops, changes, reply };
  }


  // --- layout
  const layMatch = c.match(/\b(center|centered|centred|split|grid|left|magazine)\b.*\b(layout|align|arrange|compose)/) || c.match(/\b(?:layout|align)\s+(?:to\s+)?(center|centered|centred|split|grid|left)/);
  if (layMatch) {
    let layout = layMatch[1].replace(/centered|centred/, 'center').replace('magazine', 'split');
    const scopeAll = /\ball\b|every|each/.test(c);
    const slide = target;
    if (slide && !scopeAll) {
      push({ op: 'updateSlide', id: slide.id, fields: { layout } }, `Set “${tname}” to a ${layout} layout`);
      reply = `“${tname}” now uses the ${layout} composition.`;
    } else {
      for (const s of slides) if (s.type !== 'hero' && s.type !== 'cta') push({ op: 'updateSlide', id: s.id, fields: { layout } }, null);
      push({ op: 'updateProject', fields: {} }, `Applied ${layout} layouts across the deck`);
      ops.pop(); ops.push({ op: 'noop' });
      reply = `The whole deck now breathes in ${layout} compositions (hero and closer keep their stage).`;
    }
    return { ops, changes, reply };
  }

  // --- visual intelligence commands
  if (/\b(only images from my website|only website images|remove stock|no stock images|website assets only|no stock photos|remove external images)\b/.test(c)) {
    for (const s of slides) {
      if (s.image_url && s.visualDecision?.type === 'external-image') {
        push({ op: 'updateSlide', id: s.id, fields: { image_url: '', visualDecision: { type: 'none', reason: 'User requested only website assets' }, layout: 'left' } }, null);
      }
    }
    push({ op: 'noop' }, 'Restricted imagery exclusively to verified website assets');
    reply = 'Stock photography removed. The deck now only uses verified assets and screenshots captured from your website.';
    return { ops, changes, reply };
  }

  if (/\b(more photography|more photos|more images|add photography|add photos|use photography)\b/.test(c)) {
    const visualDna = project.analysis?.visualDna || extractVisualDna(project.analysis || {}, [], project.url);
    const used = new Set(slides.map((s) => s.image_url).filter(Boolean));
    for (const s of slides) {
      if (!s.image_url && ['solution', 'intro', 'market', 'custom'].includes(s.type)) {
        const brief = generateVisualBrief(s, project.understanding, visualDna);
        const res = searchAndRankVisuals(brief, visualDna, used);
        used.add(res.url);
        push({ op: 'updateSlide', id: s.id, fields: { image_url: res.url, layout: 'split', visualDecision: { type: 'external-image', url: res.url, reason: 'Enriched slide with editorial photography', placement: 'split', aspectRatio: res.aspectRatio, priority: 0.85, attribution: res.attribution } } }, null);
      }
    }
    push({ op: 'noop' }, 'Enriched narrative sections with editorial photography');
    reply = 'Done — I paired the key narrative sections with high-res editorial photography matching your brand palette.';
    return { ops, changes, reply };
  }

  const repImgMatch = c.match(/(?:replace|swap|change|new|refresh)\s+(?:the\s+)?(?:image|photo|picture|visual)\s+(?:on|for|in)\s+(?:the\s+)?([a-z0-9# ]+)/) ||
    c.match(/(?:replace|swap|change|new|refresh)\s+(?:the\s+)?([a-z0-9# ]+)\s+(?:image|photo|picture|visual)/) ||
    c.match(/(?:make|set)\s+(?:the\s+)?([a-z0-9# ]+)\s+more visual/);
  if (repImgMatch || (target && /\b(more visual|replace image|change image|new image|swap image|refresh image)\b/.test(c))) {
    const sTarget = target || (repImgMatch ? findSlide(slides, repImgMatch[1]) : null);
    if (sTarget) {
      const visualDna = project.analysis?.visualDna || extractVisualDna(project.analysis || {}, [], project.url);
      const used = new Set(slides.map((s) => s.image_url).filter((u2) => u2 && u2 !== sTarget.image_url));
      const brief = generateVisualBrief(sTarget, project.understanding, visualDna);
      const res = searchAndRankVisuals(brief, visualDna, used);
      push({ op: 'updateSlide', id: sTarget.id, fields: { image_url: res.url, layout: 'split', visualDecision: { type: 'external-image', url: res.url, reason: 'Refreshed visual candidate', placement: 'split', aspectRatio: res.aspectRatio, priority: 0.9, attribution: res.attribution } } }, `Refreshed visual on “${(sTarget.title || sTarget.type).replace(/\*/g, '')}”`);
      reply = `Replaced the visual on “${(sTarget.title || sTarget.type).replace(/\*/g, '')}” with a fresh candidate aligned with your brand.`;
      return { ops, changes, reply };
    }
  }

  // --- shorten / expand
  if (/\b(shorten|reduce|condense|simplify|tighten|trim|shorter|less text|less words|fewer words|tl;dr)\b/.test(c)) {


    const scope = target ? [target] : slides;
    for (const s of scope) {
      const fields = {};
      if (s.body) fields.body = shortenText(s.body, 120);
      if (s.subtitle) fields.subtitle = shortenText(s.subtitle, 80);
      if (Array.isArray(s.bullets) && s.bullets.length > 4) fields.bullets = s.bullets.slice(0, 4);
      if (Array.isArray(s.bullets)) {
        fields.bullets = (fields.bullets || s.bullets).map((b) => {
          const [t1, d1] = b.split(' — ');
          return d1 ? `${shortenText(t1, 40)} — ${shortenText(d1, 70)}` : shortenText(b, 72);
        });
      }
      push({ op: 'updateSlide', id: s.id, fields }, null);
    }
    push({ op: 'noop' }, target ? `Condensed “${tname}”` : 'Condensed copy across the deck');
    reply = target
      ? `“${tname}” is now espresso-strength — same flavor, none of the water.`
      : 'I tightened every section: one-sentence bodies, four-bullet ceilings, no filler.';
    return { ops, changes, reply };
  }
  if (/\b(expand|elaborate|longer|more detail|flesh out|richer)\b/.test(c)) {
    const scope = target ? [target] : slides.filter((s) => ['intro', 'solution', 'custom'].includes(s.type));
    for (const s of scope) {
      const add = firstSentence(u.benefits[0]?.desc || u.summary || u.tagline, 160);
      const fields = { body: [s.body, !s.body || !s.body.includes(add) ? add : ''].filter(Boolean).join(' ') };
      push({ op: 'updateSlide', id: s.id, fields }, null);
    }
    push({ op: 'noop' }, target ? `Expanded “${tname}” with supporting detail` : 'Deepened the narrative sections');
    reply = 'Expanded. I wove the product’s strongest outcome statements into the narrative for substance over acreage.';
    return { ops, changes, reply };
  }

  // --- tone
  if (/\b(more formal|professional|boardroom|executive|corporate)\b/.test(c)) {
    for (const s of slides) {
      push({ op: 'updateSlide', id: s.id, fields: { title: applyRepl(s.title, FORMAL_REPL), subtitle: applyRepl(s.subtitle, FORMAL_REPL), body: applyRepl(s.body, FORMAL_REPL) } }, null);
    }
    push({ op: 'noop' }, 'Rewrote copy in an executive register');
    reply = 'Suited up. Contractions resolved, exclamation points dismissed — the deck now speaks boardroom.';
    return { ops, changes, reply };
  }
  if (/\b(punchy|punchier|bolder|louder|aggressive|edgier)\b/.test(c)) {
    for (const s of slides) {
      const fields = { body: applyRepl(s.body ? shortenText(s.body, 140) : s.body, PUNCHY_REPL), subtitle: applyRepl(s.subtitle, PUNCHY_REPL) };
      push({ op: 'updateSlide', id: s.id, fields }, null);
    }
    push({ op: 'noop' }, 'Punched up the copy');
    reply = 'Sharpened. Qualifiers deleted, sentences cut to fighting weight. The deck hits first and explains later.';
    return { ops, changes, reply };
  }

  // --- image
  const imgMatch = c.match(/(https?:\/\/\S+\.(?:png|jpe?g|webp|gif)(?:\?\S*)?)/i);
  if (imgMatch && /image|photo|picture|screenshot|visual/.test(c)) {
    const slide = target || findSlide(slides, 'hero');
    if (slide) {
      push({ op: 'updateSlide', id: slide.id, fields: { image_url: imgMatch[1], layout: slide.type === 'hero' ? 'split' : slide.layout } }, `Set a new image on “${(slide.title || slide.type).replace(/\*/g, '')}”`);
      reply = `Image placed on “${(slide.title || slide.type).replace(/\*/g, '')}”.`;
      return { ops, changes, reply };
    }
  }
  if (/remove (the )?image/.test(c)) {
    const slide = target || findSlide(slides, 'hero');
    if (slide) {
      push({ op: 'updateSlide', id: slide.id, fields: { image_url: '' } }, `Removed the image from “${(slide.title || slide.type).replace(/\*/g, '')}”`);
      reply = 'Image removed — typography carries the section now.';
      return { ops, changes, reply };
    }
  }
  if (/use (the )?screenshot/.test(c) && target) {
    push({ op: 'updateSlide', id: target.id, fields: { image_url: (project.analysis || {}).screenshot || '' } }, `Placed the site screenshot on “${tname}”`);
    reply = `The captured screenshot now anchors “${tname}”.`;
    return { ops, changes, reply };
  }

  // --- fallback
  reply = [
    'I can reshape this deck however you like. Try:',
    '· “Switch to an emerald palette” or “make it paper light”',
    '· “Serif headlines” · “snappier motion”',
    '· “Add a pricing section after benefits” · “Remove the workflow slide”',
    '· “Shorten the problem slide” · “Make the copy more formal”',
    '· “Move technology before features” · “Rename cta to Let’s build”',
  ].join('\n');
  return { ops, changes, reply };
}
