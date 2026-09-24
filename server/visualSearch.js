/**
 * Vistara Studio — Server-side AI Visual Intelligence & Search Service
 *
 * Automatically generates contextual visual briefs, prioritizes website assets,
 * searches curated high-resolution photography, ranks candidates by relevance
 * and brand color harmony, and attaches structured attribution metadata.
 */

import { hexToHsl, relativeLuminance } from './engine.js';

/** Curated royalty-free asset library with verified high-res imagery & full attribution */
export const CURATED_VISUAL_CATALOG = [
  // Technology / SaaS / Architecture / Cloud / AI
  {
    id: 'tech-cloud-infra',
    url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1600&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=480&q=80',
    title: 'Modern server cluster and cloud network infrastructure',
    category: 'technology',
    keywords: ['cloud', 'server', 'database', 'infrastructure', 'network', 'datacenter', 'backend', 'devops', 'scale'],
    dominantHex: '#0F172A',
    aspectRatio: '16:9',
    author: 'Taylor Vick',
    provider: 'Unsplash',
    sourceUrl: 'https://unsplash.com/photos/M5tzZtFCOfs',
    license: 'Unsplash License (Free to use)',
  },
  {
    id: 'tech-ai-interface',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=480&q=80',
    title: 'Fluid generative AI digital surface with luminous gradients',
    category: 'technology',
    keywords: ['ai', 'generative', 'intelligence', 'future', 'gradient', 'fluid', 'algorithm', 'digital', 'abstract'],
    dominantHex: '#7C5CFF',
    aspectRatio: '16:9',
    author: 'Milad Fakurian',
    provider: 'Unsplash',
    sourceUrl: 'https://unsplash.com/photos/E8UwA CE_wU',
    license: 'Unsplash License (Free to use)',
  },
  {
    id: 'tech-coding-workspace',
    url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1600&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=480&q=80',
    title: 'Modern software engineering terminal and code editor',
    category: 'technology',
    keywords: ['code', 'developer', 'software', 'programming', 'terminal', 'sdk', 'api', 'engineering', 'syntax'],
    dominantHex: '#1E293B',
    aspectRatio: '16:9',
    author: 'Florian Olivo',
    provider: 'Unsplash',
    sourceUrl: 'https://unsplash.com/photos/4hbJ-eymZRT',
    license: 'Unsplash License (Free to use)',
  },
  {
    id: 'tech-dashboard-analytics',
    url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=480&q=80',
    title: 'Real-time data visualization analytics and metrics dashboard',
    category: 'technology',
    keywords: ['analytics', 'metrics', 'dashboard', 'data', 'charts', 'growth', 'kpi', 'performance', 'insights'],
    dominantHex: '#10B981',
    aspectRatio: '16:9',
    author: 'Luke Chesser',
    provider: 'Unsplash',
    sourceUrl: 'https://unsplash.com/photos/JKUTrJ4vK00',
    license: 'Unsplash License (Free to use)',
  },

  // Creative / Design / Studio / Brand / Product
  {
    id: 'design-studio-workspace',
    url: 'https://images.unsplash.com/photo-1542744094-3a3172722053?auto=format&fit=crop&w=1600&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1542744094-3a3172722053?auto=format&fit=crop&w=480&q=80',
    title: 'Modern product design team strategy and creative architecture',
    category: 'creative',
    keywords: ['design', 'studio', 'product', 'strategy', 'collaboration', 'creative', 'agency', 'workshop', 'ux'],
    dominantHex: '#F8FAFC',
    aspectRatio: '16:9',
    author: 'Campaign Creators',
    provider: 'Unsplash',
    sourceUrl: 'https://unsplash.com/photos/gMsnXqILjp4',
    license: 'Unsplash License (Free to use)',
  },
  {
    id: 'design-minimal-geometry',
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=480&q=80',
    title: 'Refined architectural surfaces with clean light and pure shadows',
    category: 'creative',
    keywords: ['minimal', 'architecture', 'clean', 'light', 'shadow', 'geometry', 'luxury', 'editorial', 'craft'],
    dominantHex: '#E2E8F0',
    aspectRatio: '16:9',
    author: 'R ARCHITECTURE',
    provider: 'Unsplash',
    sourceUrl: 'https://unsplash.com/photos/2d4lAQAlbDA',
    license: 'Unsplash License (Free to use)',
  },
  {
    id: 'design-artisan-craft',
    url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1600&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=480&q=80',
    title: 'Artisan workspace with tactile materials and bespoke craft',
    category: 'creative',
    keywords: ['craft', 'artisan', 'portfolio', 'materials', 'texture', 'bespoke', 'heritage', 'luxury', 'detail'],
    dominantHex: '#78716C',
    aspectRatio: '16:9',
    author: 'NordWood Themes',
    provider: 'Unsplash',
    sourceUrl: 'https://unsplash.com/photos/kRNZiGKHz4E',
    license: 'Unsplash License (Free to use)',
  },

  // Healthcare / Clinical / Wellness / Science
  {
    id: 'health-clinical-care',
    url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1600&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=480&q=80',
    title: 'Physicians reviewing clinical diagnostic intelligence interface',
    category: 'health',
    keywords: ['health', 'clinical', 'medical', 'physician', 'doctor', 'hospital', 'patient', 'wellness', 'science'],
    dominantHex: '#0284C7',
    aspectRatio: '16:9',
    author: 'National Cancer Institute',
    provider: 'Unsplash',
    sourceUrl: 'https://unsplash.com/photos/701-7CHXeYo',
    license: 'Unsplash License (Free to use)',
  },
  {
    id: 'health-science-lab',
    url: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1600&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=480&q=80',
    title: 'Laboratory precision research and biotechnology testing',
    category: 'health',
    keywords: ['science', 'research', 'laboratory', 'biotech', 'precision', 'testing', 'chemistry', 'innovation'],
    dominantHex: '#0D9488',
    aspectRatio: '16:9',
    author: 'Lucas Vasques',
    provider: 'Unsplash',
    sourceUrl: 'https://unsplash.com/photos/9vnAWHWq_pQ',
    license: 'Unsplash License (Free to use)',
  },

  // Finance / Fintech / Commerce / Growth
  {
    id: 'finance-fintech-mobile',
    url: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1600&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=480&q=80',
    title: 'Modern fintech investment application interface and payments',
    category: 'finance',
    keywords: ['finance', 'fintech', 'investment', 'payments', 'money', 'banking', 'wealth', 'crypto', 'capital'],
    dominantHex: '#059669',
    aspectRatio: '16:9',
    author: 'Austin Distel',
    provider: 'Unsplash',
    sourceUrl: 'https://unsplash.com/photos/EMPZ7WGa_e8',
    license: 'Unsplash License (Free to use)',
  },
  {
    id: 'commerce-store-fulfillment',
    url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1600&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=480&q=80',
    title: 'Modern ecommerce logistics fulfillment and smart shipping',
    category: 'commerce',
    keywords: ['ecommerce', 'commerce', 'shipping', 'store', 'retail', 'products', 'logistics', 'orders', 'inventory'],
    dominantHex: '#F59E0B',
    aspectRatio: '16:9',
    author: 'Petre Sulcs',
    provider: 'Unsplash',
    sourceUrl: 'https://unsplash.com/photos/G1vhbMc_J4k',
    license: 'Unsplash License (Free to use)',
  },

  // Security / Enterprise / Trust / Infrastructure
  {
    id: 'enterprise-cybersecurity-vault',
    url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1600&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=480&q=80',
    title: 'Enterprise security encryption network and compliance guardrails',
    category: 'security',
    keywords: ['security', 'cybersecurity', 'encryption', 'compliance', 'enterprise', 'privacy', 'auth', 'protection'],
    dominantHex: '#3B82F6',
    aspectRatio: '16:9',
    author: 'FlyD',
    provider: 'Unsplash',
    sourceUrl: 'https://unsplash.com/photos/Gf4_N3yW43k',
    license: 'Unsplash License (Free to use)',
  },
];

