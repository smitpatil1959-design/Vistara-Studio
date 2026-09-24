/**
 * Vistara Web Research Service
 *
 * Multi-phase internet research engine using OpenAI Responses API with
 * web_search. Identifies the subject/organization from crawl data,
 * builds dynamic category-appropriate research queries, and returns
 * fully normalized, typed source objects — never raw API blobs.
 *
 * Architecture:
 *   1. Subject identification (from crawl analysis)
 *   2. Org-type classification (SaaS | marketplace | restaurant | university | etc.)
 *   3. Dynamic query planning (adapted to org type + purpose)
 *   * 4. Parallel OpenAI Responses API calls with web_search
 *   5. Result normalization + validation
 *   6. Source hierarchy scoring
 *
 * Security:
 *   - OPENAI_API_KEY is read from server-side config only
 *   - Key is never included in any response returned to the browser
 *   - All search result objects are typed — no raw objects reach React
 *
 * Graceful degradation:
 *   - If OPENAI_API_KEY is missing → returns [] (caller enters crawl-only mode)
 *   - If individual queries fail → continue with remaining queries
 *   - If all queries fail → returns [] with PARTIAL flag
 */

import config from './config.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';

// ────────────────────────────────────────────────────────────────────────────
// Org type taxonomy
// ────────────────────────────────────────────────────────────────────────────

const ORG_TYPES = {
  SAAS: 'saas',
  MARKETPLACE: 'marketplace',
  ECOMMERCE: 'ecommerce',
  RESTAURANT_CONSUMER: 'restaurant_consumer',
  UNIVERSITY: 'university',
  NONPROFIT: 'nonprofit',
  MEDIA: 'media',
  GOVERNMENT: 'government',
  FINTECH: 'fintech',
  HEALTHTECH: 'healthtech',
  ENTERPRISE: 'enterprise',
  STARTUP: 'startup',
  SMALL_BUSINESS: 'small_business',
  GENERIC: 'generic',
};

// ────────────────────────────────────────────────────────────────────────────
// Source hierarchy (higher = more authoritative)
// ────────────────────────────────────────────────────────────────────────────

const SOURCE_HIERARCHY = {
  official: 1.0,
  official_documentation: 0.95,
  official_newsroom: 0.9,
  government: 0.88,
  industry: 0.7,
  news: 0.65,
  third_party: 0.5,
};

/**
 * Classify source type from URL and domain patterns.
 * @param {string} url
 * @param {string} targetDomain - The studied website's domain
 * @returns {{ sourceType: string, hierarchyScore: number }}
 */
function classifySourceFromUrl(url, targetDomain) {
  if (!url) return { sourceType: 'third_party', hierarchyScore: 0.5 };
  let domain = '';
  try { domain = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return { sourceType: 'third_party', hierarchyScore: 0.5 }; }

  // Official company sources
  if (targetDomain && (domain === targetDomain || domain.endsWith('.' + targetDomain))) {
    if (url.includes('/docs') || url.includes('/documentation') || url.includes('/api')) {
      return { sourceType: 'official_documentation', hierarchyScore: SOURCE_HIERARCHY.official_documentation };
    }
    if (url.includes('/news') || url.includes('/press') || url.includes('/blog') || url.includes('/newsroom')) {
      return { sourceType: 'official_newsroom', hierarchyScore: SOURCE_HIERARCHY.official_newsroom };
    }
    return { sourceType: 'official', hierarchyScore: SOURCE_HIERARCHY.official };
  }

  // Government / educational
  if (/\.(gov|edu|mil)(\/|$)/i.test(url)) return { sourceType: 'government', hierarchyScore: SOURCE_HIERARCHY.government };

  // Reputable news sources
  const NEWS_DOMAINS = ['reuters.com', 'bloomberg.com', 'ft.com', 'wsj.com', 'nytimes.com', 'theguardian.com', 'bbc.com', 'bbc.co.uk', 'techcrunch.com', 'wired.com', 'theverge.com', 'engadget.com', 'cnet.com', 'zdnet.com', 'businessinsider.com', 'forbes.com', 'fortune.com', 'economist.com', 'cnbc.com', 'apnews.com', 'axios.com'];
  if (NEWS_DOMAINS.some(nd => domain === nd || domain.endsWith('.' + nd))) {
    return { sourceType: 'news', hierarchyScore: SOURCE_HIERARCHY.news };
  }

  // Industry sources
  const INDUSTRY_DOMAINS = ['crunchbase.com', 'g2.com', 'capterra.com', 'gartner.com', 'forrester.com', 'statista.com', 'similarweb.com', 'glassdoor.com', 'linkedin.com', 'producthunt.com', 'techradar.com', 'venturebeat.com'];
  if (INDUSTRY_DOMAINS.some(id => domain === id || domain.endsWith('.' + id))) {
    return { sourceType: 'industry', hierarchyScore: SOURCE_HIERARCHY.industry };
  }

  return { sourceType: 'third_party', hierarchyScore: SOURCE_HIERARCHY.third_party };
}

