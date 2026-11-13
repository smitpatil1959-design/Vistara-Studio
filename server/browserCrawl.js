/**
 * Rendered crawler — Playwright (serverless Chromium) with a request firewall.
 *
 * Defense in depth:
 *  - the navigation URL is DNS-validated before launch (see security.js)
 *  - every request (documents, redirect hops AND subresources) passes a route
 *    interceptor that re-validates protocol + hostname + DNS (cached per host)
 *  - non-http(s), credentialed, private-range or metadata targets are aborted
 *    and honestly recorded as failed requests
 *
 * Hard limits: page cap, per-page navigation timeout, total budget, console /
 * failed-request capture caps, screenshot size cap, media file blocking.
 */

import dns from 'node:dns';
import fs from 'node:fs';
import net from 'node:net';
import { chromium as pw } from 'playwright-core';
import sparticuz from '@sparticuz/chromium';
import { REALISTIC_BROWSER_UA, REALISTIC_BROWSER_HEADERS, CRAWL_LIMITS, CrawlBlockedError, hostnameBlockedByName, isPrivateIP, validateTarget, detectBotChallenge, logSecurityEvent } from './security.js';

const SKIP_PROTOCOLS = /^(mailto|tel|javascript|data|blob|file|chrome|about):/i;
const PATH_EXCLUDE = /login|signin|sign-in|signup|sign-up|auth|cart|checkout|account|unsubscribe|wp-json/i;

let exePromise = null;
async function chromiumPath() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  if (!exePromise) {
    exePromise = (async () => {
      if (process.platform === 'linux') {
        try {
          const p = await sparticuz.executablePath();
          if (p) return p;
        } catch { /* ignore */ }
      }
      if (process.platform === 'win32') {
        const winPaths = [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        ];
        for (const wp of winPaths) {
          try {
            if (fs.existsSync(wp)) return wp;
          } catch { /* ignore */ }
        }
      } else if (process.platform === 'darwin') {
        const macPaths = [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
        ];
        for (const mp of macPaths) {
          try {
            if (fs.existsSync(mp)) return mp;
          } catch { /* ignore */ }
        }
      }
      try {
        return await sparticuz.executablePath();
      } catch {
        return undefined;
      }
    })();
  }
  return exePromise;
}

/** Cached per-host verdict for the browser's request firewall. */
function makeHostFirewall() {
  const cache = new Map();
  return async function allow(rawUrl) {
    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return false;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    const port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80);
    if (port !== 80 && port !== 443) {
      logSecurityEvent('BLOCKED_BROWSER_REQUEST_PORT', { url: rawUrl, port });
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (hostnameBlockedByName(host)) {
      logSecurityEvent('BLOCKED_BROWSER_REQUEST_HOSTNAME', { host, reason: 'blocked-hostname' });
      return false;
    }
    try {
      if (net.isIP(host) !== 0 && isPrivateIP(host)) {
        logSecurityEvent('BLOCKED_BROWSER_REQUEST_IP', { host, reason: 'private-ip-literal' });
        return false;
      }
      if (cache.has(host)) return cache.get(host);
      let ok = true;
      try {
        const addrs = await Promise.race([
          dns.promises.lookup(host, { all: true, verbatim: true }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('dns-timeout')), 4000)),
        ]);
        ok = addrs.length > 0 && addrs.every((a) => !isPrivateIP(a.address));
        if (!ok) {
          logSecurityEvent('BLOCKED_BROWSER_REQUEST_DNS', { host, reason: 'private-resolved-ip' });
        }
      } catch {
        ok = false;
      }
      cache.set(host, ok);
      return ok;
    } catch {
      return false;
    }
  };
}

export function pickInternal(links, host, max) {
  const seen = new Set(['/']);
  const out = [];
  for (const l of links) {
    try {
      const u = new URL(l.url);
      if (u.hostname.replace(/^www\./, '') !== host.replace(/^www\./, '')) continue;
      const path = (u.pathname.replace(/\/+$/, '') || '/') + '';
      if (seen.has(path) || PATH_EXCLUDE.test(path)) continue;
      seen.add(path);
      out.push(u.toString());
    } catch { /* ignore malformed */ }
  }
  // Prefer the site's explanatory pages over utility/community links that often
  // appear first in navigation. Keep the crawl bounded after ranking candidates.
  const relevance = (url) => {
    const path = new URL(url).pathname;
    const depth = path.split('/').filter(Boolean).length;
    return (/^\/(about|products?|features?|solutions?|services?|overview|company)\/?$/i.test(path) ? 100 :
      /^\/(about|products?|features?|solutions?|services?|docs?|documentation|downloads?|pricing)\b/i.test(path) ? 60 : 0) - depth;
  };
  return out.sort((a, b) => relevance(b) - relevance(a)).slice(0, max);
}

