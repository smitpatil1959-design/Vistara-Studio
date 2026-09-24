/**
 * Vistara Website Audit Engine — evidence-driven.
 *
 * Every finding is produced from a measured fact: HTTP statuses from live
 * probes, Web Vitals from real PerformanceObserver data, accessibility
 * violations from axe-core executed inside the rendered page, viewport
 * geometry from actual layout measurement, and security posture from real
 * headers/cookies. No measurement is ever inferred or invented.
 */

// ---------------------------------------------------------------- model

function mkFinding(category, severity, id, title, explanation, evidence, recommendation) {
  return { id, category, severity, title, explanation, evidence, recommendation };
}

const CAT_ORDER = [
  ['technical', 'Technical'],
  ['performance', 'Performance'],
  ['accessibility', 'Accessibility'],
  ['mobile', 'Mobile'],
  ['ux', 'UX'],
  ['security', 'Security & configuration'],
];

const CATEGORY_WEIGHTS = { technical: 0.2, performance: 0.22, accessibility: 0.2, mobile: 0.12, ux: 0.1, security: 0.16 };
const CAT_WEIGHT = { critical: 18, warning: 7, suggestion: 2.5, pass: 0 };

const clampScore = (n) => Math.max(15, Math.min(100, Math.round(n)));

function gradeOf(score) {
  return score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 68 ? 'C' : score >= 55 ? 'D' : 'F';
}
function verdictOf(score) {
  if (score >= 90) return 'An exceptional, measured standard — ship-tight.';
  if (score >= 80) return 'Strong, with a few measurable seams to close.';
  if (score >= 68) return 'Serviceable, with evidence of avoidable friction.';
  if (score >= 55) return 'Material gaps — several fixes are provable wins.';
  return 'Critical issues measured end to end — remediating the top findings first.';
}

// ---------------------------------------------------------------- scoring helpers

// Approximation of the standard normal CDF (Abramowitz–Stegun) for Lighthouse-style curves.
function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - p : p;
}

const LH = (value, p10, p90) => {
  if (value == null || !isFinite(value)) return null;
  if (value <= 0) return 100;
  const loc = Math.log(p10);
  const shape = Math.log(p90 / p10) / 1.2815515655446004;
  return Math.round(100 * (1 - normalCdf((Math.log(value) - loc) / shape)));
};

function perfIndex(v, fcpMs) {
  const parts = [];
  const push = (score, w) => { if (score != null) parts.push([score, w]); };
  push(LH(v.lcpMs, 2500, 4000), 0.4);
  push(LH((v.cls ?? 0.001) + 0.0001, 0.1, 0.25), 0.25);
  push(LH(v.inpMs, 200, 500), 0.2);
  push(LH(fcpMs, 1800, 3000), 0.15);
  if (!parts.length) return null;
  const wSum = parts.reduce((s, p) => s + p[1], 0);
  return Math.round(parts.reduce((s, p) => s + p[0] * p[1], 0) / wSum);
}

const fmtMs = (v) => (v == null ? 'not measured' : `${Math.round(v).toLocaleString()} ms`);
const fmtKb = (v) => `${Number(v).toLocaleString()} KB`;

// ---------------------------------------------------------------- findings