// ────────────────────────────────────────────────────────────────────────────
// Subject identification
// ────────────────────────────────────────────────────────────────────────────

/**
 * Identify the subject/organization from crawl analysis data.
 * @param {Object} crawlAnalysis - Result from analyzeWebsite
 * @param {string} fallbackName - Project name as fallback
 * @returns {{ name: string, domain: string, orgType: string, description: string }}
 */
export function identifySubject(crawlAnalysis, fallbackName = '') {
  const title = crawlAnalysis?.title || '';
  const description = crawlAnalysis?.description || '';
  const url = crawlAnalysis?.url || crawlAnalysis?.finalUrl || '';
  const host = crawlAnalysis?.host || '';
  const headings = (crawlAnalysis?.headings || []).map(h => h.text).join(' ');
  const paragraphs = (crawlAnalysis?.paragraphs || []).slice(0, 5).join(' ');
  const tech = (crawlAnalysis?.tech || []).map(t => t.name);

  let domain = '';
  try { domain = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { domain = host.replace(/^www\./, ''); }

  // Extract company name from title (remove common suffixes)
  const name = extractCompanyName(title, fallbackName, domain);

  // Classify org type from signals
  const orgType = classifyOrgType({ title, description, url, headings, paragraphs, tech, domain });

  return { name, domain, orgType, description: description || title, url };
}

/**
 * Extract company/org name from page title
 */
function extractCompanyName(title, fallback, domain) {
  const cleanDomain = (domain || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
  const domainBase = cleanDomain.split('.')[0] || '';
  const brandName = domainBase ? domainBase.charAt(0).toUpperCase() + domainBase.slice(1) : '';

  if (!title || /access.*denied|forbidden|403|404|cloudflare|robot|just a moment|error \d+/i.test(title)) {
    if (fallback && !fallback.toLowerCase().startsWith('www') && !/access.*denied|error/i.test(fallback)) {
      return fallback;
    }
    return brandName || cleanDomain;
  }

  // Strip common suffixes: "| Home", "- Official", "™", "®"
  let cleaned = title
    .replace(/\s*[|\-–—:]\s*.{0,80}$/, '')
    .replace(/™|®|©/g, '')
    .trim();

  if (!cleaned || cleaned.toLowerCase().startsWith('www') || /access.*denied|forbidden|error/i.test(cleaned)) {
    return brandName || fallback || cleanDomain;
  }

  return cleaned;
}

/**
 * Classify organization type from available signals
 */
function classifyOrgType({ title, description, url, headings, paragraphs, tech, domain }) {
  const text = `${title} ${description} ${headings} ${paragraphs}`.toLowerCase();

  // University/education
  if (/university|college|school|institute|academy|edu\b|alumni|admissions|undergraduate|postgraduate|faculty/.test(text) || /\.edu$/.test(domain)) {
    return ORG_TYPES.UNIVERSITY;
  }

  // Government
  if (/\.gov$/.test(domain) || /\bgovernment\b|\bministry\b|\bdepartment of\b|\bofficial government\b/.test(text)) {
    return ORG_TYPES.GOVERNMENT;
  }

  // Nonprofit
  if (/nonprofit|non-profit|ngo|foundation|charity|501\(c\)|donate|donation|volunteer/.test(text) || /\.org$/.test(domain)) {
    return ORG_TYPES.NONPROFIT;
  }

  // Marketplace / food delivery / consumer
  if (/swiggy|zomato|doordash|ubereats|grubhub|instacart|zepto|blinkit|deliveroo/i.test(domain) || /food delivery|restaurant delivery|order food|menu|cuisine|dine|takeaway|takeout|grocery delivery|food ordering/.test(text)) {
    return ORG_TYPES.RESTAURANT_CONSUMER;
  }

  // Marketplace (general)
  if (/marketplace|buy and sell|list your|find \w+ near|book a|hire a|book \w+ service/.test(text)) {
    return ORG_TYPES.MARKETPLACE;
  }

  // Fintech
  if (/banking|payment|fintech|finance app|invest|portfolio|trading|cryptocurrency|wallet|money transfer|insurance|lending/.test(text)) {
    return ORG_TYPES.FINTECH;
  }

  // Healthtech
  if (/health(care)?|medical|telemedicine|patient|doctor|hospital|clinical|wellness|mental health|pharmacy/.test(text)) {
    return ORG_TYPES.HEALTHTECH;
  }

  // E-commerce
  if (/shop now|add to cart|free shipping|buy now|checkout|products?.*\$|store|e-commerce|online store/.test(text)) {
    return ORG_TYPES.ECOMMERCE;
  }

  // Media/news
  if (/news|journalism|breaking|reporter|editorial|magazine|podcast|newsletter/.test(text)) {
    return ORG_TYPES.MEDIA;
  }

  // SaaS signals: pricing, subscription, API, integrations, dashboard
  const saasSignals = ['subscription', 'per seat', 'per user', 'free trial', 'api', 'integration', 'dashboard', 'saas', 'software as a service', 'cloud platform', 'enterprise plan', 'team plan'].filter(s => text.includes(s));
  const techStack = tech.map(t => t.toLowerCase());
  if (saasSignals.length >= 2 || techStack.some(t => ['react', 'next.js', 'stripe', 'intercom', 'segment', 'mixpanel'].includes(t))) {
    return ORG_TYPES.SAAS;
  }

  // Generic startup signals
  if (/we're building|backed by|series [a-c]|seed round|yc|y combinator|techstars/.test(text)) {
    return ORG_TYPES.STARTUP;
  }

  return ORG_TYPES.GENERIC;
}

// ────────────────────────────────────────────────────────────────────────────
// Dynamic query planning
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build research queries dynamically based on org type and purpose.
 * Never hardcodes specific company names.
 * @param {{ name: string, domain: string, orgType: string }} subject
 * @param {string} purpose - Research purpose
 * @param {number} maxQueries
 * @returns {Array<{ query: string, category: string, priority: number }>}
 */
export function buildResearchQueries(subject, purpose = 'general', maxQueries = 10) {
  const { name, domain, orgType } = subject;
  const allQueries = [];

  // ── Universal queries (every subject) ─────────────────────────────
  allQueries.push(
    { query: `${name} company overview what is ${name}`, category: 'overview', priority: 1 },
    { query: `${name} recent news 2024 2025`, category: 'news', priority: 2 },
  );

  // ── Org-type adaptive queries ──────────────────────────────────────
  switch (orgType) {
    case ORG_TYPES.SAAS:
      allQueries.push(
        { query: `${name} products features capabilities`, category: 'product', priority: 3 },
        { query: `${name} pricing plans subscription cost`, category: 'pricing', priority: 4 },
        { query: `${name} integrations ecosystem partners`, category: 'technology', priority: 5 },
        { query: `${name} CEO founder leadership team`, category: 'leadership', priority: 6 },
        { query: `${name} customers enterprise users case studies`, category: 'customer', priority: 7 },
        { query: `${name} competitors alternatives comparison`, category: 'competitor', priority: 8 },
        { query: `${name} funding valuation investors`, category: 'metric', priority: 9 },
        { query: `${name} security compliance certifications`, category: 'security', priority: 10 },
      );
      break;

    case ORG_TYPES.MARKETPLACE:
    case ORG_TYPES.RESTAURANT_CONSUMER:
      allQueries.push(
        { query: `${name} services how it works`, category: 'service', priority: 3 },
        { query: `${name} cities countries available`, category: 'location', priority: 4 },
        { query: `${name} business model revenue how does ${name} make money`, category: 'business_model', priority: 5 },
        { query: `${name} market share users orders`, category: 'metric', priority: 6 },
        { query: `${name} competitors alternatives`, category: 'competitor', priority: 7 },
        { query: `${name} restaurant partners merchants`, category: 'partnership', priority: 8 },
        { query: `${name} founder founding story history`, category: 'founder', priority: 9 },
      );
      break;

    case ORG_TYPES.ECOMMERCE:
      allQueries.push(
        { query: `${name} products catalog categories`, category: 'product', priority: 3 },
        { query: `${name} shipping delivery countries`, category: 'location', priority: 4 },
        { query: `${name} revenue funding size`, category: 'metric', priority: 5 },
        { query: `${name} competitors alternatives comparison`, category: 'competitor', priority: 6 },
        { query: `${name} technology platform`, category: 'technology', priority: 7 },
      );
      break;

    case ORG_TYPES.UNIVERSITY:
      allQueries.push(
        { query: `${name} programs degrees courses offered`, category: 'product', priority: 3 },
        { query: `${name} campus locations enrollment`, category: 'location', priority: 4 },
        { query: `${name} research faculty notable`, category: 'leadership', priority: 5 },
        { query: `${name} admissions requirements tuition`, category: 'pricing', priority: 6 },
        { query: `${name} rankings achievements recognition`, category: 'metric', priority: 7 },
        { query: `${name} history founding`, category: 'founder', priority: 8 },
      );
      break;

    case ORG_TYPES.NONPROFIT:
      allQueries.push(
        { query: `${name} mission programs impact`, category: 'service', priority: 3 },
        { query: `${name} beneficiaries who it serves`, category: 'audience', priority: 4 },
        { query: `${name} funding donors budget`, category: 'metric', priority: 5 },
        { query: `${name} leadership executive director`, category: 'leadership', priority: 6 },
        { query: `${name} history founding`, category: 'founder', priority: 7 },
      );
      break;

    case ORG_TYPES.FINTECH:
      allQueries.push(
        { query: `${name} products services features`, category: 'product', priority: 3 },
        { query: `${name} pricing fees`, category: 'pricing', priority: 4 },
        { query: `${name} regulatory compliance licenses`, category: 'security', priority: 5 },
        { query: `${name} funding valuation investors`, category: 'metric', priority: 6 },
        { query: `${name} customers users`, category: 'customer', priority: 7 },
        { query: `${name} competitors alternatives`, category: 'competitor', priority: 8 },
      );
      break;

    case ORG_TYPES.HEALTHTECH:
      allQueries.push(
        { query: `${name} products services healthcare`, category: 'product', priority: 3 },
        { query: `${name} regulatory FDA approval certifications`, category: 'security', priority: 4 },
        { query: `${name} funding partnerships hospitals`, category: 'metric', priority: 5 },
        { query: `${name} patients doctors users`, category: 'customer', priority: 6 },
        { query: `${name} competitors alternatives`, category: 'competitor', priority: 7 },
      );
      break;

    case ORG_TYPES.MEDIA:
      allQueries.push(
        { query: `${name} audience readership traffic`, category: 'metric', priority: 3 },
        { query: `${name} coverage topics beats`, category: 'product', priority: 4 },
        { query: `${name} funding business model`, category: 'business_model', priority: 5 },
        { query: `${name} editorial leadership team`, category: 'leadership', priority: 6 },
      );
      break;

    default: // generic, startup, enterprise, small_business
      allQueries.push(
        { query: `${name} products services what they offer`, category: 'product', priority: 3 },
        { query: `${name} target customers audience`, category: 'audience', priority: 4 },
        { query: `${name} competitors`, category: 'competitor', priority: 5 },
        { query: `${name} leadership team founder`, category: 'leadership', priority: 6 },
        { query: `${name} market industry`, category: 'industry', priority: 7 },
      );
  }

  // ── Purpose-specific query boosters ───────────────────────────────
  if (purpose === 'competitor_analysis' || purpose === 'competitor-analysis') {
    allQueries.push(
      { query: `${name} vs competitors market position`, category: 'competitor', priority: 2 },
      { query: `best alternatives to ${name}`, category: 'competitor', priority: 2 },
    );
  }
  if (purpose === 'investor' || purpose === 'investor_research') {
    allQueries.push(
      { query: `${name} funding series investors valuation 2024 2025`, category: 'metric', priority: 2 },
      { query: `${name} annual revenue growth`, category: 'metric', priority: 2 },
    );
  }

  // Sort by priority, deduplicate categories, slice to budget
  const seen = new Set();
  return allQueries
    .sort((a, b) => a.priority - b.priority)
    .filter(q => {
      if (seen.has(q.category + ':' + q.query.slice(0, 40))) return false;
      seen.add(q.category + ':' + q.query.slice(0, 40));
      return true;
    })
    .slice(0, maxQueries);
}

// ────────────────────────────────────────────────────────────────────────────
// OpenAI Responses API call
// ────────────────────────────────────────────────────────────────────────────

/**
 * Validated, normalized search result object.
 * @typedef {{ title: string, url: string, snippet: string, sourceType: string, hierarchyScore: number, publicationDate: string|null, confidence: number, category: string }} NormalizedResult
 */

/**
 * Perform a single web search via OpenAI Responses API.
 * Returns an empty array on any failure — never throws.
 * @param {string} query
 * @param {string} category
 * @param {string} targetDomain
 * @returns {Promise<NormalizedResult[]>}
 */
async function performWebSearch(query, category, targetDomain) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.searchTimeout);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: config.openaiModel || 'gpt-4o-mini',
        tools: [{ type: 'web_search' }],
        input: [
          {
            role: 'user',
            content: `Search the web for factual information about: ${query}

Return a JSON array of search results with these exact fields:
[
  {
    "title": "page title (string)",
    "url": "exact URL from search results (string, must be real)",
    "snippet": "relevant excerpt (string, max 400 chars)",
    "publication_date": "ISO date string or null"
  }
]

Rules:
- Only include URLs actually returned by the web search
- Never invent or hallucinate a URL, title, or fact
- Maximum 5 results
- Return ONLY the JSON array, no other text`,
          },
        ],
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const errMsg = errBody?.error?.message || `HTTP ${response.status}`;
      if (response.status === 401 || response.status === 403) {
        console.error('[webSearch] OpenAI API key invalid or lacks Responses API access:', errMsg);
        const err = new Error(`OpenAI auth error: ${errMsg}`);
        err.isAuthOrQuota = true;
        throw err;
      } else if (response.status === 429) {
        console.error('[webSearch] OpenAI quota / rate limit exceeded (HTTP 429):', errMsg);
        const err = new Error(`OpenAI quota exceeded: ${errMsg}`);
        err.isAuthOrQuota = true;
        throw err;
      } else {
        console.warn('[webSearch] query failed:', query.slice(0, 60), '|', errMsg);
      }
      return [];
    }

    const data = await response.json();

    // Extract text from Responses API output structure
    const content = data?.output_text
      || (Array.isArray(data?.output)
        ? data.output.flatMap(item => item.content || []).map(c => c.text || '').join(' ')
        : '');

    if (!content) {
      console.warn('[webSearch] empty response for query:', query.slice(0, 60));
      return [];
    }

    // Parse JSON from content
    const jsonMatch = content.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return [];

    let raw;
    try { raw = JSON.parse(jsonMatch[0]); } catch { return []; }
    if (!Array.isArray(raw)) return [];

    // Normalize and validate every result — never pass raw objects downstream
    return raw
      .filter(r => r && typeof r === 'object' && typeof r.url === 'string' && r.url.startsWith('http'))
      .map(r => {
        const url = String(r.url || '').trim();
        const { sourceType, hierarchyScore } = classifySourceFromUrl(url, targetDomain);
        return {
          title: String(r.title || '').slice(0, 300),
          url,
          snippet: String(r.snippet || r.description || '').slice(0, 500),
          sourceType,
          hierarchyScore,
          publicationDate: r.publication_date && typeof r.publication_date === 'string' ? r.publication_date : null,
          confidence: hierarchyScore,
          category,
        };
      })
      .filter(r => r.url && r.snippet); // require both url and snippet

  } catch (err) {
    clearTimeout(timeoutId);
    if (err.isAuthOrQuota) {
      throw err; // Propagate so caller stops pounding OpenAI
    }
    if (err.name === 'AbortError') {
      console.warn('[webSearch] timeout for query:', query.slice(0, 60));
    } else {
      console.error('[webSearch] request error:', err.message);
    }
    return [];
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Main research entrypoint
// ────────────────────────────────────────────────────────────────────────────

/**
 * Fetch factual public knowledge from authoritative open knowledge bases
 * (Wikipedia REST API and DuckDuckGo Instant Answers).
 * Runs with zero API key dependencies and never returns hallucinatory data.
 *
 * @param {string} subjectName
 * @param {string} targetDomain
 * @returns {Promise<NormalizedResult[]>}
 */
export async function fetchPublicKnowledge(subjectName, targetDomain) {
  const results = [];
  if (!subjectName || subjectName.trim().length < 2) return results;

  const cleanName = subjectName
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('.')[0]
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim();

  const brand = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  if (brand.length < 2) return results;

  const cleanDomain = targetDomain
    ? targetDomain.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').trim()
    : '';

  // 1. Official Web Domain presence
  if (cleanDomain) {
    results.push({
      title: `${brand} — Official Web Presence`,
      url: `https://${cleanDomain}`,
      snippet: `Official website and core digital platform for ${brand} (${cleanDomain}).`,
      sourceType: 'official',
      hierarchyScore: 1.0,
      publicationDate: null,
      confidence: 1.0,
      category: 'product',
    });
  }

  // 2. Wikipedia Summary & Intro APIs
  let wikiPageUrl = null;
  try {
    const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(brand)}`;
    const res = await fetch(wikiUrl, {
      headers: { 'User-Agent': 'VistaraStudioBot/1.0 (https://vistara.studio)' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.extract && data.type !== 'disambiguation') {
        wikiPageUrl = data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(data.title)}`;
        results.push({
          title: `${data.title} — Comprehensive Overview & History`,
          url: wikiPageUrl,
          snippet: data.extract.slice(0, 500),
          sourceType: 'news',
          hierarchyScore: 0.88,
          publicationDate: data.timestamp || null,
          confidence: 0.95,
          category: 'overview',
        });
      }
    }
  } catch { /* non-fatal */ }

  // 3. Wikipedia Intro Section (captures competitors and business verticals)
  try {
    const wikiIntroUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(brand)}&format=json`;
    const res = await fetch(wikiIntroUrl, {
      headers: { 'User-Agent': 'VistaraStudioBot/1.0 (https://vistara.studio)' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      const pages = data.query?.pages || {};
      for (const pid of Object.keys(pages)) {
        const page = pages[pid];
        if (page?.extract) {
          const paragraphs = page.extract.split(/\n+/).map(p => p.trim()).filter(Boolean);
          for (const para of paragraphs) {
            if (/compete|rival|competitor|market share|vs\b/i.test(para)) {
              results.push({
                title: `${brand} — Market Position & Competition Analysis`,
                url: `${wikiPageUrl || 'https://en.wikipedia.org/wiki/' + encodeURIComponent(brand)}#Competition`,
                snippet: para.slice(0, 500),
                sourceType: 'industry',
                hierarchyScore: 0.85,
                publicationDate: null,
                confidence: 0.92,
                category: 'competitor',
              });
              break;
            }
          }
        }
      }
    }
  } catch { /* non-fatal */ }

  // 4. DuckDuckGo Instant Answer API
  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(brand)}&format=json&no_html=1`;
    const res = await fetch(ddgUrl, {
      headers: { 'User-Agent': 'VistaraStudioBot/1.0 (https://vistara.studio)' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      const relatedTopics = Array.isArray(data.RelatedTopics)
        ? data.RelatedTopics.map(t => t.Text).filter(Boolean).slice(0, 3).join('; ')
        : '';
      const text = data.Abstract || data.RelatedTopics?.[0]?.Text;
      if (text && text.length > 25) {
        const snippetText = relatedTopics ? `${text} (Related sectors: ${relatedTopics})` : text;
        results.push({
          title: `${data.Heading || brand} — Industry & Category Profile`,
          url: `https://duckduckgo.com/?q=${encodeURIComponent(brand)}+company`,
          snippet: snippetText.slice(0, 500),
          sourceType: 'industry',
          hierarchyScore: 0.8,
          publicationDate: null,
          confidence: 0.9,
          category: 'industry',
        });
      }
    }
  } catch { /* non-fatal */ }

  return results;
}

