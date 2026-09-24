/**
 * Presentation Critic & Auto-Repair Engine v2
 *
 * Evaluates generated presentation decks against:
 * 1.  Content Duplication (4-layer: exact, normalized prefix, Jaccard, entity-predicate)
 * 2.  Narrative Coherence — logical progression, no topic cycling/regression
 * 3.  Visual Variety — layout monotony cap (≤ 2 consecutive identical layouts)
 * 4.  Spatial Safety — card count, title length, body length, bullet format
 * 5.  Evidence Safety — strips unevidenced pricing slides
 * 6.  Weak Title Detection — flags and repairs generic/category-style titles
 * 7.  Empty/Imbalanced Slides — grid with no cards, slides with no evidence
 * 8.  Unsupported Claims — slide has bullets but no claim_ids linked
 * 9.  Visual Intent Monotony — all slides sharing the same visualIntent
 * 10. Deck Word Count — individual slides over 180 words flagged
 * 11. Story Progression — checks deck doesn't end on 'context' or start on 'metrics'
 *
 * Domain-agnostic: Zero brand/domain hardcoding in any fallback text.
 */

import { repairSlideSpatialCollision } from '../layoutEngine.js';

// ---------------------------------------------------------------------------
// Shared text utilities — exported so storyPlanner.js and insightPrioritizer.js can import
// ---------------------------------------------------------------------------

export function tokenize(text) {
  if (typeof text !== 'string') return new Set();
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return new Set(words);
}

export const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'are', 'was', 'were',
  'will', 'our', 'your', 'about', 'more', 'their', 'such', 'into', 'also', 'than',
  'its', 'can', 'all', 'has', 'been', 'but', 'not', 'you', 'any', 'they', 'which',
]);

