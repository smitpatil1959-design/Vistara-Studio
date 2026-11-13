/**
 * Evidence Extraction Service
 *
 * Extracts factual evidence from crawled pages and web search results.
 * All fields are validated before DB insert — never stores raw objects.
 *
 * Pipeline:
 *   crawl data → typed evidence items → DB insert
 *   search results → validated NormalizedResult → typed evidence items → DB insert
 *
 * Claim type taxonomy mirrors the DB CHECK constraint:
 *   company_description | product | service | feature | pricing | audience |
 *   industry | market | metric | customer | location | integration |
 *   technology | security | business_model | founder | leadership |
 *   partnership | news | competitor | differentiator | observation | other
 */

import supabase from './db-client.js';
import { isHighQualityContent, cleanExtractedText } from './presentation/extractionQuality.js';

/** Valid claim types that match the DB CHECK constraint */
const VALID_CLAIM_TYPES = new Set([
  'company_description', 'product', 'service', 'feature', 'pricing',
  'audience', 'industry', 'market', 'metric', 'customer', 'location',
  'integration', 'technology', 'security', 'business_model', 'founder',
  'leadership', 'partnership', 'news', 'competitor', 'differentiator',
  'observation', 'other',
]);

function safeClaimType(type) {
  return VALID_CLAIM_TYPES.has(type) ? type : 'other';
}

/**
 * Ensure a value is a non-empty string — prevents [object Object] from reaching DB.
 * @param {unknown} v
 * @param {string} fallback
 * @returns {string}
 */
function safeStr(v, fallback = '') {
  if (typeof v === 'string') return v.slice(0, 2000).trim();
  if (v === null || v === undefined) return fallback;
  // Object or array — do not silently convert; return fallback
  return fallback;
}

/**
 * Source hierarchy scores for confidence weighting
 */
const SOURCE_SCORES = {
  official: 1.0,
  official_documentation: 0.95,
  official_newsroom: 0.9,
  government: 0.88,
  industry: 0.7,
  news: 0.65,
  third_party: 0.5,
};

function sourceConfidence(sourceType) {
  return SOURCE_SCORES[sourceType] ?? 0.5;
}

// ────────────────────────────────────────────────────────────────────────────
// Crawl evidence extraction
// ────────────────────────────────────────────────────────────────────────────

/**
 * Extract evidence from crawled pages
 * @param {string} projectId
 * @param {Object} analysis - Crawled analysis result
 * @param {Array} pages - Crawled pages from analysis.pages
 * @returns {Promise<{ sourcesCreated: number, evidenceCreated: number, errors: string[] }>}
 */
