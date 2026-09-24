/**
 * Deterministic fact extraction — the ONLY inputs an interpretation is
 * allowed to lean on. Everything here is measured from the crawl: raw DOM
 * fields, page table rows, probed link statuses, audit scores. No guessing.
 */

const cap = (s, n) => (typeof s === 'string' ? s.slice(0, n) : '');

export function deterministicFacts({ x, subX, pages, probed, home, robots, redirects, audit, host, url, captureMode }) {
  const subPages = subX || [];
  const allHeadings = [...x.headings, ...subPages.flatMap((s) => s.headings || []).slice(0, 16)]
    .slice(0, 22)
    .map((h) => `H${h.level}: ${cap(h.text, 120)}`);
  const paragraphs = [...x.paragraphs, ...subPages.flatMap((s) => s.paragraphs || []).slice(0, 6)]
    .slice(0, 10)
    .map((p) => cap(p, 300));

  const linkTexts = (x.links || [])
    .map((l) => (l.text || '').trim())
    .filter((t) => t.length > 2 && t.length < 40)
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .slice(0, 14);

  const broken = (probed || []).filter((p) => !p.ok);

  return {
    capture: {
      mode: captureMode || 'document',
      scannedAt: new Date().toISOString(),
      utfNote: 'All fields below were extracted from the live site at scan time.',
    },
    identity: {
      host,
      finalUrl: url,
      pageTitle: cap(x.title || '', 180),
      ogSiteName: cap(x.meta['og:site_name'] || '', 80),
      ogTitle: cap(x.meta['og:title'] || '', 140),
      metaDescription: cap(x.meta.description || x.meta['og:description'] || '', 240),
      language: x.lang || null,
      viewportMeta: x.meta.viewport || null,
    },
    headings: allHeadings,
    paragraphSamples: paragraphs,
    linkLabels: linkTexts,
    pages: (pages || []).map((p) => ({ path: p.path, title: cap(p.title || p.h1 || '', 90), status: p.status, loadMs: p.loadMs, words: p.words })),
    techSignals: (x.tech || []).map((t) => ({ name: t.name, category: t.category })),
    fonts: x.fonts || [],
    brandColors: (x.colors || []).slice(0, 6).map((c) => c.hex),
    measuredMetrics: {
      homepage: { status: home.status, ttfbMs: audit?.vitals?.ttfbMs ?? home.ms, loadMs: home.ms, sizeKb: Math.round((home.html || '').length / 1024) },
      vitals: audit?.vitals ?? null,
      audit: audit
        ? {
            overall: audit.overall,
            grade: audit.grade,
            categoryScores: Object.fromEntries((audit.categories || []).map((c) => [c.key, c.score])),
            criticalCount: audit.counts?.critical ?? 0,
            warningCount: audit.counts?.warning ?? 0,
          }
        : null,
      linkHealth: { probed: (probed || []).length, broken: broken.length },
      robotsTxt: !!robots,
      redirectHops: (redirects || []).length ? (redirects || []).length - 1 : 0,
      pageCount: (pages || []).length,
    },
  };
}