export function jaccardSimilarity(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Lightweight subject-predicate extractor for Layer 4 deduplication.
 */
function extractSubjectPredicate(text) {
  if (!text || text.length < 15) return null;
  const clean = text.trim().replace(/[^\w\s]/g, ' ');
  const words = clean.split(/\s+/).filter((w) => w.length > 1);
  if (words.length < 3) return null;

  const subject = words[0].toLowerCase();
  const VERBS = /^(is|are|was|were|has|have|had|does|do|provides?|offers?|enables?|delivers?|helps?|builds?|creates?|connects?|serves?|supports?|includes?|allows?|gives?|makes?|uses?|runs?|operates?|covers?|employs?|manages?|processes?|generates?|raised?|launched?|founded?|grew?|acquired?|partnered?|integrated?|expanded?)$/i;

  let predicate = null;
  for (let i = 1; i < Math.min(words.length, 6); i++) {
    const stem = words[i].toLowerCase().replace(/s$/, '').replace(/ed$/, '').replace(/ing$/, '');
    if (VERBS.test(words[i]) || VERBS.test(stem)) {
      predicate = stem;
      break;
    }
  }

  return subject && predicate ? { subject, predicate } : null;
}

function normalizeText(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * 4-layer duplicate detection between two text strings.
 * Layer 1 — exact normalized match
 * Layer 2 — 80-char normalized prefix
 * Layer 3 — Jaccard token overlap > 0.65
 * Layer 4 — same subject-predicate pair
 */
export function areTextsSubstantiallyDuplicate(textA, textB) {
  if (!textA || !textB) return false;

  const a = normalizeText(textA);
  const b = normalizeText(textB);

  // Layer 1: exact
  if (a === b) return true;

  // Layer 2: prefix (80 chars)
  if (a.length >= 60 && b.length >= 60 && a.slice(0, 80) === b.slice(0, 80)) return true;

  // Containment (one is a substring of the other)
  if (a.length > 50 && b.length > 50 && (a.includes(b) || b.includes(a))) return true;

  // Layer 3: Jaccard
  const tokA = tokenize(textA);
  const tokB = tokenize(textB);
  if (tokA.size > 2 && tokB.size > 2 && jaccardSimilarity(tokA, tokB) > 0.65) return true;

  // Layer 4: entity-predicate (only for longer texts)
  if (textA.length >= 20 && textB.length >= 20) {
    const predA = extractSubjectPredicate(textA);
    const predB = extractSubjectPredicate(textB);
    if (predA && predB &&
        predA.subject === predB.subject &&
        predA.predicate === predB.predicate) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Weak/generic title detection
// ---------------------------------------------------------------------------

const GENERIC_TITLE_PATTERNS = [
  /^(products? (&|and) services?)$/i,
  /^(key features?)$/i,
  /^(overview)$/i,
  /^(about us?)$/i,
  /^(capabilities?)$/i,
  /^(solutions?)$/i,
  /^(services?)$/i,
  /^(introduction)$/i,
  /^(summary)$/i,
  /^(conclusion)$/i,
  /^(differentiators?)$/i,
  /^(our mission)$/i,
  /^(who we are)$/i,
  /^(what we do)$/i,
  /^(company overview)$/i,
  /^(driving innovation (&|and) practical value)$/i,
  /^(core products?,? solutions? (&|and) services?)$/i,
  /^(key capabilities? (&|and) strategic advantage)$/i,
  /^(operational scale (&|and) performance signals?)$/i,
  /^(partnering for growth)$/i,
  /^(delivering innovation)$/i,
  /^(the future of .{3,40})$/i,
  /^(welcome to .{3,40})$/i,
];

function isGenericTitle(title) {
  if (!title) return false;
  return GENERIC_TITLE_PATTERNS.some((p) => p.test(title.trim()));
}

// Narrative progression rules — which topic roles should NOT appear in which positions
const STORY_PROGRESSION_RULES = [
  { check: 'last_is_context', message: 'Deck ends on a context/framing slide — closing should be substantive' },
  { check: 'starts_with_metrics', message: 'Deck opens with metrics — establish identity first' },
  { check: 'repeated_topic_key', message: 'Same topic key appears twice in sequence' },
];

// ---------------------------------------------------------------------------
// Main evaluation function
// ---------------------------------------------------------------------------

export function evaluateDeck(slides, subjectProfile = {}) {
  const issues = [];
  const duplications = [];
  let score = 100;

  if (!Array.isArray(slides) || slides.length === 0) {
    return { score: 0, valid: false, issues: [{ severity: 'critical', message: 'Deck is empty' }] };
  }

  // ── 1. Content duplication (cross-slide) ──────────────────────────────────
  const textCorpus = [];
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    const candidates = [
      { field: 'title', text: s.title },
      { field: 'subtitle', text: s.subtitle },
      { field: 'body', text: s.body },
    ].filter((item) => item.text && item.text.trim().length > 20);

    for (const item of candidates) {
      for (const prev of textCorpus) {
        if (areTextsSubstantiallyDuplicate(item.text, prev.text)) {
          duplications.push({ slideA: prev.slideIndex, fieldA: prev.field, slideB: i, fieldB: item.field });
          issues.push({ severity: 'critical', type: 'CONTENT_DUPLICATION', slideIndex: i,
            message: `Slide ${i + 1} (${item.field}) duplicates slide ${prev.slideIndex + 1} (${prev.field})` });
          score -= 15;
        }
      }
      textCorpus.push({ slideIndex: i, field: item.field, text: item.text });
    }
  }

  // ── 2. Duplicate titles ───────────────────────────────────────────────────
  const titlesSeen = new Map();
  for (let i = 0; i < slides.length; i++) {
    const rawTitle = normalizeText(slides[i].title || '');
    if (rawTitle) {
      if (titlesSeen.has(rawTitle)) {
        issues.push({ severity: 'warning', type: 'DUPLICATE_TITLE', slideIndex: i,
          message: `Slide ${i + 1} has same title as slide ${titlesSeen.get(rawTitle) + 1}` });
        score -= 5;
      } else titlesSeen.set(rawTitle, i);
    }
  }

  // ── 3. Weak/generic titles ────────────────────────────────────────────────
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    if (s.type === 'hero' || s.type === 'cta') continue;
    if (isGenericTitle(s.title)) {
      issues.push({ severity: 'warning', type: 'WEAK_TITLE', slideIndex: i,
        message: `Slide ${i + 1} has a generic title: "${s.title}"` });
      score -= 5;
    }
  }

  // ── 4. Visual layout variety ──────────────────────────────────────────────
  let consecutiveLayout = 1;
  for (let i = 1; i < slides.length; i++) {
    const cur = slides[i].layout || 'split';
    const prev = slides[i - 1].layout || 'split';
    if (cur === prev && cur !== 'center') {
      consecutiveLayout++;
      if (consecutiveLayout >= 3) {
        issues.push({ severity: 'warning', type: 'LAYOUT_MONOTONY', slideIndex: i,
          message: `3 consecutive slides using layout "${cur}"` });
        score -= 8;
      }
    } else consecutiveLayout = 1;
  }

  // ── 5. Visual intent monotony ─────────────────────────────────────────────
  const intentCounts = {};
  for (const s of slides) {
    const vi = s.visualIntent || s.layout || 'unknown';
    intentCounts[vi] = (intentCounts[vi] || 0) + 1;
  }
  for (const [intent, count] of Object.entries(intentCounts)) {
    if (count > 2 && count / slides.length > 0.6 && slides.length > 4) {
      issues.push({ severity: 'warning', type: 'VISUAL_INTENT_MONOTONY',
        message: `Over 60% of slides share the same visual intent: "${intent}"` });
      score -= 6;
    }
  }

  // ── 6. Spatial bounds & density ──────────────────────────────────────────
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    if (Array.isArray(s.bullets) && s.bullets.length > 4) {
      issues.push({ severity: 'warning', type: 'CARD_OVERFLOW', slideIndex: i,
        message: `Slide ${i + 1} has ${s.bullets.length} cards (max 4)` });
      score -= 5;
    }
    if (s.title && s.title.length > 80) {
      issues.push({ severity: 'warning', type: 'TITLE_OVERFLOW', slideIndex: i,
        message: `Slide ${i + 1} title is ${s.title.length} chars (max 80)` });
      score -= 3;
    }
    // Total word count check (> 180 words = overflow risk)
    const wordCount = [s.title, s.subtitle, s.body, ...(s.bullets || [])]
      .filter(Boolean).join(' ').split(/\s+/).length;
    if (wordCount > 180) {
      issues.push({ severity: 'warning', type: 'WORD_COUNT_OVERFLOW', slideIndex: i,
        message: `Slide ${i + 1} has ~${wordCount} words (max ~180)` });
      score -= 4;
    }
  }

  // ── 7. Imbalanced slides ──────────────────────────────────────────────────
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    // Grid slide with no bullets is visually broken
    if (s.layout === 'grid' && (!Array.isArray(s.bullets) || s.bullets.length === 0)) {
      issues.push({ severity: 'warning', type: 'EMPTY_GRID_SLIDE', slideIndex: i,
        message: `Slide ${i + 1} uses grid layout but has no cards/bullets` });
      score -= 8;
    }
    // large_metric slide with no stats
    if (s.layout === 'large_metric' && (!Array.isArray(s.stats) || s.stats.length === 0)) {
      issues.push({ severity: 'warning', type: 'EMPTY_METRIC_SLIDE', slideIndex: i,
        message: `Slide ${i + 1} uses large_metric layout but has no stats` });
      score -= 6;
    }
  }

  // ── 8. Unsupported claims ─────────────────────────────────────────────────
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    if (s.type === 'hero' || s.type === 'cta') continue;
    const hasBullets = Array.isArray(s.bullets) && s.bullets.length > 0;
    const hasClaimIds = Array.isArray(s.claim_ids) && s.claim_ids.length > 0;
    if (hasBullets && !hasClaimIds) {
      issues.push({ severity: 'warning', type: 'UNSUPPORTED_CLAIMS', slideIndex: i,
        message: `Slide ${i + 1} has bullets but no linked claim IDs` });
      score -= 5;
    }
  }

  // ── 9. Evidence safety (unevidenced pricing) ──────────────────────────────
  if (subjectProfile?.capabilities && !subjectProfile.capabilities.hasPricingEvidence) {
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i];
      if (s.type === 'pricing' || /\bpricing\b|\bsubscription plans\b/i.test(s.title || '')) {
        issues.push({ severity: 'critical', type: 'UNEVIDENCED_PRICING', slideIndex: i,
          message: `Slide ${i + 1} is pricing but ${subjectProfile.name || 'this website'} lacks pricing evidence` });
        score -= 20;
      }
    }
  }

  // ── 10. Zero-evidence slides ──────────────────────────────────────────────
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    if (s.type === 'hero' || s.type === 'cta') continue;
    const hasEvidence =
      (Array.isArray(s.claim_ids) && s.claim_ids.length > 0) ||
      (Array.isArray(s.evidence_ids) && s.evidence_ids.length > 0);
    if (!hasEvidence) {
      issues.push({ severity: 'warning', type: 'NO_EVIDENCE', slideIndex: i,
        message: `Slide ${i + 1} ("${s.title}") has no linked claims or evidence` });
      score -= 8;
    }
  }

  // ── 11. Story progression ─────────────────────────────────────────────────
  const nonHeroSlides = slides.filter((s) => s.type !== 'hero');
  const lastSlide = nonHeroSlides[nonHeroSlides.length - 1];
  const firstContent = nonHeroSlides[0];

  if (lastSlide && lastSlide.purpose === 'context') {
    issues.push({ severity: 'warning', type: 'POOR_STORY_PROGRESSION',
      message: 'Deck ends on a framing/context slide — closing should synthesize, not introduce' });
    score -= 6;
  }
  if (firstContent && firstContent.purpose === 'metrics' && slides.length > 2) {
    issues.push({ severity: 'warning', type: 'POOR_STORY_PROGRESSION',
      message: 'Deck opens with metrics before establishing identity — consider reordering' });
    score -= 4;
  }

  // Check for repeated topic keys (same topic appearing twice)
  const topicKeysSeen = new Set();
  for (let i = 0; i < slides.length; i++) {
    const tkey = slides[i].topicKey;
    if (tkey && tkey !== 'hero' && tkey !== 'closing') {
      if (topicKeysSeen.has(tkey)) {
        issues.push({ severity: 'warning', type: 'REPEATED_TOPIC', slideIndex: i,
          message: `Topic "${tkey}" appears more than once in the deck` });
        score -= 8;
      }
      topicKeysSeen.add(tkey);
    }
  }

  return {
    score: Math.max(0, score),
    valid: !issues.some((iss) => iss.severity === 'critical'),
    duplications,
    issues,
  };
}