export async function extractEvidenceFromCrawl(projectId, analysis, pages, sessionId) {
  const results = { sourcesCreated: 0, evidenceCreated: 0, errors: [] };

  if (!pages) return results;

  try {
    const mainUrl = analysis.url || analysis.finalUrl || (analysis.host ? `https://${analysis.host}` : null);
    const mainSource = await createOrGetSource(projectId, mainUrl, 'official', {
      title: safeStr(analysis.title),
      domain: analysis.host || '',
      hierarchyScore: SOURCE_SCORES.official, sessionId,
    });

    if (!mainSource) {
      results.errors.push(`Failed to create main source for ${mainUrl}`);
      return results;
    }
    results.sourcesCreated++;
    const sourceIds = new Set([mainSource.id]);

    const evidenceItems = [];

    // Company description from title/meta description
    if (analysis.title) {
      evidenceItems.push({
        sourceId: mainSource.id,
        claimType: 'company_description',
        pageTitle: safeStr(analysis.title),
        section: 'Page Title',
        extractedText: safeStr(analysis.title),
        confidence: 1.0,
      });
    }

    if (analysis.description) {
      evidenceItems.push({
        sourceId: mainSource.id,
        claimType: 'company_description',
        pageTitle: safeStr(analysis.title),
        section: 'Meta Description',
        extractedText: safeStr(analysis.description),
        confidence: 0.95,
      });
    }

    // Headings
    if (Array.isArray(analysis.headings)) {
      for (const heading of analysis.headings.slice(0, 30)) {
        const rawText = safeStr(heading?.text);
        const text = cleanExtractedText(rawText);
        if (!text || !isHighQualityContent(text)) continue;
        const ct = classifyHeadingContent(text);
        evidenceItems.push({
          sourceId: mainSource.id,
          claimType: ct,
          pageTitle: safeStr(analysis.title),
          section: `Heading H${heading.level || 1}`,
          extractedText: text,
          confidence: 0.85,
        });
      }
    }

    // Paragraphs (more content, lower confidence than headings)
    if (Array.isArray(analysis.paragraphs)) {
      for (const para of analysis.paragraphs.slice(0, 20)) {
        const rawText = safeStr(para);
        const text = cleanExtractedText(rawText);
        if (!text || !isHighQualityContent(text)) continue;
        evidenceItems.push({
          sourceId: mainSource.id,
          claimType: classifyParagraphContent(text),
          pageTitle: safeStr(analysis.title),
          section: 'Body Text',
          extractedText: text.slice(0, 600),
          confidence: 0.7,
        });
      }
    }

    // Technology stack
    if (Array.isArray(analysis.tech) && analysis.tech.length > 0) {
      const techList = analysis.tech.map(t => safeStr(t?.name)).filter(Boolean).join(', ');
      if (techList) {
        evidenceItems.push({
          sourceId: mainSource.id,
          claimType: 'technology',
          pageTitle: safeStr(analysis.title),
          section: 'Technology Stack (Detected)',
          extractedText: `Technology stack detected: ${techList}`,
          confidence: 0.95,
        });
      }
    }

    // Per-page evidence
    const pagesToProcess = Array.isArray(pages) ? pages.slice(0, 50) : [];
    for (const page of pagesToProcess) {
      const pageUrl = safeStr(page?.url) || mainUrl;
      if (!pageUrl) continue;

      const pageSource = await createOrGetSource(projectId, pageUrl, 'official', {
        title: safeStr(page?.title),
        domain: mainSource.domain || '',
        hierarchyScore: SOURCE_SCORES.official, sessionId,
      });
      if (!pageSource) continue;
      sourceIds.add(pageSource.id);

      const pageClaimType = classifyPageByUrl(page?.url, page?.title, page?.h1);
      for (const candidate of [page.description, ...(page.paragraphs || []), ...(page.headings || []).map(heading => heading?.text)].slice(0, 45)) {
        const text = cleanExtractedText(safeStr(candidate)).slice(0, 600);
        if (!isHighQualityContent(text)) continue;
        evidenceItems.push({ sourceId: pageSource.id, claimType: classifyParagraphContent(text),
          pageTitle: safeStr(page.title), section: 'Page Content', extractedText: text, confidence: 0.8 });
      }

      if (page?.h1) {
        const h1 = cleanExtractedText(safeStr(page.h1));
        if (h1 && isHighQualityContent(h1)) {
          evidenceItems.push({
            sourceId: pageSource.id,
            claimType: pageClaimType,
            pageTitle: safeStr(page.title),
            section: 'Page H1',
            extractedText: h1,
            confidence: 0.9,
          });
        }
      }

      if (page?.title) {
        const pt = cleanExtractedText(safeStr(page.title));
        if (pt && isHighQualityContent(pt)) {
          evidenceItems.push({
            sourceId: pageSource.id,
            claimType: 'other',
            pageTitle: pt,
            section: 'Page Title',
            extractedText: pt,
            confidence: 0.8,
          });
        }
      }
    }

    results.sourcesCreated = sourceIds.size;
    // Store each source passage once, including when the homepage is in pages.
    const seenPassages = new Set();
    const rows = [];
    for (const item of evidenceItems) {
      if (!item.extractedText || !isHighQualityContent(item.extractedText)) continue;
      const passageKey = `${item.sourceId}:${item.extractedText.toLowerCase().replace(/\s+/g, ' ').trim()}`;
      if (seenPassages.has(passageKey)) continue;
      seenPassages.add(passageKey);
      rows.push({
          project_id: projectId,
          research_session_id: sessionId,
          source_id: item.sourceId,
          claim_type: safeClaimType(item.claimType),
          page_title: item.pageTitle || null,
          section: item.section || null,
          extracted_text: item.extractedText,
          confidence: item.confidence ?? 0.8,
      });
    }
    for (let offset = 0; offset < rows.length; offset += 40) {
      const batch = rows.slice(offset, offset + 40);
      try {
        const { error } = await supabase.from('evidence').insert(batch);
        if (error) {
          results.errors.push(`Evidence insert: ${error.message}`);
        } else {
          results.evidenceCreated += batch.length;
        }
      } catch (err) {
        results.errors.push(`Evidence creation: ${err.message}`);
      }
    }


  } catch (err) {
    results.errors.push(`Evidence extraction failed: ${err.message}`);
    console.error('[evidence extraction]', err);
  }

  return results;
}