/** Generates an intelligent, narrative-based visual search brief */
export function generateVisualBrief(slide, understanding, visualDna = {}) {
  const category = (understanding?.category || 'technology').toLowerCase();
  const title = (slide.title || '').replace(/\*/g, '').toLowerCase();
  const subtitle = (slide.subtitle || '').toLowerCase();
  const body = (slide.body || '').toLowerCase();
  const personality = visualDna.personality || 'refined';

  const keywords = [];

  // 1. Domain / Industry mapping
  if (/health|clinic|medical|patient|doctor|wellness|pharma|bio/i.test(category + ' ' + title + ' ' + body)) {
    keywords.push('health', 'clinical', 'medical', 'science');
  } else if (/finance|bank|pay|invest|money|crypto|wallet|capital|fund/i.test(category + ' ' + title + ' ' + body)) {
    keywords.push('finance', 'fintech', 'investment', 'capital');
  } else if (/ecommerce|shop|cart|product|retail|store|shipping|goods/i.test(category + ' ' + title + ' ' + body)) {
    keywords.push('commerce', 'products', 'store', 'retail');
  } else if (/design|studio|agency|brand|creative|portfolio|craft/i.test(category + ' ' + title + ' ' + body)) {
    keywords.push('creative', 'design', 'studio', 'architecture');
  } else if (/security|privacy|compliance|audit|soc2|encrypt|protect/i.test(category + ' ' + title + ' ' + body)) {
    keywords.push('security', 'enterprise', 'encryption', 'compliance');
  } else if (/data|analytics|metric|chart|insight|report|dashboard|speed/i.test(category + ' ' + title + ' ' + body)) {
    keywords.push('analytics', 'data', 'metrics', 'dashboard');
  } else if (/code|developer|api|sdk|terminal|deploy|git|runtime/i.test(category + ' ' + title + ' ' + body)) {
    keywords.push('developer', 'code', 'software', 'engineering');
  } else if (/ai|model|neural|intelligence|agent|prompt|learning/i.test(category + ' ' + title + ' ' + body)) {
    keywords.push('ai', 'generative', 'intelligence', 'digital');
  } else {
    keywords.push('technology', 'product', 'cloud', 'architecture');
  }

  // 2. Add visual aesthetic direction based on personality
  const styleKeywords = {
    luxury: 'editorial luxury lighting, refined minimalist composition, premium high-end aesthetic',
    editorial: 'journalistic documentary photography, clean natural light, magazine grade',
    technical: 'engineering precision, terminal code interface, modern datacenter network',
    minimalist: 'pure negative space, subtle geometry, soft architectural shadows',
    energetic: 'vibrant motion dynamics, crisp high-contrast visual energy',
    corporate: 'executive boardroom clarity, polished enterprise infrastructure',
    creative: 'contemporary studio design workspace, bold geometric surfaces',
    refined: 'calm modern technology workspace, clean aesthetic, balanced daylight',
  }[personality] || 'modern clean aesthetic photography';

  const briefText = `${keywords.join(', ')}, ${styleKeywords}`;
  return {
    query: `${keywords.slice(0, 3).join(' ')} ${personality}`,
    briefText,
    keywords,
    personality,
    category,
  };
}