const trunc = (s, n) => (typeof s === 'string' ? (s.length > n ? s.slice(0, n) + '…' : s) : '');

/** Real user-metric observers, injected before any page script runs. */
export const VITALS_INIT = `
window.__vitals = { lcp: 0, cls: 0, inpSamples: [], longtasks: 0, longtaskMs: 0 };
try {
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    if (entries.length) window.__vitals.lcp = entries[entries.length - 1].startTime;
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (!e.hadRecentInput) window.__vitals.cls += e.value;
  }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) { window.__vitals.longtasks += 1; window.__vitals.longtaskMs += e.duration; }
  }).observe({ type: 'longtask', buffered: true });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__vitals.inpSamples.push(e.duration);
  }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
} catch (e) { /* observer unsupported → vitals stay zero */ }
`;

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const VIEWPORTS = [
  { name: 'Mobile', width: 375, height: 812 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Desktop', width: 1440, height: 900 },
];

/** Geometry + overflow measurement, run inside the page at a fixed viewport. */
const VIEWPORT_EVAL = `(() => {
  const root = document.scrollingElement || document.documentElement;
  const vw = window.innerWidth;
  const overflowPx = Math.max(0, (root ? root.scrollWidth : vw) - vw);
  const offenders = [];
  let clippedCount = 0;
  const all = document.body ? document.body.querySelectorAll('*') : [];
  for (const n of all) {
    const r = n.getBoundingClientRect();
    if (r.right > vw + 2 && r.width > 12 && r.height > 4) {
      clippedCount++;
      if (offenders.length < 5) {
        const id = n.id ? '#' + n.id : '';
        const cls = typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\\s+/)[0] : '';
        offenders.push((n.tagName || '?').toLowerCase() + id + cls);
      }
    }
    if (clippedCount > 400) break;
  }
  return { viewportWidth: vw, scrollableWidth: root ? root.scrollWidth : vw, horizontalOverflowPx: overflowPx, clippedCount, offenders };
})()`;

/** Deep-probes a single document: render + measured vitals + axe + viewport sweeps. */
export async function deepProbeOne(context, target, limits, budgetLeft) {
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  const failedAssets = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error' && consoleErrors.length < limits.maxConsoleEntries) consoleErrors.push({ text: trunc(msg.text(), 220) });
  });
  page.on('pageerror', (err) => {
    if (consoleErrors.length < limits.maxConsoleEntries) consoleErrors.push({ text: trunc('Uncaught ' + (err.message || 'script error'), 220) });
  });
  page.on('requestfailed', (req) => {
    if (failedRequests.length < limits.maxFailedRequests) {
      let safe = req.url();
      try {
        const u = new URL(req.url());
        safe = u.hostname + u.pathname;
      } catch { /* keep raw */ }
      failedRequests.push({ url: trunc(safe, 160), method: req.method(), error: trunc(req.failure()?.errorText || 'failed', 80) });
    }
  });
  page.on('response', (res) => {
    try {
      const status = res.status();
      if (status >= 400 && failedAssets.length < limits.maxFailedRequests) {
        const rt = res.request().resourceType();
        if (['image', 'stylesheet', 'script', 'font', 'media', 'xhr', 'fetch', 'document'].includes(rt)) {
          let safe = res.url();
          try {
            const u = new URL(res.url());
            safe = u.hostname + u.pathname;
          } catch { /* keep raw */ }
          failedAssets.push({ url: trunc(safe, 160), status, type: rt });
        }
      }
    } catch { /* response raced */ }
  });

  const t0 = Date.now();
  let response = null;
  let navError = null;
  try {
    response = await page.goto(target, {
      timeout: Math.min(limits.navTimeoutMs, Math.max(4000, budgetLeft())),
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(1000);
    try {
      await page.waitForLoadState('networkidle', { timeout: 2800 });
    } catch { /* long-poll apps never go idle — fine */ }
  } catch (e) {
    navError = trunc(e.message || 'navigation failed', 120);
  }

  let html = '';
  let capped = false;
  try {
    html = await page.content();
    if (html.length > limits.maxHtmlBytes) {
      html = html.slice(0, limits.maxHtmlBytes);
      capped = true;
    }
  } catch { /* raced */ }

  const doc = {
    url: target,
    finalUrl: page.url() || target,
    status: response ? response.status() : 0,
    loadMs: Date.now() - t0,
    title: trunc(await page.title().catch(() => ''), 300),
    html,
    capped,
    headers: response ? response.headers() : {},
    consoleErrors,
    failedRequests,
    failedAssets,
    navError,
    screenshotBuffer: null,
  };

  const probe = {
    vitals: null,
    perf: null,
    axe: null,
    axeError: null,
    viewports: [],
    cookies: [],
    libs: {},
  };

  // ---- measured paint/network/resource data (real APIs, nothing inferred)
  try {
    probe.perf = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const paints = {};
      performance.getEntriesByType('paint').forEach((p) => { paints[p.name] = Math.round(p.startTime); });
      const resources = performance.getEntriesByType('resource');
      let totalTransfer = 0;
      const byType = {};
      const largeImages = [];
      for (const r of resources) {
        const size = r.transferSize || r.encodedBodySize || r.decodedBodySize || 0;
        totalTransfer += size;
        const t = r.initiatorType || 'other';
        byType[t] = (byType[t] || 0) + size;
        if ((t === 'img' || t === 'image') && size > 200 * 1024) {
          largeImages.push({ url: truncStr(r.name.split('?')[0], 140), kb: Math.round(size / 1024) });
        }
      }
      function truncStr(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }
      const blockingScripts = [...document.querySelectorAll('head script[src]')].filter(
        (s) => !s.async && !s.defer && s.type !== 'module' && !String(s.type).includes('json')
      ).length;
      const stylesheets = document.querySelectorAll('head link[rel="stylesheet"]').length;
      const fixedWidths = [...document.querySelectorAll('[style*="width"]')].reduce((n, el) => {
        const v = el.getAttribute('style') || '';
        return n + (/width\s*:\s*\d{3,}px/.test(v) ? 1 : 0);
      }, 0);
      return {
        ttfbMs: nav ? Math.round(nav.responseStart) : null,
        domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
        loadEventMs: nav ? Math.round(nav.loadEventEnd) : null,
        docTransferKb: nav ? Math.round((nav.transferSize || nav.encodedBodySize || 0) / 1024) : 0,
        totalTransferKb: Math.round(totalTransfer / 1024),
        resourceCount: resources.length,
        byTypeKb: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, Math.round(v / 1024)])),
        largeImages: largeImages.slice(0, 8),
        renderBlockingScripts: blockingScripts,
        renderBlockingStylesheets: stylesheets,
        inlineFixedWidths: fixedWidths,
        fcpMs: paints['first-contentful-paint'] ?? null,
      };
    });
  } catch (e) { probe.perf = { error: trunc(e.message, 100) }; }

  // ---- synthetic input on a neutral surface → measured event timings (sampled INP)
  try {
    const neutralXY = await page.evaluate(() => {
      const atoms = [...document.querySelectorAll('main, section, footer, div')];
      for (const el of atoms) {
        if (el.closest('a,button,input,select,textarea,[role="button"],[onclick],[contenteditable]')) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 240 && r.height > 120 && r.top > 0 && r.top < window.innerHeight - 120) {
          return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        }
      }
      return null;
    });
    if (neutralXY && budgetLeft() > 6000) {
      for (let i = 0; i < 3; i++) {
        await page.mouse.click(neutralXY.x, neutralXY.y, { delay: 12 });
        await page.waitForTimeout(160);
      }
    }
    const raw = await page.evaluate(() =>
      window.__vitals
        ? {
            lcp: Math.round(window.__vitals.lcp),
            cls: Math.round(window.__vitals.cls * 1000) / 1000,
            inpSamples: window.__vitals.inpSamples.slice(0, 12).map((x) => Math.round(x)),
            longtasks: window.__vitals.longtasks,
            longtaskMs: Math.round(window.__vitals.longtaskMs),
          }
        : null
    );
    if (raw) {
      const samples = (raw.inpSamples || []).slice().sort((a, b) => a - b);
      probe.vitals = {
        lcpMs: raw.lcp || null,
        cls: raw.cls || 0,
        inpMs: samples.length ? samples[Math.min(samples.length - 1, Math.floor((samples.length - 1) * 0.75))] : null,
        inpSamples: samples.length,
        longtasks: raw.longtasks,
        longtaskMs: raw.longtaskMs,
      };
    }
  } catch (e) { probe.vitals = { error: trunc(e.message, 100) }; }

  // ---- axe-core, injected into the real page
  if (budgetLeft() > 5000) {
    try {
      const axeMod = await import('axe-core');
      const source = (axeMod.default && axeMod.default.source) || axeMod.source;
      if (!source) throw new Error('axe source unavailable');
      await page.addScriptTag({ content: source });
      probe.axe = await page.evaluate(async (tags) => {
        const result = await window.axe.run(document, {
          resultTypes: ['violations'],
          runOnly: { type: 'tag', values: tags },
        });
        return {
          violations: result.violations.map((v) => ({
            id: v.id,
            impact: v.impact || 'minor',
            help: v.help,
            nodes: v.nodes.slice(0, 4).map((n) => {
              const t = (n.target && n.target[0]) || '';
              return typeof t === 'string' ? t.slice(0, 90) : '';
            }),
            count: v.nodes.length,
          })),
          passes: result.passes.length,
          inapplicable: result.inapplicable.length,
        };
      }, AXE_TAGS);
    } catch (e) {
      probe.axeError = trunc(e.message || 'axe failed to run', 120);
    }
  }

  // ---- viewport geometry sweeps — 375×812, 768×1024, 1440×900
  if (budgetLeft() > 4500) {
    for (const vp of VIEWPORTS) {
      if (budgetLeft() < 3000) break;
      try {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(420);
        const m = await page.evaluate(VIEWPORT_EVAL);
        probe.viewports.push({ ...vp, ...m });
      } catch { /* viewport pass optional */ }
    }
    await page.setViewportSize({ width: limits.screenshotWidth || 1440, height: limits.screenshotHeight || 900 }).catch(() => {});
  }

  // ---- cookies after full render (non-invasive: flags only, never values)
  try {
    probe.cookies = (await context.cookies([doc.finalUrl])).slice(0, 12).map((c) => ({
      name: trunc(c.name, 24),
      secure: !!c.secure,
      httpOnly: !!c.httpOnly,
      sameSite: c.sameSite || 'None',
    }));
  } catch { /* cookies optional */ }

  // ---- visual DNA computation (live DOM computed styles)
  try {
    probe.visualDna = await page.evaluate(() => {
      const rgbToHex = (rgb) => {
        if (!rgb) return null;
        if (/^#[a-f\d]{3}$/i.test(rgb)) return '#' + Array.from(rgb.slice(1)).map(c => c + c).join('');
        if (/^#[a-f\d]{6}$/i.test(rgb)) return rgb;
        const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
        if (!m) return null;
        if (m[4] !== undefined && Number(m[4]) < 0.6) return null;
        return '#' + [m[1], m[2], m[3]].map((x) => parseInt(x, 10).toString(16).padStart(2, '0')).join('');
      };

      const lum = (hex) => {
        if (!hex || !hex.startsWith('#') || hex.length !== 7) return 0.5;
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };

      const bodyStyle = window.getComputedStyle(document.body);
      const h1El = document.querySelector('h1') || document.querySelector('h2') || document.querySelector('h3');
      const h1Style = h1El ? window.getComputedStyle(h1El) : null;
      const btnEl = document.querySelector('button, a[class*="btn"], a[class*="button"], [role="button"], a[href*="signup"], a[href*="login"]');
      const btnStyle = btnEl ? window.getComputedStyle(btnEl) : null;
      const cardEl = document.querySelector('[class*="card"], [class*="panel"], [class*="box"], section > div');
      const cardStyle = cardEl ? window.getComputedStyle(cardEl) : null;

      const bodyBg = rgbToHex(bodyStyle.backgroundColor) || '#ffffff';
      const bodyColor = rgbToHex(bodyStyle.color) || '#111111';
      const isDark = lum(bodyBg) < 0.38 || document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');

      const h1Font = (h1Style ? h1Style.fontFamily : bodyStyle.fontFamily).split(',')[0].replace(/['"]/g, '').trim();
      const bodyFont = bodyStyle.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
      const headingWeight = h1Style ? h1Style.fontWeight : '600';

      const btnBg = btnStyle ? rgbToHex(btnStyle.backgroundColor) : null;
      const btnColor = btnStyle ? rgbToHex(btnStyle.color) : null;
      const btnRadius = btnStyle ? parseInt(btnStyle.borderRadius, 10) || 0 : 0;
      const cardBg = cardStyle ? rgbToHex(cardStyle.backgroundColor) : null;
      const cardRadius = cardStyle ? parseInt(cardStyle.borderRadius, 10) || 0 : 0;

      // Extract colors from all visible heading and accent elements
      const colorSamples = [];
      const brandSignals = [];
      const seenSignals = new Set();
      const sourceUrl = window.location.href;
      const addSignal = (value, role, method, confidence) => {
        const hex = rgbToHex(value);
        const key = `${role}:${hex}`;
        if (hex && /^#[0-9a-f]{6}$/i.test(hex) && brandSignals.length < 64 && !seenSignals.has(key)) {
          seenSignals.add(key);
          brandSignals.push({ value: hex, role, method, confidence, sourceUrl });
        }
      };
      const rootStyle = getComputedStyle(document.documentElement);
      for (const property of Array.from(rootStyle).filter(name => name.startsWith('--') && /brand|primary|accent|secondary/.test(name)).slice(0, 50)) {
        if (/foreground|text|shadow|border|surface|background/.test(property)) continue;
        addSignal(rootStyle.getPropertyValue(property).trim(), /primary|brand/.test(property) ? 'css-primary' : 'css-accent', `CSS variable ${property}`, 0.92);
      }
      for (const node of document.querySelectorAll('a[class*="logo"] svg, [class*="brand-logo"] svg, svg[aria-label*="logo" i], header a[href="/"] svg, header a[aria-label*="home" i] svg')) {
        if (node.getBoundingClientRect().width < 12) continue;
        for (const path of [node, ...node.querySelectorAll('path, rect, circle')]) addSignal(getComputedStyle(path).fill, 'logo', 'Visible home logo SVG fill', 0.90);
      }
      for (const node of document.querySelectorAll('main button, main a[class*="btn"], main a[class*="button"], main [role="button"], nav a, header a')) {
        const box = node.getBoundingClientRect();
        if (box.width < 12 || box.height < 12) continue;
        const computed = getComputedStyle(node);
        if (computed.visibility === 'hidden' || computed.display === 'none') continue;
        if (!/cookie|consent|privacy|accept all|reject all/i.test(`${node.textContent} ${node.closest('[id*="cookie" i],[class*="cookie" i],[id*="onetrust" i]')?.id || ''}`)) addSignal(computed.backgroundColor, 'cta', `Visible control: ${(node.textContent || '').trim().slice(0, 55)}`, 0.84);
        if (node.closest('nav, header')) addSignal(computed.color, 'navigation', 'Visible navigation text', 0.66);
      }
      addSignal(bodyBg, 'background', 'Computed body background', 0.95);
      addSignal(bodyColor, 'body-text', 'Computed body text', 0.95);
      const sampleNodes = document.querySelectorAll('h1, h2, h3, a, button, [class*="accent"], [class*="brand"], [class*="primary"]');
      for (const node of sampleNodes) {
        const s = window.getComputedStyle(node);
        const c1 = rgbToHex(s.color);
        const c2 = rgbToHex(s.backgroundColor);
        if (c1 && lum(c1) > 0.05 && lum(c1) < 0.95) colorSamples.push(c1);
        if (c2 && lum(c2) > 0.05 && lum(c2) < 0.95) colorSamples.push(c2);
      }

      return {
        bodyBg,
        bodyColor,
        isDark,
        h1Font,
        bodyFont,
        headingWeight,
        btnBg,
        btnColor,
        btnRadius,
        cardBg,
        cardRadius,
        colorSamples: colorSamples.slice(0, 24),
        brandSignals,
      };
    });
  } catch { /* visual dna optional */ }

  // ---- disclosed library versions (non-invasive fingerprint checks)
  try {
    probe.libs = await page.evaluate(() => {
      const out = {};
      try { if (window.jQuery && window.jQuery.fn) out.jquery = String(window.jQuery.fn.jquery || ''); } catch { /* noop */ }
      try { if (window.__NEXT_DATA__) out.nextjs = true; } catch { /* noop */ }
      try { if (window.ga || window.gtag) out.analytics = true; } catch { /* noop */ }
      return out;
    });
  } catch { /* optional */ }


  // ---- homepage screenshot (JPEG, size-capped)
  if (limits.keepScreenshots && response && response.status() >= 200 && response.status() < 400) {
    try {
      await page.setViewportSize({ width: limits.screenshotWidth || 1440, height: limits.screenshotHeight || 900 });
      let buf = await page.screenshot({ type: 'jpeg', quality: 64, fullPage: false });
      if (buf.length > limits.maxScreenshotBytes) buf = await page.screenshot({ type: 'jpeg', quality: 44, fullPage: false });
      if (buf.length <= limits.maxScreenshotBytes) doc.screenshotBuffer = buf;
    } catch (e) { console.warn('screenshot capture skipped:', e.message || e); }
  }

  await page.close().catch(() => {});
  return { doc, probe };
}


async function crawlOne(context, target, limits, budgetLeft) {
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error' && consoleErrors.length < limits.maxConsoleEntries) {
      consoleErrors.push({ text: trunc(msg.text(), 220) });
    }
  });
  page.on('pageerror', (err) => {
    if (consoleErrors.length < limits.maxConsoleEntries) {
      consoleErrors.push({ text: trunc(`Uncaught ${err.message || 'script error'}`, 220) });
    }
  });
  page.on('requestfailed', (req) => {
    if (failedRequests.length < limits.maxFailedRequests) {
      // store host+path only — never record query strings (may carry tokens)
      let safe = req.url();
      try {
        const u = new URL(req.url());
        safe = u.hostname + u.pathname;
      } catch { /* keep raw */ }
      failedRequests.push({ url: trunc(safe, 160), method: req.method(), error: trunc(req.failure()?.errorText || 'failed', 80) });
    }
  });

  const t0 = Date.now();
  let response = null;
  let navError = null;
  try {
    response = await page.goto(target, {
      timeout: Math.min(limits.navTimeoutMs, Math.max(4000, budgetLeft())),
      waitUntil: 'domcontentloaded',
    });
    // allow late scripts and above-the-fold layout to settle
    await page.waitForTimeout(800);
    try {
      await page.waitForLoadState('networkidle', { timeout: 2600 });
    } catch { /* long-poll apps never go idle — fine */ }
  } catch (e) {
    navError = trunc(e.message || 'navigation failed', 120);
  }

  let html = '';
  let capped = false;
  try {
    html = await page.content();
    if (html.length > limits.maxHtmlBytes) {
      html = html.slice(0, limits.maxHtmlBytes);
      capped = true;
    }
  } catch { /* navigation raced — keep empty */ }

  let title = '';
  try {
    title = trunc(await page.title(), 300);
  } catch { /* closed mid-flight */ }

  const out = {
    url: target,
    finalUrl: page.url() || target,
    status: response ? response.status() : 0,
    loadMs: Date.now() - t0,
    title,
    html,
    capped,
    headers: response ? response.headers() : {},
    consoleErrors,
    failedRequests,
    navError,
    screenshotBuffer: null,
  };

  // homepage full-render screenshot (JPEG, size-capped)
  if (limits.keepScreenshots && response && response.status() === 200) {
    try {
      let buf = await page.screenshot({ type: 'jpeg', quality: 64, fullPage: false });
      if (buf.length > limits.maxScreenshotBytes) {
        buf = await page.screenshot({ type: 'jpeg', quality: 44, fullPage: false });
      }
      if (buf.length <= limits.maxScreenshotBytes) out.screenshotBuffer = buf;
    } catch (e) { console.warn('screenshot capture skipped:', e.message || e); }
  }

  await page.close().catch(() => {});
  return out;
}