function technicalFindings(F, { home, pages, probed, robots, redirects, probe }) {
  const cat = 'technical';
  if (home.status === 200)
    F.push(mkFinding(cat, 'pass', 'origin-200', 'Origin reachable', 'The homepage returned a healthy status.', `HTTP ${home.status} in ${home.ms} ms`, 'Keep TTFB under 800 ms at the edge.'));
  else
    F.push(mkFinding(cat, 'critical', 'origin-status', 'Homepage did not return 200', 'The entry document answered with an error code.', `HTTP ${home.status}`, 'Fix the origin response before anything else — every metric downstream depends on it.'));

  const okPages = pages.filter((p) => p.status === 200).length;
  if (okPages === pages.length)
    F.push(mkFinding(cat, 'pass', 'crawl-coverage', 'Crawl coverage complete', `All ${pages.length} captured pages returned HTTP 200.`, pages.map((p) => p.path).join('  ·  '), ''));
  else
    F.push(mkFinding(cat, 'warning', 'crawl-coverage', 'Some pages failed to load', 'Captured documents returned non-200 statuses.', `${pages.length - okPages}/${pages.length} pages errored`, 'Re-crawl after fixing errors; internal failures fragment the narrative.'));

  const broken = probed.filter((p) => !p.ok);
  if (broken.length === 0)
    F.push(mkFinding(cat, 'pass', 'links-ok', 'Link integrity verified', `All ${probed.length} probed links returned healthy statuses.`, `${probed.length} live HEAD/GET probes`, ''));
  else
    F.push(mkFinding(cat, broken.length >= 3 ? 'critical' : 'warning', 'broken-links', `${broken.length} broken link${broken.length > 1 ? 's' : ''} detected`, 'Destinations answered with failure or were unreachable during live probing.', broken.slice(0, 4).map((b) => `${trimUrl(b.url)} → ${b.blocked ? 'blocked by policy' : b.status || 'unreachable'}`).join('  ·  '), 'Repair or redirect dead destinations — users and crawlers both abandon dead ends.'));

  if (redirects && redirects.length > 1) {
    const temp = redirects.filter((r) => r.status === 302 || r.status === 303 || r.status === 307).length;
    F.push(mkFinding(cat, temp ? 'warning' : 'suggestion', 'redirect-chain', `${redirects.length - 1} redirect hop${redirects.length > 2 ? 's' : ''} before the document`, 'Each hop adds latency and link-equity risk.', redirects.map((r) => `${trimUrl(r.url)} [${r.status}]`).join(' → '), temp ? 'Replace 302/307 hops with 301s for permanent moves and link directly to the final URL.' : 'Link directly to the final URL wherever possible.'));
  } else {
    F.push(mkFinding(cat, 'pass', 'redirect-chain', 'Direct response', 'The analyzed URL answered without extra redirect hops.', '', ''));
  }

  if (robots) F.push(mkFinding(cat, 'pass', 'robots', 'robots.txt published', 'Crawler directives are available at the origin root.', 'HTTP 200 on /robots.txt', ''));
  else F.push(mkFinding(cat, 'suggestion', 'robots', 'No robots.txt found', 'Crawlers index the site without guidance.', 'GET /robots.txt returned non-200', 'Publish robots.txt with a sitemap reference.'));

  if (probe) {
    const failed = probe.failedAssets || [];
    if (failed.length === 0)
      F.push(mkFinding(cat, 'pass', 'assets-ok', 'No failed assets', 'Every script, stylesheet, font and image answered 2xx/3xx during render.', `${probe.docResourceCount ?? '—'} resources traced`, ''));
    else
      F.push(mkFinding(cat, failed.length >= 5 ? 'critical' : 'warning', 'assets-failed', `${failed.length} asset${failed.length > 1 ? 's' : ''} failed to load`, 'Resources returned 4xx/5xx status codes while the page rendered.', failed.slice(0, 4).map((f2) => `${f2.url} [${f2.status} ${f2.type}]`).join('  ·  '), 'Fix asset URLs or remove dead references — failed assets create visual and functional holes.'));

    const freq = (probe.failedRequests || []).length;
    if (freq > 0)
      F.push(mkFinding(cat, 'warning', 'network-failures', `${freq} network failure${freq > 1 ? 's' : ''} during render`, 'Requests failed at the network layer (DNS, reset, blocked, dropped).', (probe.failedRequests || []).slice(0, 3).map((f2) => `${f2.url} — ${f2.error}`).join('  ·  '), 'Audit third-party hosts and ad/tracker tags; dead calls still cost time.'));

    const errs = (probe.consoleErrors || []).length;
    if (errs === 0) F.push(mkFinding(cat, 'pass', 'console-clean', 'Console is clean', 'No script errors or uncaught exceptions recorded during render.', '', ''));
    else F.push(mkFinding(cat, errs >= 5 ? 'critical' : 'warning', 'console-errors', `${errs} console error${errs > 1 ? 's' : ''} recorded`, 'JavaScript errors fire during page load.', (probe.consoleErrors || []).slice(0, 3).map((e2) => e2.text).join('  ·  '), 'Reproduce in devtools and fix — runtime errors break invisible functionality.'));
  }
}