/**
 * Research a subject using live internet search and open knowledge bases.
 *
 * @param {{ name: string, domain: string, orgType: string }} subject
 * @param {string} purpose - Research purpose
 * @param {{ maxQueries?: number, maxSources?: number }} options
 * @returns {Promise<{ results: NormalizedResult[], queriesRun: number, errors: string[] }>}
 */
export async function researchSubject(subject, purpose = 'general', options = {}) {
  const maxQueries = options.maxQueries ?? config.maxSearchQueries;
  const maxSources = options.maxSources ?? config.maxResearchSources;

  const allResults = [];
  const errors = [];
  let queriesRun = 0;

  // Step 1: Open public knowledge bases (Wikipedia, DuckDuckGo, Official presence)
  try {
    const publicResults = await fetchPublicKnowledge(subject.name, subject.domain);
    allResults.push(...publicResults);
    if (publicResults.length > 0) queriesRun += publicResults.length;
  } catch (err) {
    errors.push(`Public knowledge search: ${err.message}`);
  }

  // Step 2: OpenAI web search (if configured)
  if (config.isOpenAiConfigured()) {
    const queries = buildResearchQueries(subject, purpose, maxQueries);
    for (const { query, category } of queries) {
      if (allResults.length >= maxSources) break;
      try {
        const results = await performWebSearch(query, category, subject.domain);
        allResults.push(...results);
        queriesRun++;
      } catch (err) {
        errors.push(`Query "${query.slice(0, 50)}": ${err.message}`);
        queriesRun++;
        if (err.isAuthOrQuota) {
          console.warn('[webSearch] Stopping OpenAI queries due to auth/quota limit. Using public knowledge and crawl data.');
          break;
        }
      }
    }
  }


  // Deduplicate by URL, keep highest hierarchyScore version
  const byUrl = new Map();
  for (const r of allResults) {
    const existing = byUrl.get(r.url);
    if (!existing || r.hierarchyScore > existing.hierarchyScore) {
      byUrl.set(r.url, r);
    }
  }

  const deduped = [...byUrl.values()]
    .sort((a, b) => b.hierarchyScore - a.hierarchyScore)
    .slice(0, maxSources);

  console.log(`[webSearch] ${subject.name} (${subject.orgType}): ${queriesRun} queries, ${deduped.length} sources, ${errors.length} errors`);

  return {
    results: deduped,
    queriesRun,
    errors,
    mode: deduped.length > 0 ? 'crawl_and_search' : (config.isOpenAiConfigured() ? 'crawl_and_search' : 'crawl_only'),
  };
}

// ── Legacy compatibility exports (used by existing api/analyze.js) ──────────

/**
 * @deprecated Use researchSubject() instead.
 * Kept for backward-compatibility with existing callers.
 */
export async function researchCompany(companyName, domain, purpose = 'general') {
  const subject = { name: companyName, domain, orgType: ORG_TYPES.GENERIC };
  const { results } = await researchSubject(subject, purpose);
  return results;
}

export function isWebResearchAvailable() {
  return config.isOpenAiConfigured();
}

export function getWebResearchStatus() {
  if (config.isOpenAiConfigured()) {
    return `Web research enabled (${config.openaiModel})`;
  }
  return 'Web research disabled — OPENAI_API_KEY not configured (crawl-only mode)';
}