// ────────────────────────────────────────────────────────────────────────────
// Search evidence extraction
// ────────────────────────────────────────────────────────────────────────────

/**
 * Extract evidence from normalized web search results.
 * All results must already be NormalizedResult objects — never raw API blobs.
 * @param {string} projectId
 * @param {string} purpose - Research purpose
 * @param {Array} searchResults - NormalizedResult[] from webSearch.js
 * @returns {Promise<{ sourcesCreated: number, evidenceCreated: number, errors: string[] }>}
 */
export async function extractEvidenceFromSearch(projectId, purpose, searchResults, sessionId) {
  const results = { sourcesCreated: 0, evidenceCreated: 0, errors: [] };

  if (!Array.isArray(searchResults) || searchResults.length === 0) return results;

  for (const result of searchResults) {
    // Defensive: validate all fields — never trust raw API blobs
    const url = safeStr(result?.url);
    const title = safeStr(result?.title);
    const snippet = safeStr(result?.snippet);
    const sourceType = typeof result?.sourceType === 'string' ? result.sourceType : 'third_party';
    const hierarchyScore = typeof result?.hierarchyScore === 'number' ? result.hierarchyScore : 0.5;
    const publicationDate = typeof result?.publicationDate === 'string' ? result.publicationDate : null;
    const category = typeof result?.category === 'string' ? result.category : 'other';

    // Skip results without valid URL or snippet
    if (!url || !/^https?:\/\//i.test(url)) {
      results.errors.push(`Skipping result without valid URL: ${String(url).slice(0, 60)}`);
      continue;
    }
    if (!snippet) continue;

    // Create or get source
    const source = await createOrGetSource(projectId, url, sourceType, {
      title,
      snippet: snippet.slice(0, 500),
      publicationDate,
      hierarchyScore, sessionId,
    });
    if (!source) {
      results.errors.push(`Failed to create source for ${url.slice(0, 60)}`);
      continue;
    }
    results.sourcesCreated++;

    // Map search category to valid claim type
    const claimType = safeClaimType(mapCategoryToClaimType(category));
    const confidence = sourceConfidence(sourceType);
    const cleanedSnippet = cleanExtractedText(snippet);
    if (!cleanedSnippet || !isHighQualityContent(cleanedSnippet)) continue;

    try {
      const { error } = await supabase.from('evidence').insert({
        project_id: projectId,
        research_session_id: sessionId,
        source_id: source.id,
        claim_type: claimType,
        page_title: title || null,
        section: 'Web Search Result',
        extracted_text: cleanedSnippet,
        publication_date: publicationDate,
        confidence,
      });
      if (error) {
        results.errors.push(`Evidence insert: ${error.message}`);
      } else {
        results.evidenceCreated++;
      }
    } catch (err) {
      results.errors.push(`Evidence creation: ${err.message}`);
    }
  }

  return results;
}

// ────────────────────────────────────────────────────────────────────────────
// Source management
// ────────────────────────────────────────────────────────────────────────────

/**
 * Create or get an existing source for this project+URL combination.
 * @param {string} projectId
 * @param {string} url
 * @param {string} sourceType
 * @param {{ title?: string, snippet?: string, domain?: string, hierarchyScore?: number, publicationDate?: string }} meta
 * @returns {Promise<Object|null>}
 */