/**
 * Render a site with headless Chromium and capture its first pages.
 * Callers must validateTarget() the start URL first — this function validates
 * it again (defense in depth) and firewalls every request the page makes.
 */
export async function crawlRendered(startUrl, limits = {}) {
  const L = { ...CRAWL_LIMITS, keepScreenshots: true, deepProbe: true, ...limits };
  const started = Date.now();
  const budgetLeft = () => L.totalBudgetMs - (Date.now() - started);

  const { url, host } = await validateTarget(startUrl);
  if (budgetLeft() < 12000) throw new CrawlBlockedError('budget');

  let exe = null;
  try {
    exe = await chromiumPath();
  } catch {
    exe = null;
  }

  const launchArgs = [
    ...(sparticuz.args || []),
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-blink-features=AutomationControlled',
  ];

  const launchOpts = {
    headless: true,
    args: launchArgs,
  };
  if (exe) launchOpts.executablePath = exe;

  let browser;
  try {
    browser = await pw.launch(launchOpts);
  } catch (launchErr) {
    console.warn('[browserCrawl] Chromium launch failed, falling back to HTTP:', launchErr.message);
    throw new CrawlBlockedError('browser', { details: launchErr.message, stage: 'browser_launch' });
  }

  try {
    const allow = makeHostFirewall();
    const context = await browser.newContext({
      userAgent: REALISTIC_BROWSER_UA,
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
      },
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      javaScriptEnabled: true,
      offline: false,
      bypassCSP: true,
      ignoreHTTPSErrors: true,
    });

    // request firewall — protocol, credentials, hostname, DNS ranges
    await context.route('**/*', async (route) => {
      try {
        const req = route.request();
        const u = req.url();
        if (req.resourceType() === 'media') return route.abort('blockedbyclient'); // size limits
        if (SKIP_PROTOCOLS.test(u)) return route.abort('blockedbyclient');
        if (!(await allow(u))) return route.abort('blockedbyclient');
        return route.continue();
      } catch {
        return route.abort('blockedbyclient').catch(() => {});
      }
    });

    // anti-bot challenge evasion — mask automation flags
    await context.addInitScript(() => {
      try {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.chrome = window.chrome || { runtime: {} };
      } catch { /* ignore */ }
    });

    // real user-metric observers run before any page script
    await context.addInitScript(VITALS_INIT);

    // deep homepage probe: render + vitals + axe + viewport sweeps
    let home;
    let probe = null;
    if (L.deepProbe) {
      const deep = await deepProbeOne(context, url, L, budgetLeft);
      home = deep.doc;
      probe = deep.probe;
    } else {
      home = await crawlOne(context, url, L, budgetLeft);
    }

    const pages = [home];

    // crawl additional pages discovered from the homepage HTML links
    if (L.pageLimit > 1 && home.html) {
      const linkRe = /<a\s[^>]*href=["']([^"'#]+)["'][^>]*>/gi;
      const candidates = [];
      let m;
      while ((m = linkRe.exec(home.html)) && candidates.length < 120) {
        if (!SKIP_PROTOCOLS.test(m[1])) candidates.push({ url: new URL(m[1], home.finalUrl).toString() });
      }
      // capture additional pages with their own screenshots when the budget allows
      let shotCount = 0;
      for (const next of pickInternal(candidates, host, L.pageLimit - 1)) {
        if (budgetLeft() < 9000) break;
        try {
          await validateTarget(next); // same host, but re-check (defense in depth)
          const takeShot = shotCount < 3 && budgetLeft() > 14000;
          const doc = await crawlOne(context, next, { ...L, keepScreenshots: takeShot ? true : false }, budgetLeft);
          if (doc.screenshotBuffer) shotCount++;
          pages.push(doc);
        } catch (e) {
          pages.push({
            url: next,
            finalUrl: next,
            status: 0,
            loadMs: 0,
            title: '',
            html: '',
            capped: false,
            headers: {},
            consoleErrors: [],
            failedRequests: [],
            navError: trunc(e.message || 'skipped', 120),
            screenshotBuffer: null,
          });
        }
      }
    }

    return {
      pages,
      probe,
      captureMode: 'browser',
      engine: 'chromium',
      totalMs: Date.now() - started,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}