/** Evaluates candidate image match against visual brief & brand color harmony */
export function scoreCandidateVisual(candidate, brief, visualDna, usedUrls = new Set()) {
  if (usedUrls.has(candidate.url)) return -1; // deduplicate

  let score = 0.5;

  // Keyword / topic overlap
  const matchedKeywords = brief.keywords.filter((kw) =>
    candidate.keywords.some((ckw) => ckw.includes(kw) || kw.includes(ckw)) || candidate.category === kw
  );
  score += matchedKeywords.length * 0.2;

  // Category match bonus
  if (candidate.category === brief.category || brief.keywords.includes(candidate.category)) {
    score += 0.25;
  }

  // Color harmony matching
  if (visualDna.primary && candidate.dominantHex) {
    const brandHsl = hexToHsl(visualDna.primary);
    const candHsl = hexToHsl(candidate.dominantHex);
    const hueDiff = Math.min(Math.abs(brandHsl.h - candHsl.h), 360 - Math.abs(brandHsl.h - candHsl.h));

    if (brandHsl.s < 0.2) {
      // Monochrome brand: rewards neutral/monochrome imagery
      if (candHsl.s < 0.25) score += 0.2;
    } else if (hueDiff < 40) {
      // Same color family (analogous)
      score += 0.22;
    } else if (Math.abs(hueDiff - 180) < 30) {
      // Complementary color balance
      score += 0.15;
    }
  }

  // Dark / light mode alignment
  if (candidate.dominantHex) {
    const candLum = relativeLuminance(candidate.dominantHex);
    if (visualDna.isDark && candLum < 0.4) score += 0.1;
    if (!visualDna.isDark && candLum > 0.4) score += 0.1;
  }

  return Math.min(1.0, Math.max(0.0, score));
}