async function createOrGetSource(projectId, url, sourceType = 'official', meta = {}) {
  try {
    if (!url || typeof url !== 'string') return null;

    const normalizedUrl = url.slice(0, 2048);

    const { data: existing } = await supabase
      .from('sources')
      .select('id, url, source_type, domain')
      .eq('project_id', projectId)
      .eq('research_session_id', meta.sessionId)
      .eq('url', normalizedUrl)
      .maybeSingle();

    if (existing) return existing;

    let domain = meta.domain || '';
    if (!domain) {
      try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { domain = ''; }
    }

    const { data, error } = await supabase
      .from('sources')
      .insert({
        project_id: projectId,
        research_session_id: meta.sessionId,
        url: normalizedUrl,
        title: meta.title ? String(meta.title).slice(0, 500) : null,
        snippet: meta.snippet ? String(meta.snippet).slice(0, 1000) : null,
        source_type: sourceType,
        domain,
        hierarchy_score: meta.hierarchyScore ?? 0.5,
        publication_date: meta.publicationDate || null,
        fetched_at: new Date().toISOString(),
        status: 'success',
      })
      .select()
      .single();

    if (error) {
      // Unique constraint violation = race condition, re-fetch
      if (error.code === '23505') {
        const { data: race } = await supabase.from('sources').select('id, url, source_type, domain').eq('project_id', projectId).eq('research_session_id', meta.sessionId).eq('url', normalizedUrl).maybeSingle();
        return race || null;
      }
      console.error('[createOrGetSource]', error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error('[createOrGetSource]', err.message);
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Content classifiers
// ────────────────────────────────────────────────────────────────────────────

function classifyPageByUrl(url = '', title = '', h1 = '') {
  const u = url.toLowerCase();
  const t = (title + ' ' + h1).toLowerCase();

  if (u.includes('/pricing') || t.includes('pricing') || t.includes('price') || t.includes('plans')) return 'pricing';
  if (u.includes('/about') || u.includes('/company') || t.includes('about us') || t.includes('our mission')) return 'company_description';
  if (u.includes('/product') || u.includes('/products')) return 'product';
  if (u.includes('/service') || u.includes('/services')) return 'service';
  if (u.includes('/feature') || u.includes('/features')) return 'feature';
  if (u.includes('/customer') || u.includes('/customers') || u.includes('/case-stud')) return 'customer';
  if (u.includes('/integration') || u.includes('/integrations') || u.includes('/connect')) return 'integration';
  if (u.includes('/blog') || u.includes('/news') || u.includes('/press')) return 'news';
  if (u.includes('/team') || u.includes('/leadership') || u.includes('/about/team')) return 'leadership';
  if (u.includes('/security') || u.includes('/privacy') || u.includes('/compliance')) return 'security';
  if (u.includes('/partner') || u.includes('/ecosystem')) return 'partnership';
  if (u.includes('/location') || u.includes('/cities') || u.includes('/offices')) return 'location';
  return 'other';
}

function classifyHeadingContent(text) {
  const t = text.toLowerCase();
  if (/price|pricing|plan|subscription|free trial|cost/.test(t)) return 'pricing';
  if (/feature|capability|what you can|what we offer/.test(t)) return 'feature';
  if (/customer|client|case study|testimonial/.test(t)) return 'customer';
  if (/security|compliance|soc|gdpr|iso/.test(t)) return 'security';
  if (/partner|integration|ecosystem/.test(t)) return 'partnership';
  if (/leadership|team|founder|ceo|executive/.test(t)) return 'leadership';
  if (/location|city|cities|office|country/.test(t)) return 'location';
  if (/market|industry|sector/.test(t)) return 'industry';
  if (/product|solution|platform/.test(t)) return 'product';
  if (/service|offering/.test(t)) return 'service';
  return 'other';
}

function classifyParagraphContent(text) {
  const t = text.toLowerCase();
  if (/\$\d|\bprice\b|\bpric(e|ing)\b|\bplan\b|\bsubscription\b/.test(t)) return 'pricing';
  if (/\bcompetitor\b|\bvs\b|\bcompared to\b|\balternative\b/.test(t)) return 'competitor';
  if (/\bfounded\b|\bstarted\b|\bin \d{4}\b|\bhistory\b|\borigin\b/.test(t)) return 'founder';
  if (/\braised\b|\bfunding\b|\bseries [a-c]\b|\bvaluation\b|\binvestor\b/.test(t)) return 'metric';
  if (/\bceo\b|\bcto\b|\bfounder\b|\bexecutive\b|\bboard\b/.test(t)) return 'leadership';
  if (/\bsecurity\b|\bcompliance\b|\bgdpr\b|\bsoc 2\b|\biso\b/.test(t)) return 'security';
  if (/\bpartner\b|\bintegrat\b|\bconnect\b|\becosystem\b/.test(t)) return 'integration';
  if (/\bcustomer\b|\bclient\b|\buser\b|\benterprise\b/.test(t)) return 'audience';
  if (/\btechnology\b|\bplatform\b|\barchitecture\b|\binfrastructure\b/.test(t)) return 'technology';
  return 'company_description';
}

function mapCategoryToClaimType(category) {
  const map = {
    overview: 'company_description',
    product: 'product',
    service: 'service',
    pricing: 'pricing',
    leadership: 'leadership',
    founder: 'founder',
    metric: 'metric',
    customer: 'customer',
    technology: 'technology',
    security: 'security',
    partnership: 'partnership',
    news: 'news',
    competitor: 'competitor',
    differentiator: 'differentiator',
    location: 'location',
    industry: 'industry',
    market: 'market',
    business_model: 'business_model',
    audience: 'audience',
    integration: 'integration',
    other: 'other',
  };
  return map[category] || 'other';
}