// ---------------------------------------------------------------------------
// Auto-Repair Engine
// ---------------------------------------------------------------------------

export function critiqueAndRepairDeck(slides, subjectProfile = {}, claims = []) {
  let working = JSON.parse(JSON.stringify(slides));

  for (let pass = 0; pass < 3; pass++) {
    const report = evaluateDeck(working, subjectProfile);

    // Determine repair threshold: fix if score < 75 OR any critical issue
    const hasCritical = report.issues.some((i) => i.severity === 'critical');
    const hasMultipleWarnings = report.issues.filter((i) => i.severity === 'warning').length >= 2;
    if (!hasCritical && !hasMultipleWarnings && report.score >= 75) break;

    // 1. Remove unevidenced pricing
    if (subjectProfile?.capabilities && !subjectProfile.capabilities.hasPricingEvidence) {
      working = working.filter((s) =>
        !(s.type === 'pricing' || /\bpricing\b|\bsubscription plans\b/i.test(s.title || ''))
      );
    }

    // 2. Remove zero-evidence non-hero/non-cta slides with thin content
    working = working.filter((s) => {
      if (s.type === 'hero' || s.type === 'cta') return true;
      const hasEvidence =
        (Array.isArray(s.claim_ids) && s.claim_ids.length > 0) ||
        (Array.isArray(s.evidence_ids) && s.evidence_ids.length > 0);
      if (!hasEvidence) {
        const contentLen =
          (s.title || '').length + (s.subtitle || '').length +
          (s.body || '').length +
          (Array.isArray(s.bullets) ? s.bullets.join('').length : 0);
        return contentLen > 80;
      }
      return true;
    });

    // 3. Fix imbalanced grid slides: switch to split if no bullets
    for (const s of working) {
      if (s.layout === 'grid' && (!Array.isArray(s.bullets) || s.bullets.length === 0)) {
        s.layout = 'split';
      }
      if (s.layout === 'large_metric' && (!Array.isArray(s.stats) || s.stats.length === 0)) {
        s.layout = 'center';
      }
    }

    // 4. Rewrite weak or duplicate titles from slide's own content
    const priorTitlesAndSubtitles = [];
    for (let i = 0; i < working.length; i++) {
      const s = working[i];
      if (s.type === 'hero') {
        if (s.title) priorTitlesAndSubtitles.push(s.title);
        if (s.subtitle) priorTitlesAndSubtitles.push(s.subtitle);
        continue;
      }
      const isTitleDup = priorTitlesAndSubtitles.some((prev) => areTextsSubstantiallyDuplicate(s.title, prev));
      if (isGenericTitle(s.title) || isTitleDup) {
        const rewritten = rewriteWeakTitle(s, subjectProfile, claims, priorTitlesAndSubtitles);
        if (rewritten) s.title = rewritten;
      }
      if (s.title) priorTitlesAndSubtitles.push(s.title);
      if (s.subtitle) priorTitlesAndSubtitles.push(s.subtitle);
    }

    // 5. Repair duplicate subtitle/body with unused claim text
    const seenTexts = [];
    for (let i = 0; i < working.length; i++) {
      const s = working[i];
      if (s.type === 'hero') {
        if (s.subtitle) seenTexts.push({ text: s.subtitle });
        continue;
      }
      if (s.subtitle) {
        const isDup = seenTexts.some((prev) => areTextsSubstantiallyDuplicate(s.subtitle, prev.text)) ||
          (s.title && areTextsSubstantiallyDuplicate(s.subtitle, s.title));
        if (isDup) s.subtitle = synthesizeAlternativeSubtitle(s, subjectProfile, claims, seenTexts);
        seenTexts.push({ text: s.subtitle });
      }
      if (s.body) {
        const isDup = seenTexts.some((prev) => areTextsSubstantiallyDuplicate(s.body, prev.text));
        if (isDup) s.body = synthesizeAlternativeBody(s, subjectProfile, claims, seenTexts);
        seenTexts.push({ text: s.body });
      }
      if (s.subtitle && s.body && areTextsSubstantiallyDuplicate(s.subtitle, s.body)) s.subtitle = '';
    }

    // 6. Format, clamp, and limit bullets to 4
    for (const s of working) {
      if (Array.isArray(s.bullets)) {
        s.bullets = s.bullets.slice(0, 4).map((b) => {
          const str = String(b).trim();
          if (!str.includes(' — ')) {
            const ci = str.indexOf(': ');
            if (ci > 0 && ci < 35) {
              return `${str.slice(0, ci).slice(0, 32)} — ${str.slice(ci + 2).slice(0, 72)}`;
            }
            return `${str.slice(0, 32)} — ${str.slice(32, 104)}`;
          }
          const [head, ...rest] = str.split(' — ');
          return `${head.slice(0, 32)} — ${rest.join(' — ').slice(0, 72)}`;
        });
      }
    }

    // 7. Break layout monotony
    const validLayouts = ['split', 'grid', 'left', 'center', 'editorial', 'two_column'];
    for (let i = 2; i < working.length; i++) {
      const a = working[i - 2].layout || 'split';
      const b = working[i - 1].layout || 'split';
      const c = working[i].layout || 'split';
      if (a === b && b === c && c !== 'center') {
        const alts = validLayouts.filter((l) => l !== b);
        working[i - 1].layout = alts[0] || 'left';
      }
    }

    // 8. Spatial collision repair
    working = working.map((s) => repairSlideSpatialCollision(s));
  }

  // Re-index sort order
  working.forEach((s, idx) => { s.sort_order = idx + 1; });

  const finalReport = evaluateDeck(working, subjectProfile);
  return { slides: working, report: finalReport };
}