/** Server-side visual search and ranking service */
export function searchAndRankVisuals(brief, visualDna, usedUrls = new Set(), options = {}) {
  const scored = CURATED_VISUAL_CATALOG.map((c) => ({
    asset: c,
    score: scoreCandidateVisual(c, brief, visualDna, usedUrls),
  })).filter((item) => item.score > 0.3);

  scored.sort((a, b) => b.score - a.score);

  const best = scored[0]?.asset || CURATED_VISUAL_CATALOG[0];
  return {
    url: best.url,
    thumbUrl: best.thumbUrl,
    title: best.title,
    aspectRatio: best.aspectRatio || '16:9',
    attribution: {
      provider: best.provider,
      author: best.author,
      sourceUrl: best.sourceUrl,
      license: best.license,
    },
    score: scored[0]?.score || 0.75,
  };
}

/** Determines visual placement and source per slide adhering to visual restraint */
export function decideSlideVisual(slide, project, visualDna, usedUrls = new Set(), options = {}) {
  const analysis = project.analysis || {};
  const screenshot = analysis.screenshot || null;
  const extractedImages = Array.isArray(analysis.images) ? analysis.images : [];
  const type = slide.type;
  const forceOnlyWebsite = options.onlyWebsiteImages || false;
  const disableStock = options.disableStock || false;

  // 1. Hero Cover -> Website screenshot in floating browser frame
  if (type === 'hero') {
    if (screenshot) {
      return {
        type: 'screenshot',
        url: screenshot,
        reason: 'Anchors brand identity and primary landing surface in floating browser frame.',
        placement: 'browser',
        aspectRatio: '16:9',
        priority: 0.98,
        attribution: { provider: 'Website Capture', author: analysis.host || project.url, sourceUrl: project.url, license: 'Original Website Asset' },
      };
    }
    // Fallback if no screenshot available
    const brief = generateVisualBrief(slide, project.understanding, visualDna);
    const ranked = searchAndRankVisuals(brief, visualDna, usedUrls);
    usedUrls.add(ranked.url);
    return {
      type: 'external-image',
      url: ranked.url,
      reason: 'Hero conceptual visual representation.',
      placement: 'split',
      aspectRatio: ranked.aspectRatio,
      priority: 0.9,
      attribution: ranked.attribution,
    };
  }

  // 2. Product Experience / Interface -> Website screenshot or subpage capture
  if (type === 'experience' || type === 'interface' || slide.custom_label === 'Experience') {
    if (screenshot) {
      return {
        type: 'screenshot',
        url: screenshot,
        reason: 'Showcases the live interactive product surface and UX detail.',
        placement: 'browser',
        aspectRatio: '16:9',
        priority: 0.95,
        attribution: { provider: 'Website Capture', author: analysis.host || project.url, sourceUrl: project.url, license: 'Original Website Asset' },
      };
    }
  }

  // 3. Solution / Value Proposition -> Relevant website image or curated editorial photography
  if (type === 'solution' || type === 'differentiation') {
    // Check if website has an eligible high-res product/hero image
    const webAsset = extractedImages.find((img) => img.src && !usedUrls.has(img.src) && (img.isHero || img.isProduct || !img.src.includes('logo')));
    if (webAsset) {
      usedUrls.add(webAsset.src);
      return {
        type: 'website-asset',
        url: webAsset.src,
        reason: 'Extracted product graphic from website surface.',
        placement: 'split',
        aspectRatio: '16:9',
        priority: 0.88,
        attribution: { provider: 'Website Scan', author: analysis.host || project.url, sourceUrl: project.url, license: 'Original Website Asset' },
      };
    }

    if (!forceOnlyWebsite && !disableStock) {
      const brief = generateVisualBrief(slide, project.understanding, visualDna);
      const ranked = searchAndRankVisuals(brief, visualDna, usedUrls);
      usedUrls.add(ranked.url);
      return {
        type: 'external-image',
        url: ranked.url,
        reason: 'Visually conveys the breakthrough advantage and product outcome.',
        placement: 'split',
        aspectRatio: ranked.aspectRatio,
        priority: 0.85,
        attribution: ranked.attribution,
      };
    }
  }

  // 4. Visual restraint: Data/metrics, Architecture, Workflow, Benefits, Problem, CTA remain clean
  return {
    type: 'none',
    url: null,
    reason: 'Preserves visual restraint and strong typographic focus for data/process clarity.',
    placement: 'none',
    aspectRatio: 'none',
    priority: 0.0,
    attribution: null,
  };
}