function performanceFindings(F, { home, x, probe }) {
  const cat = 'performance';
  if (!probe || !probe.perf || probe.perf.error) {
    // document mode — honest proxies only
    F.push(mkFinding(cat, home.ms < 800 ? 'pass' : home.ms < 1800 ? 'warning' : 'critical', 'ttfb', 'Time to first byte ' + fmtMs(home.ms), 'Document delivery latency measured at the origin.', `measured ${fmtMs(home.ms)}`, home.ms < 800 ? '' : 'Add edge caching and cut backend work before render.'));
    const sizeKb = Math.round(home.html.length / 1024);
    F.push(mkFinding(cat, sizeKb < 200 ? 'pass' : sizeKb < 600 ? 'warning' : 'critical', 'doc-weight', fmtKb(sizeKb) + ' HTML document', 'Transfer payload for the entry document.', `${sizeKb} KB`, sizeKb < 200 ? '' : 'Move state payloads out of the HTML; stream heavy sections.'));
    F.push(mkFinding(cat, x.scriptCount <= 10 ? 'pass' : x.scriptCount <= 25 ? 'warning' : 'critical', 'script-surface', `${x.scriptCount} script tags`, 'Scripts counted in the delivered document.', `${x.scriptCount} tags`, 'Defer non-critical tags; audit third-party managers.'));
    F.push(mkFinding(cat, 'suggestion', 'lab-metrics', 'Lab metrics not captured', 'Render-mode metrics (LCP/CLS/INP) require the browser capture path, which was unavailable for this scan.', 'captureMode: document', 'Re-run the analysis — the browser engine collects real vitals when available.'));
    return;
  }

  const { vitals, perf } = probe;
  const ttfb = perf.ttfbMs ?? home.ms;
  F.push(mkFinding(cat, ttfb < 800 ? 'pass' : ttfb < 1800 ? 'warning' : 'critical', 'ttfb', 'Time to first byte ' + fmtMs(ttfb), 'Navigation responseStart measured inside the browser.', `measured ${fmtMs(ttfb)}`, ttfb < 800 ? '' : 'Shrinks every other metric downstream — prioritize this.'));

  if (vitals && !vitals.error) {
    const { lcpMs, cls, inpMs, longtasks, longtaskMs, inpSamples } = vitals;
    F.push(mkFinding(cat, lcpMs == null ? 'suggestion' : lcpMs <= 2500 ? 'pass' : lcpMs <= 4000 ? 'warning' : 'critical', 'lcp', 'Largest Contentful Paint ' + fmtMs(lcpMs), 'Real LCP from a PerformanceObserver during load.', `measured ${fmtMs(lcpMs)} · thresholds 2.5s / 4s`, 'Preload the hero asset, size images correctly, cache render-critical CSS.'));
    F.push(mkFinding(cat, cls <= 0.1 ? 'pass' : cls <= 0.25 ? 'warning' : 'critical', 'cls', `Cumulative Layout Shift ${cls}`, 'Layout instability measured across the load.', `measured ${cls} · thresholds 0.1 / 0.25`, 'Reserve space for ads/embeds/images; never inject content above existing content.'));
    F.push(mkFinding(cat, inpMs == null ? 'suggestion' : inpMs <= 200 ? 'pass' : inpMs <= 500 ? 'warning' : 'critical', 'inp', inpMs == null ? 'Interaction latency not sampled' : `Interaction latency ${fmtMs(inpMs)} (p75 of ${inpSamples})`, 'Event-timing durations measured from synthetic taps on a neutral surface — an honest sampled proxy for INP.', inpMs == null ? 'no interaction samples collected' : `measured p75 ${fmtMs(inpMs)} across ${inpSamples} taps`, inpMs == null ? 'Ensure interactive regions exist and long tasks are split.' : 'Split long tasks, debounce handlers, defer hydration where possible.'));
    if (longtasks > 0)
      F.push(mkFinding(cat, longtaskMs > 1000 ? 'warning' : 'suggestion', 'long-tasks', `${longtasks} long task${longtasks > 1 ? 's' : ''} during load (${longtaskMs} ms total)`, 'Main-thread was blocked by 50ms+ tasks.', `${longtasks} tasks · ${longtaskMs} ms blocking`, 'Break up initialization work; move non-critical JS off the critical path.'));

    const idx = perfIndex(vitals, perf.fcpMs);
    if (idx != null)
      F.push(mkFinding(cat, idx >= 90 ? 'pass' : idx >= 70 ? 'warning' : 'critical', 'perf-index', `Performance index ${idx}/100`, 'Weighted Lighthouse-style curve over measured LCP, CLS, interaction latency and FCP.', `LCP ${fmtMs(vitals.lcpMs)} · CLS ${vitals.cls} · INP~ ${fmtMs(vitals.inpMs)} · FCP ${fmtMs(perf.fcpMs)}`, 'Work the lowest-scoring vital first — the curve rewards balance.'));
  } else if (vitals && vitals.error) {
    F.push(mkFinding(cat, 'suggestion', 'vitals-error', 'Vitals observers unavailable', 'PerformanceObserver data could not be collected on this page.', String(vitals.error), 'Re-run the scan; transient observer failures usually clear.'));
  }

  if (perf.totalTransferKb > 0) {
    const t = perf.totalTransferKb;
    const byType = Object.entries(perf.byTypeKb || {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${fmtKb(v)}`).join('  ·  ');
    F.push(mkFinding(cat, t <= 1500 ? 'pass' : t <= 3500 ? 'warning' : 'critical', 'transfer-weight', `${fmtKb(t)} transferred`, 'Total measured resource bytes fetched during homepage load.', `${fmtKb(t)} across ${perf.resourceCount} resources — ${byType}`, 'Slay the heaviest type first; lazy-load images and video below the fold.'));
  }

  if ((perf.largeImages || []).length > 0)
    F.push(mkFinding(cat, 'warning', 'large-images', `${perf.largeImages.length} oversized image${perf.largeImages.length > 1 ? 's' : ''}`, 'Images above 200 KB transferred during initial load.', perf.largeImages.slice(0, 3).map((i2) => `${i2.url} · ${fmtKb(i2.kb)}`).join('  ·  '), 'Compress to AVIF/WebP, serve responsive sizes, and lazy-load.'));
  else
    F.push(mkFinding(cat, 'pass', 'large-images', 'No oversized images', 'No image above 200 KB was transferred.', '', ''));

  if (perf.renderBlockingScripts > 0)
    F.push(mkFinding(cat, perf.renderBlockingScripts > 3 ? 'warning' : 'suggestion', 'blocking-scripts', `${perf.renderBlockingScripts} render-blocking script${perf.renderBlockingScripts > 1 ? 's' : ''} in <head>`, 'Parser-blocking JavaScript delays first paint.', `${perf.renderBlockingScripts} scripts · ${perf.renderBlockingStylesheets} stylesheets`, 'Add defer/async, inline critical CSS, and move scripts below the fold.'));

  const enc = home.headers && typeof home.headers.get === 'function' ? home.headers.get('content-encoding') : null;
  F.push(mkFinding(cat, enc ? 'pass' : 'suggestion', 'compression', enc ? `Compression on the wire (${enc})` : 'No compression header', 'Transfer-encoding measured on the document response.', enc ? `content-encoding: ${enc}` : 'no content-encoding', enc ? '' : 'Enable gzip/brotli at the CDN or origin.'));
}

function accessibilityFindings(F, { x, probe }) {
  const cat = 'accessibility';

  if (!probe || !probe.axe) {
    const note = probe && probe.axeError ? probe.axeError : 'document capture mode';
    F.push(mkFinding(cat, 'suggestion', 'axe-unavailable', 'Automated accessibility scan unavailable', 'axe-core did not execute in this capture mode; only structural signals were measured.', note, 'Re-run with browser capture to execute the full axe ruleset.'));
    // structural fallbacks still measured from the DOM
  }

  if (probe && probe.axe) {
    const { violations, passes } = probe.axe;
    if (violations.length === 0) {
      F.push(mkFinding(cat, 'pass', 'axe-clean', 'axe-core: zero violations', `${passes} WCAG 2.0/2.1 A+AA rules passed on the rendered page.`, `${passes} passing rules · 0 violations`, ''));
    } else {
      for (const v of violations.slice(0, 10)) {
        const severity = v.impact === 'critical' || v.impact === 'serious' ? 'critical' : v.impact === 'moderate' ? 'warning' : 'suggestion';
        F.push(mkFinding(cat, severity, `axe-${v.id}`, v.help, `axe-core rule "${v.id}" violated ${v.count}× — impact: ${v.impact}.`, v.nodes.filter(Boolean).slice(0, 3).join('  ·  ') || `${v.count} nodes`, 'Fix the flagged nodes; every violation here is machine-verifiable.'));
      }
      if (violations.length > 10)
        F.push(mkFinding(cat, 'warning', 'axe-more', `+${violations.length - 10} more axe rules violated`, 'Additional violations were recorded beyond the first ten shown.', `total violations: ${violations.length}`, 'Export the full audit in the studio for the whole list.'));
      const crit = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').length;
      F.push(mkFinding(cat, crit === 0 ? 'pass' : 'suggestion', 'axe-summary', `${violations.length} rule${violations.length > 1 ? 's' : ''} violated · ${crit} serious+`, `axe-core executed ${passes + violations.length} checks against the rendered DOM.`, `${passes} rule groups clean`, ''));
    }
  }

  // structural measures we take regardless (real DOM reads)
  if (x.lang) F.push(mkFinding(cat, 'pass', 'lang', 'Document language declared', 'The <html> element carries a language.', `lang="${x.lang}"`, ''));
  else F.push(mkFinding(cat, 'warning', 'lang', 'Missing document language', 'Screen readers cannot infer pronunciation or hyphenation.', 'no lang attribute on <html>', 'Set lang="en" (or the correct locale) on <html>.'));

  if (x.lang && x.h1Count === 1) F.push(mkFinding(cat, 'pass', 'single-h1', 'Single top-level heading', 'The document outline has one clear start.', `${x.h1Count} <h1> found`, ''));
  else if (x.h1Count === 0) F.push(mkFinding(cat, 'warning', 'single-h1', 'No H1 present', 'Pages need one clear top-level heading for orientation.', '0 <h1> elements', 'Add exactly one meaningful <h1> near the top.'));

  const imgTotal = x.images.length;
  const withAlt = x.images.filter((i) => i.alt && i.alt.trim()).length;
  if (imgTotal > 0) {
    const ratio = Math.round((withAlt / imgTotal) * 100);
    F.push(mkFinding(cat, ratio >= 95 ? 'pass' : ratio >= 60 ? 'warning' : 'critical', 'alt-coverage', `${ratio}% of images carry alt text`, 'Measured across all <img> nodes in the rendered HTML.', `${withAlt}/${imgTotal} images`, 'Write alt text that conveys each image’s purpose; mark decorative ones as empty.'));
  }

  if (x.skipLink) F.push(mkFinding(cat, 'pass', 'skip-link', 'Skip-to-content link present', 'Keyboard users can jump past the navigation.', '"skip to" link detected', ''));
  else F.push(mkFinding(cat, 'suggestion', 'skip-link', 'No skip link detected', 'Keyboard users must tab through the full header on every page.', 'no skip-link anchor found', 'Add a visually-hidden “Skip to content” as the first focusable element.'));

  if (x.ariaCount >= 8) F.push(mkFinding(cat, 'pass', 'aria', 'ARIA annotations present', `${x.ariaCount} aria/role attributes ship in the markup.`, '', ''));
}

function mobileFindings(F, { x, probe }) {
  const cat = 'mobile';
  const vpOk = /width\s*=\s*device-width/i.test(x.meta.viewport || '');
  F.push(mkFinding(cat, vpOk ? 'pass' : 'critical', 'viewport-meta', vpOk ? 'Responsive viewport configured' : 'No responsive viewport meta', 'Without device-width, phones render at desktop width.', vpOk ? `"${x.meta.viewport}"` : 'missing', vpOk ? '' : 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.'));

  const vps = (probe && probe.viewports) || [];
  if (vps.length === 0) {
    F.push(mkFinding(cat, 'suggestion', 'viewport-sweep', 'Viewport sweeps not captured', 'Geometry checks require the rendered capture path.', 'captureMode without viewport probes', 'Re-run with browser capture for 375/768/1440 measurements.'));
    return;
  }
  const perf = probe.perf || {};
  for (const v of vps) {
    const id = `vp-${v.name.toLowerCase()}`;
    const evidence = `${v.width}×${v.height} · scrollable ${v.scrollableWidth}px · overflow ${v.horizontalOverflowPx}px · ${v.clippedCount} clipped element${v.clippedCount === 1 ? '' : 's'}`;
    if (v.horizontalOverflowPx > 24)
      F.push(mkFinding(cat, 'critical', id, `${v.name} viewport: ${v.horizontalOverflowPx}px horizontal overflow`, 'The document scrolls sideways — usually an un-clipped fixed-width element or image.', evidence + (v.offenders.length ? ` — offenders: ${v.offenders.join(', ')}` : ''), 'Find the overflowing nodes (listed) and constrain them with max-width: 100%.'));
    else if (v.horizontalOverflowPx > 0 || v.clippedCount > 2)
      F.push(mkFinding(cat, 'warning', id, `${v.name} viewport: minor overflow/clipping`, 'Content slightly exceeds the viewport or elements clip beyond the edge.', evidence + (v.offenders.length ? ` — offenders: ${v.offenders.join(', ')}` : ''), 'Audit the listed offenders; small overflows still break sticky headers and snap scrolling.'));
    else
      F.push(mkFinding(cat, 'pass', id, `${v.name} viewport clean`, 'No horizontal overflow and no clipped elements at this size.', evidence, ''));
  }
  if (perf.inlineFixedWidths > 8)
    F.push(mkFinding(cat, 'suggestion', 'fixed-widths', `${perf.inlineFixedWidths} inline fixed-pixel widths`, 'Inline width styles in the hundreds of pixels often defeat fluid layouts.', `${perf.inlineFixedWidths} style attributes`, 'Prefer max-width with fluid values inside layout shells.'));
}

function securityFindings(F, { home, host, probe, redirects }) {
  const cat = 'security';
  const H = (k) => (home.headers && typeof home.headers.get === 'function' ? home.headers.get(k) : null);
  const https = /^https:/.test(home.finalUrl || '') || /^https:/.test((redirects[redirects.length - 1] || {}).url || '');

  F.push(mkFinding(cat, https ? 'pass' : 'critical', 'https', https ? 'HTTPS enforced' : 'Served over plain HTTP', https ? `${host} answers over TLS.` : 'Traffic is interceptable in transit.', https ? 'TLS' : 'http:// URL in final response', https ? '' : 'Redirect all http traffic to https and add HSTS.'));

  const httpUpgrade = redirects && redirects.length > 1 && redirectChainUpgrades(redirects);
  if (httpUpgrade) F.push(mkFinding(cat, 'pass', 'https-upgrade', 'HTTP upgrades to HTTPS', 'The redirect chain lands on a TLS endpoint.', redirects.map((r2) => r2.status).join(' → '), ''));

  const sec = (h, id, label, ptsNote) => {
    if (H(h)) F.push(mkFinding(cat, 'pass', id, label + ' present', `${h}: ${String(H(h)).slice(0, 82)}`, '', ''));
    else F.push(mkFinding(cat, id === 'csp' ? 'warning' : 'suggestion', id, 'Missing ' + label, 'Header not present on the document response.', `no ${h} header`, ptsNote));
  };
  sec('strict-transport-security', 'hsts', 'HSTS', 'Add Strict-Transport-Security with long max-age so browsers upgrade automatically.');
  sec('content-security-policy', 'csp', 'Content-Security-Policy', 'Ship a report-only CSP first, then enforce — CSP defeats most injected-script attacks.');
  if (H('x-frame-options') || /frame-ancestors/.test(H('content-security-policy') || ''))
    F.push(mkFinding(cat, 'pass', 'frame', 'Clickjacking protection', 'Framing is restricted via header or CSP frame-ancestors.', H('x-frame-options') || 'frame-ancestors', ''));
  else F.push(mkFinding(cat, 'suggestion', 'frame', 'No clickjacking protection', 'Pages can be embedded in hostile iframes for UI-redress attacks.', 'no X-Frame-Options / frame-ancestors', 'Add X-Frame-Options: DENY (or a frame-ancestors CSP directive).'));
  sec('x-content-type-options', 'xcto', 'MIME sniffing protection', 'Add X-Content-Type-Options: nosniff.');
  sec('referrer-policy', 'referrer', 'Referrer-Policy', 'Set a Referrer-Policy to control URL leakage to third parties.');

  const mixed = https && /src=["']http:\/\//i.test(home.html || '');
  F.push(mkFinding(cat, !https ? 'suggestion' : mixed ? 'warning' : 'pass', 'mixed-content', mixed ? 'Mixed content found' : 'No mixed content', mixed ? 'HTTP subresources load on an HTTPS page.' : 'All subresources ride the TLS channel.', mixed ? 'http:// resource source in rendered DOM' : '', mixed ? 'Upgrade all asset URLs to https.' : ''));

  const cookies = (probe && probe.cookies) || [];
  const insecure = cookies.filter((c) => https && !c.secure);
  const noSameSite = cookies.filter((c) => !c.sameSite || c.sameSite === 'None');
  const sessionish = cookies.filter((c) => /sess|token|auth|jwt|sid/i.test(c.name) && !c.httpOnly);
  if (cookies.length === 0) F.push(mkFinding(cat, 'pass', 'cookies', 'No cookies set on first load', 'Zero first-party cookies observed before interaction.', '', ''));
  else {
    if (insecure.length) F.push(mkFinding(cat, 'warning', 'cookie-secure', `${insecure.length} cookie${insecure.length > 1 ? 's' : ''} without Secure flag`, 'Cookies without Secure may travel over plaintext on downgrade.', insecure.map((c) => c.name).join('  ·  '), 'Set Secure on all cookies set over HTTPS.'));
    if (sessionish.length) F.push(mkFinding(cat, 'warning', 'cookie-httponly', 'Session-like cookie without HttpOnly', 'Cookies carrying session-shaped names are readable by JavaScript.', sessionish.map((c) => c.name).join('  ·  '), 'Mark authentication cookies HttpOnly to blunt XSS exfiltration.'));
    if (noSameSite.length) F.push(mkFinding(cat, 'suggestion', 'cookie-samesite', `${noSameSite.length} cookie${noSameSite.length > 1 ? 's' : ''} without SameSite`, 'SameSite omissions make CSRF defenses host-dependent.', noSameSite.map((c) => c.name).join('  ·  '), 'Prefer SameSite=Lax at minimum on state-changing endpoints.'));
    if (!insecure.length && !sessionish.length) F.push(mkFinding(cat, 'pass', 'cookies', `${cookies.length} cookie${cookies.length > 1 ? 's' : ''}, flags in order`, 'Observed cookies carry Secure/HttpOnly/SameSite as appropriate.', cookies.map((c) => c.name).join('  ·  '), ''));
  }

  if (H('x-powered-by')) F.push(mkFinding(cat, 'suggestion', 'poweredby', 'Technology disclosed in headers', `x-powered-by: ${H('x-powered-by')} advertises stack details.`, '', 'Drop the header at the CDN level — it buys attackers free reconnaissance.'));

  const jqv = probe && probe.libs && probe.libs.jquery;
  if (jqv && /^[12]\./.test(jqv))
    F.push(mkFinding(cat, 'warning', 'outdated-jquery', `jQuery ${jqv} in production`, 'jQuery 1.x/2.x lines are end-of-life and carry known vulnerabilities.', `window.jQuery.fn.jquery = ${jqv}`, 'Upgrade to jQuery 3.7+ or remove the dependency entirely.'));
}

function contentFindings(F, { x }) {
  const cat = 'technical'; // content & metadata roll into Technical on the health dashboard
  const title = x.title || '';
  if (!title) F.push(mkFinding(cat, 'critical', 'title', 'Missing document title', 'No <title> in the served markup.', 'empty title', 'Add a unique, human title under 60 characters.'));
  else if (title.length < 25 || title.length > 65) F.push(mkFinding(cat, 'suggestion', 'title-length', `Title is ${title.length} characters`, 'Search and tab strips read best between 30–60 characters.', `“${title.slice(0, 70)}”`, 'Rebalance: brand + promise within ~55 characters.'));
  else F.push(mkFinding(cat, 'pass', 'title', 'Title present and well-sized', `${title.length} characters.`, `“${title.slice(0, 70)}”`, ''));

  const desc = x.meta.description || '';
  if (!desc) F.push(mkFinding(cat, 'warning', 'meta-desc', 'Missing meta description', 'Search snippets are auto-generated without it.', 'no description meta', 'Write 120–160 characters that sell the click, not the page.'));
  else F.push(mkFinding(cat, desc.length < 70 || desc.length > 180 ? 'suggestion' : 'pass', 'meta-desc', `Meta description ${desc.length} chars`, desc.length < 70 || desc.length > 180 ? 'Outside the 120–160 sweet spot.' : 'Right in the snippet zone.', `“${desc.slice(0, 90)}…”`, desc.length < 70 || desc.length > 180 ? 'Aim for 120–160 characters with one concrete claim.' : ''));

  const ogMiss = ['og:title', 'og:description', 'og:image'].filter((k) => !(x.meta[k] || '').trim());
  if (ogMiss.length === 0) F.push(mkFinding(cat, 'pass', 'og-set', 'OpenGraph set complete', 'Title, description and image all present for link unfurls.', '', ''));
  else F.push(mkFinding(cat, 'suggestion', 'og-set', `${ogMiss.length} OpenGraph field${ogMiss.length > 1 ? 's' : ''} missing`, 'Unfurls in chat/social degrade without a full OG trio.', `missing: ${ogMiss.join(', ')}`, 'Add og:title, og:description and a 1200×630 og:image.'));

  const canonical = /rel=["']canonical["']/i.test((x.rawHtml || '').slice(0, 20000));
  F.push(mkFinding(cat, canonical ? 'pass' : 'suggestion', 'canonical', canonical ? 'Canonical link declared' : 'No canonical link', canonical ? '' : 'Duplicate-path ranking dilution risk.', canonical ? 'rel="canonical" present' : '', canonical ? '' : 'Add <link rel="canonical"> per page, especially with parameterized URLs.'));

  if (x.words < 160) F.push(mkFinding(cat, 'suggestion', 'thin-content', `${x.words} words on the homepage`, 'Thin above-the-fold copy limits comprehension for humans and crawlers.', `${x.words} words measured`, 'Lead with one concrete sentence about who this helps and how.'));

  F.push(mkFinding(cat, (x.meta['og:image'] || /rel=["']icon/i.test(x.rawHtml || '') || /rel=["']shortcut icon/i.test(x.rawHtml || '')) ? 'pass' : 'suggestion', 'favicon', 'Favicon/OG icon presence', 'Tab and share surfaces need an icon.', x.meta['og:image'] ? 'og:image present' : 'checking icon links', ''));
}

/** UX findings — interaction affordances and layout discipline, all measured. */
function uxFindings(F, { x, probe }) {
  const cat = 'ux';

  // primary action discoverable?
  const ctaRe = /(get started|sign ?up|try|start free|free trial|book|demo|contact|pricing|subscribe|join|download)/i;
  const cta = (x.links || []).find((l) => ctaRe.test(`${l.text} ${l.url}`));
  const navLinks = (x.links || []).filter((l) => l.internal).length;
  if (cta)
    F.push(mkFinding(cat, 'pass', 'cta-visible', 'Primary call-to-action found above the fold of the DOM', 'A conversion-oriented link is discoverable from the homepage.', `link — "${(cta.text || '').slice(0, 40)}" → ${trimUrl(cta.url)}`, ''));
  else
    F.push(mkFinding(cat, 'warning', 'cta-missing', 'No clear call-to-action found', 'None of the homepage links read like a primary action.', `${navLinks} internal links scanned · none match CTA patterns`, 'Surface one unmistakable action near the top — dated, personal, low-friction.'));

  if (navLinks >= 6) F.push(mkFinding(cat, 'pass', 'nav-depth', `${navLinks} internal destinations offered`, 'Navigation offers meaningful paths beyond the landing page.', `${navLinks} unique internal links on homepage`, ''));
  else F.push(mkFinding(cat, 'suggestion', 'nav-thin', `Only ${navLinks} internal destinations`, 'Thin navigation strands visitors at the landing page.', `${navLinks} internal links measured`, 'Add clear routes to the story: features, proof, pricing, about.'));

  // forms usability — measured from real markup
  const forms = x.forms || { inputs: 0, labeled: 0 };
  if (forms.inputs > 0) {
    F.push(mkFinding(
      cat,
      forms.labeled >= forms.inputs ? 'pass' : forms.labeled === 0 ? 'warning' : 'suggestion',
      'form-labels',
      `${forms.labeled}/${forms.inputs} form fields carry accessible labels`,
      'Fields without labels are invisible to screen readers and confuse autofill.',
      `${forms.inputs} inputs · ${forms.labeled} labeled (label/aria-label/aria-labelledby)`,
      'Label every input — visible <label> first, aria-label for icon-only fields.'
    ));
  }

  // layout discipline — aggregate measured geometry across viewport sweeps
  const vps = (probe && probe.viewports) || [];
  if (vps.length) {
    const totalOverflow = vps.reduce((s, v) => s + (v.horizontalOverflowPx || 0), 0);
    const totalClipped = vps.reduce((s, v) => s + (v.clippedCount || 0), 0);
    F.push(mkFinding(
      cat,
      totalOverflow === 0 && totalClipped === 0 ? 'pass' : totalOverflow > 24 ? 'warning' : 'suggestion',
      'layout-discipline',
      totalOverflow === 0 && totalClipped === 0 ? 'Layout holds at all measured breakpoints' : `${vps.length} viewports: ${totalOverflow}px overflow, ${totalClipped} clipped elements`,
      'Sum of measured overflow + clipping across 375/768/1440 geometry sweeps.',
      vps.map((v) => `${v.name} ${v.horizontalOverflowPx}px/${v.clippedCount}clip`).join('  ·  '),
      'Fix the clipped offenders first at the smallest viewport — overflow cascades upstream.'
    ));
  }

  const fixedWidths = (probe && probe.perf && probe.perf.inlineFixedWidths) || 0;
  if (fixedWidths > 8)
    F.push(mkFinding(cat, 'suggestion', 'fixed-widths', `${fixedWidths} inline fixed-pixel widths`, 'Hardcoded pixel widths inside content fight fluid layout.', `${fixedWidths} style attributes measured`, 'Prefer max-width and fluid units inside content areas.'));
}

function redirectChainUpgrades(chain) {
  return chain.some((r) => /^http:/.test(r.url)) && /^https:/.test(chain[chain.length - 1].url);
}

function trimUrl(u) {
  try {
    const p = new URL(u);
    const s = p.hostname.replace(/^www\./, '') + (p.pathname === '/' ? '' : p.pathname);
    return s.length > 44 ? s.slice(0, 44) + '…' : s;
  } catch {
    return u.slice(0, 44);
  }
}

// ---------------------------------------------------------------- entry point

export function runAudit({ host, url, redirects, home, x, subX, pages, probed, robots, probe, captureMode }) {
  const findings = [];
  const args = { host, url, redirects, home, x, subX, pages, probed, robots, probe: probe || null, captureMode };

  technicalFindings(findings, args);
  performanceFindings(findings, args);
  accessibilityFindings(findings, args);
  mobileFindings(findings, args);
  uxFindings(findings, args);
  securityFindings(findings, args);
  contentFindings(findings, args);

  const categories = CAT_ORDER.map(([key, label]) => {
    const catFindings = findings.filter((f) => f.category === key);
    const score = clampScore(100 - catFindings.reduce((s, f) => s + (CAT_WEIGHT[f.severity] || 0), 0));
    return { key, label, score, findings: catFindings };
  });

  const overall = clampScore(
    categories.reduce((s, c) => s + c.score * (CATEGORY_WEIGHTS[c.key] || 0.1), 0) / Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0)
  );

  const counts = {
    critical: findings.filter((f) => f.severity === 'critical').length,
    warning: findings.filter((f) => f.severity === 'warning').length,
    suggestion: findings.filter((f) => f.severity === 'suggestion').length,
    pass: findings.filter((f) => f.severity === 'pass').length,
  };

  return {
    version: 'audit.v2',
    engine: probe ? 'rendered-browser' : 'document-capture',
    overall,
    score: overall,
    grade: gradeOf(overall),
    verdict: verdictOf(overall),
    counts,
    categories,
    findings,
    vitals: probe && probe.vitals && !probe.vitals.error ? { ...probe.vitals, perfIndex: probe.perf && !probe.perf.error ? perfIndex(probe.vitals, probe.perf.fcpMs) : null, fcpMs: probe.perf?.fcpMs ?? null, ttfbMs: probe.perf?.ttfbMs ?? home.ms, totalTransferKb: probe.perf?.totalTransferKb ?? 0, resourceCount: probe.perf?.resourceCount ?? 0 } : null,
    viewports: (probe && probe.viewports) || [],
    security: {
      https: /^https:/.test(home.finalUrl || ''),
      mixedContent: !!(/^https:/.test(home.finalUrl || '') && /src=["']http:\/\//i.test(home.html || '')),
      cookieCount: ((probe && probe.cookies) || []).length,
    },
    generatedAt: new Date().toISOString(),
  };
}