// ---------------------------------------------------------------------------
// Weak title rewrite
// ---------------------------------------------------------------------------

function rewriteWeakTitle(slide, subjectProfile = {}, claims = [], priorTexts = []) {
  const isDuplicate = (cand) => priorTexts.some((prev) => areTextsSubstantiallyDuplicate(cand, prev));

  const bullets = Array.isArray(slide.bullets) ? slide.bullets : [];
  for (const b of bullets) {
    const parts = String(b).split(' — ');
    const detail = (parts[1] || '').trim();
    if (detail.length >= 20 && detail.length <= 70 && !isGenericTitle(detail) && !isDuplicate(detail)) return detail;
    const head = (parts[0] || '').trim();
    if (head.length >= 20 && head.length <= 70 && !isGenericTitle(head) && !isDuplicate(head)) return head;
  }

  const sub = (slide.subtitle || '').trim();
  if (sub.length >= 20 && sub.length <= 70 && !isGenericTitle(sub) && !isDuplicate(sub)) {
    const first = sub.split(/[.!?]/)[0].trim();
    if (first.length >= 20 && !isDuplicate(first)) return first;
  }

  // Try a claim not already used as a bullet
  const candidateClaims = (claims || []).filter((c) => {
    const text = (c.claim || '').trim();
    if (text.length < 20 || text.length > 75) return false;
    if (isGenericTitle(text) || isDuplicate(text)) return false;
    return !bullets.some((b) => b.includes(text.slice(0, 30)));
  });

  if (candidateClaims.length > 0) {
    const first = candidateClaims[0].claim.split(/[.!?]/)[0].trim();
    if (first.length >= 20 && first.length <= 70 && !isDuplicate(first)) return first;
  }

  // Domain-agnostic semantic title fallback based on slide type
  const typeMap = {
    features: `${subjectProfile.name || 'Platform'} Core Features`,
    architecture: `${subjectProfile.name || 'Platform'} Technical Architecture`,
    benefits: `Value Delivered by ${subjectProfile.name || 'the Platform'}`,
    audience: `Who ${subjectProfile.name || 'the Platform'} Serves`,
    market: `Market Reach & Operations`,
    overview: `${subjectProfile.name || 'Platform'} Strategic Overview`,
  };
  const fallback = typeMap[slide.type] || `${subjectProfile.name || 'Platform'} Operational Highlights`;
  if (!isDuplicate(fallback)) return fallback;

  return null;
}

// ---------------------------------------------------------------------------
// Fallback body/subtitle generators — strictly domain-agnostic
// ---------------------------------------------------------------------------

function synthesizeAlternativeBody(slide, subjectProfile, claims, seenBodies) {
  const orgName = subjectProfile.name || 'The Platform';

  const unused = (claims || []).filter((c) => {
    const text = c.claim || '';
    return text.length >= 25 && !seenBodies.some((prev) => areTextsSubstantiallyDuplicate(text, prev.text));
  });
  if (unused.length > 0) {
    const pick = unused[0].claim;
    return pick.length > 200 ? pick.slice(0, 195) + '…' : pick;
  }

  const p = (slide.purpose || slide.type || '').toLowerCase();
  if (/metric|scale|number|stat/.test(p)) return `${orgName} maintains measurable performance and operational scope across its key activities.`;
  if (/tech|infra|platform|stack/.test(p)) return `${orgName} uses robust infrastructure and purpose-built systems to power its core functions.`;
  if (/partner|ecosystem|integrat/.test(p)) return `${orgName} works with external organizations and platforms to extend its reach and capabilities.`;
  if (/audience|customer|user/.test(p)) return `${orgName} serves a defined audience with tailored features and dedicated support.`;
  if (/differenti|advantage|unique/.test(p)) return `${orgName} takes a distinctive approach that sets it apart from alternatives in its space.`;
  return `${orgName} operates with structured capabilities and a clear focus across its core domain.`;
}

function synthesizeAlternativeSubtitle(slide, subjectProfile, claims, seenTexts) {
  const orgName = subjectProfile.name || 'The Platform';

  const unused = (claims || []).filter((c) => {
    const text = c.claim || '';
    return text.length >= 15 && !seenTexts.some((prev) => areTextsSubstantiallyDuplicate(text, prev.text));
  });
  if (unused.length > 0) {
    const pick = unused[0].claim;
    return pick.length > 130 ? pick.slice(0, 125) + '…' : pick;
  }

  const p = (slide.purpose || slide.type || '').toLowerCase();
  if (/tech|infra/.test(p)) return `Engineered infrastructure and systems that power ${orgName}.`;
  if (/partner|ecosystem/.test(p)) return `${orgName}'s collaborative network and integration layer.`;
  if (/metric|scale/.test(p)) return `Measurable impact and operational scale across ${orgName}'s activities.`;
  if (/audience|customer/.test(p)) return `The people and organizations ${orgName} is built to serve.`;
  return `Core operational strengths and strategic focus at ${orgName}.`;
}
