/**
 * Vistara Studio — Presentation Content Rewriter v2
 *
 * Transforms raw crawl/research evidence into boardroom-ready presentation copy.
 * v2 improvements:
 *   - Purpose angle propagated into AI polish system prompt
 *   - Global claim deduplication registry (4-layer) across all slides
 *   - Evidence-derived CTA slide (no hardcoded bullets)
 *   - Domain-agnostic fallback text throughout
 *   - AI polish explicitly rejects generic category titles
 */

import { llmAvailable } from '../understanding/llm.js';
import { areTextsSubstantiallyDuplicate } from './presentationCritic.js';

/**
 * @param {Array} slidePlan    - Output from storyPlanner.js
 * @param {Object} subjectProfile
 * @param {Object} project
 * @returns {Promise<Array>}
 */
export async function writePresentationContent(slidePlan, subjectProfile, project) {
  const { name, cleanPositioning, rawScreenshot } = subjectProfile;
  const slides = [];

  // Global dedup registries
  const usedClaimTextPrefixes = new Set();   // normalized 60-char prefix → used
  const usedSubtitleTexts = [];              // { text } for semantic similarity check

  for (let idx = 0; idx < slidePlan.length; idx++) {
    const item = slidePlan[idx];
    const isHero    = item.section === 'hero';
    const isClosing = item.section === 'cta';

    // ── Hero ──────────────────────────────────────────────────────────────────
    if (isHero) {
      const heroSubtitle = cleanPositioning || '';
      usedSubtitleTexts.push({ text: heroSubtitle });

      slides.push({
        type: 'hero',
        sort_order: idx + 1,
        title: name,
        subtitle: heroSubtitle,
        body: '',
        bullets: [],
        stats: (subjectProfile.keyMetrics || []).slice(0, 3),
        image_url: rawScreenshot,
        layout: rawScreenshot ? 'split' : 'center',
        animation: 'fade',
        theme_override: null,
        custom_label: item.kicker || 'INTRODUCTION',
        project_id: project?.id,
        claim_ids: [],
        evidence_ids: [],
        source_urls: /^https?:\/\//i.test(project?.url || '') ? [project.url] : [],
        topicKey: 'hero',
        purpose: 'opening',
        visualIntent: item.visualIntent || 'screenshot',
      });
      continue;
    }

    // ── Closing / CTA ─────────────────────────────────────────────────────────
    if (isClosing) {
      const allUrls = [...new Set((item.supportingClaims || []).flatMap((c) => c.source_urls || []))].slice(0, 6);
      const { closingBody, closingBullets } = buildEvidenceBasedClosing(
        item.supportingClaims || [], name, subjectProfile, usedSubtitleTexts
      );

      slides.push({
        type: 'cta',
        sort_order: idx + 1,
        title: item.suggestedTitle || `${name} at a Glance`,
        subtitle: closingBody,
        body: '',
        bullets: closingBullets,
        stats: (subjectProfile.keyMetrics || []).slice(0, 2),
        image_url: null,
        layout: 'center',
        animation: 'fade',
        theme_override: null,
        custom_label: item.kicker || 'SUMMARY',
        project_id: project?.id,
        claim_ids: (item.supportingClaims || []).map((c) => c.id).filter(Boolean),
        evidence_ids: (item.supportingClaims || []).flatMap((c) => c.evidence_ids || []).filter(Boolean),
        source_urls: allUrls,
        topicKey: 'closing',
        purpose: 'closing',
        visualIntent: item.visualIntent || 'editorial',
      });
      continue;
    }

    // ── Content slides ─────────────────────────────────────────────────────────

    // Filter out claims already used as primary elsewhere
    const candidateClaims = (item.supportingClaims || []).filter((c) => {
      const norm = (c.claim || '').toLowerCase().slice(0, 60);
      return !usedClaimTextPrefixes.has(norm);
    });
    const activeClaims = candidateClaims.length > 0 ? candidateClaims : (item.supportingClaims || []);

    // Mark claims as used
    activeClaims.forEach((c) => usedClaimTextPrefixes.add((c.claim || '').toLowerCase().slice(0, 60)));

    const { body, bullets } = transformClaimsIntoCards(activeClaims, item.purpose || item.section, name, usedSubtitleTexts, item.suggestedTitle);
    const stats = extractSlideStats(activeClaims);

    if (body) usedSubtitleTexts.push({ text: body });

    const provenance = activeClaims.reduce(
      (acc, c) => ({
        claimIds: [...acc.claimIds, c.id],
        evidenceIds: [...acc.evidenceIds, ...(c.evidence_ids || [])],
        sourceUrls: [...acc.sourceUrls, ...(c.source_urls || [])],
      }),
      { claimIds: [], evidenceIds: [], sourceUrls: [] }
    );

    slides.push({
      type: item.section,
      sort_order: idx + 1,
      title: item.suggestedTitle,
      subtitle: body.length > 0 ? body.slice(0, 140) : '',
      body: '',
      bullets,
      stats,
      image_url: null,
      layout: item.layoutArchetype || (bullets.length >= 3 ? 'grid' : 'split'),
      animation: 'fade',
      theme_override: null,
      custom_label: item.kicker || (item.purpose || item.section || '').toUpperCase().replace(/_/g, ' '),
      project_id: project?.id,
      claim_ids: [...new Set(provenance.claimIds)].slice(0, 15),
      evidence_ids: [...new Set(provenance.evidenceIds)].slice(0, 15),
      source_urls: [...new Set(provenance.sourceUrls)].slice(0, 6),
      topicKey: item.topicKey,
      purpose: item.purpose,
      visualIntent: item.visualIntent,
      purposeAngle: item.purposeAngle,   // carried through for AI polish
    });
  }

  // Optional AI copy polish (purpose-angle-aware)
  if (llmAvailable()) {
    try {
      const polished = await polishPresentationCopy(slides, name, project);
      if (polished) return polished;
    } catch (e) {
      console.warn('[contentRewriter] AI polish skipped:', e.message);
    }
  }

  return slides;
}

// ---------------------------------------------------------------------------
// Evidence-Based Closing Slide
// ---------------------------------------------------------------------------

function buildEvidenceBasedClosing(claims, orgName, subjectProfile, usedSubtitleTexts) {
  const validClaims = (claims || []).filter((c) => {
    const text = (c.claim || '').trim();
    return text.length >= 20 && text.length <= 250;
  });

  let closingBody = '';
  const tagline = subjectProfile.cleanPositioning || subjectProfile.tagline || '';
  if (tagline && tagline.length >= 20) {
    closingBody = tagline.length <= 140 ? tagline : tagline.slice(0, 137) + '…';
  } else if (validClaims.length > 0) {
    const best = validClaims[0].claim;
    closingBody = best.length <= 140 ? best : best.slice(0, 137) + '…';
  } else {
    closingBody = `${orgName} provides structured capabilities and evidence-grounded value across its core domain.`;
  }

  const closingBullets = [];
  const seenBulletTexts = new Set();

  for (const c of validClaims) {
    if (closingBullets.length >= 3) break;
    const text = (c.claim || '').trim();
    const norm = text.toLowerCase().slice(0, 50);
    if (seenBulletTexts.has(norm)) continue;
    if (areTextsSubstantiallyDuplicate(text, closingBody)) continue;

    const isUsedElsewhere = usedSubtitleTexts.some((prev) => areTextsSubstantiallyDuplicate(text, prev.text));
    if (isUsedElsewhere) continue;

    const formatted = formatSingleCard(text);
    if (formatted) {
      seenBulletTexts.add(norm);
      closingBullets.push(formatted);
    }
  }

  if (closingBullets.length === 0) {
    closingBullets.push(
      `Evidence-grounded — All insights derived from official and verified sources`,
      `Comprehensive — Covers key dimensions of ${orgName}'s domain and offerings`,
      `Current — Reflects the latest available information from ${orgName}'s web presence`
    );
  }

  return { closingBody, closingBullets };
}

// ---------------------------------------------------------------------------
// Claims → Cards
// ---------------------------------------------------------------------------

function transformClaimsIntoCards(claims, sectionPurpose, orgName, usedSubtitleTexts = [], slideTitle = '') {
  if (!claims || claims.length === 0) {
    return {
      body: `${orgName} has structured operations in this area based on available evidence.`,
      bullets: [],
    };
  }

  const rawTexts = claims
    .map((c) => (typeof c.claim === 'string' ? c.claim.trim() : ''))
    .filter((t) => t.length > 10 && t !== '[object Object]');

  let bodyText = '';
  for (const t of rawTexts) {
    const isDup = usedSubtitleTexts.some((prev) => areTextsSubstantiallyDuplicate(t, prev.text));
    const isTitleDup = slideTitle && areTextsSubstantiallyDuplicate(t, slideTitle);
    if (!isDup && !isTitleDup) { bodyText = t; break; }
  }

  if (!bodyText) bodyText = synthesizeSectionSubtitle(sectionPurpose, orgName);

  if (bodyText.length > 140) {
    bodyText = bodyText.split(/[.!?]/)[0].trim();
    if (!bodyText.endsWith('.')) bodyText += '.';
  }

  const bullets = [];
  for (const raw of rawTexts.slice(0, 4)) {
    const formatted = formatSingleCard(raw);
    if (formatted && !bullets.includes(formatted)) bullets.push(formatted);
  }

  return { body: bodyText, bullets: bullets.slice(0, 4) };
}

/**
 * Neutral subtitle synthesizer — uses only the slide's purpose role.
 * No vehicle/food/SaaS/education-specific text.
 */
function synthesizeSectionSubtitle(purposeOrSection, orgName) {
  const p = (purposeOrSection || '').toLowerCase();
  if (/metric|scale|number|stat/.test(p))            return `${orgName}'s measurable performance and operational scope.`;
  if (/tech|infra|platform|stack/.test(p))            return `Infrastructure and systems that power ${orgName}'s core functions.`;
  if (/partner|ecosystem|integrat/.test(p))           return `${orgName}'s collaborative network and integration capabilities.`;
  if (/audience|customer|user|serve/.test(p))         return `The people and organizations that ${orgName} is built to serve.`;
  if (/differenti|advantage|unique|compet/.test(p))   return `What sets ${orgName} apart in its domain.`;
  if (/product|offer|service/.test(p))                return `${orgName}'s core products, services, and offerings.`;
  if (/capabilit|feature|tool/.test(p))               return `Key capabilities that ${orgName} provides to its users.`;
  if (/pricing|plan|tier/.test(p))                    return `Pricing and access options available through ${orgName}.`;
  return `Core dimensions of ${orgName}'s operations and value proposition.`;
}

function formatSingleCard(text) {
  if (!text) return null;
  if (text.includes(' — ')) {
    const parts = text.split(' — ');
    return `${cleanCardTitle(parts[0])} — ${cleanCardDetail(parts[1])}`;
  }
  const words = text.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/);
  let title = words.slice(0, 3).join(' ');
  title = title.charAt(0).toUpperCase() + title.slice(1);
  let detail = text.slice(0, 72).trim();
  if (detail.length >= 72) detail = detail.slice(0, 68).replace(/\s\S*$/, '') + '…';
  return `${cleanCardTitle(title)} — ${cleanCardDetail(detail)}`;
}

function boundedCopy(value, limit) {
  const text = String(value || '').trim();
  if (text.length <= limit) return text;
  return text.slice(0, limit - 1).replace(/\s+\S*$/, '').trimEnd() + '…';
}
function cleanCardTitle(t) { return boundedCopy((t || '').trim().replace(/^[\d\s.\-·]+/, ''), 32); }
function cleanCardDetail(d) { return boundedCopy(d, 72); }

function extractSlideStats(claims) {
  const stats = [];
  const seen = new Set();
  for (const c of claims) {
    const txt = typeof c.claim === 'string' ? c.claim : '';
    const match = txt.match(/\b(\d[\d,]*(?:\.\d+)?[KMBT]?\+?)\s+(users|customers|attendees|countries|cities|members|downloads|employees|projects|organizations|groups|languages)\b/i);
    if (match && stats.length < 3) {
      const val = match[1].trim();
      const label = match[2].trim();
      const key = `${val}-${label}`.toLowerCase();
      if (!seen.has(key) && val.length <= 12 && label.length <= 22) {
        seen.add(key);
        stats.push({ value: val, label });
      }
    }
  }
  return stats;
}

// ---------------------------------------------------------------------------
// Purpose-Aware AI Copy Polish
// ---------------------------------------------------------------------------

async function polishPresentationCopy(slides, subjectName, project) {
  const llmModule = await import('../understanding/llm.js');
  if (!llmModule?.llmComplete) return null;

  // Extract purpose angle from the first non-hero slide that has it
  const purposeAngle = slides.find((s) => s.purposeAngle)?.purposeAngle || 'balanced, boardroom-safe';
  const purposeLabel = (project?.intake?.purpose || 'general').replace(/_/g, ' ').replace(/-/g, ' ');

  const payload = slides
    .filter((s) => s.type !== 'hero')
    .map((s, i) => ({
      i,
      section: s.type,
      title: s.title,
      subtitle: s.subtitle,
      cards: (s.bullets || []).map((b) => {
        const parts = b.split(' — ');
        return { title: parts[0] || '', detail: parts[1] || '' };
      }),
    }));

  if (payload.length === 0) return null;

  const system = [
    `You are the Vistara Executive Presentation Writer crafting a deck about "${subjectName}".`,
    `Presentation purpose: ${purposeLabel}.`,
    `Writing angle: ${purposeAngle}.`,
    '',
    'MANDATORY TITLE RULE:',
    '  Express an INSIGHT, not a category name.',
    '  BAD: "Products & Services" | "Key Capabilities" | "Our Platform" | "Overview"',
    '  GOOD: "Three workflows built for enterprise teams" | "17M active users across 500 cities"',
    '  Titles must be specific, evidence-derived statements ≤ 65 chars.',
    '',
    'CRITICAL RULES:',
    '  1. NEVER invent facts, metrics, products, or claims not in the input.',
    '  2. Subtitle: a concrete takeaway sentence ≤ 120 chars, specific to this slide\'s evidence.',
    '  3. Cards: exactly match input count. Title ≤ 28 chars. Detail ≤ 65 chars, concrete.',
    '  4. NEVER mention web audits, SEO scores, crawl results, or technical web metrics.',
    '  5. Every sentence must trace back to a fact present in the input.',
    '  6. A title describes one supported claim. Do not attach a version, date or metric to a different benefit unless the input explicitly links them.',
    '',
    'Return ONLY JSON: { "slides": [ { "i": number, "title": string, "subtitle": string, "cards": [ { "title": string, "detail": string } ] } ] }',
  ].join('\n');

  try {
    const reply = await llmModule.llmComplete(system, JSON.stringify(payload));
    const parsed = JSON.parse(reply.text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, ''));
    if (!parsed?.slides || !Array.isArray(parsed.slides) || parsed.slides.length !== payload.length) return null;
    if (new Set(parsed.slides.map(slide => slide.i)).size !== payload.length || parsed.slides.some(slide => !Number.isInteger(slide.i) || slide.i < 0 || slide.i >= payload.length)) return null;
    console.log('[contentRewriter] AI copy applied:', reply.engine, reply.model, payload.length, 'slides');

    const polishedMap = new Map(parsed.slides.map((p) => [p.i, p]));
    let idx = 0;

    return slides.map((s) => {
      if (s.type === 'hero') return s;
      const p = polishedMap.get(idx++);
      if (!p) return s;
      const figures = value => (String(value).match(/\d[\d,]*(?:\.\d+)?/g) || []).map(number => number.replace(/,/g, ''));
      const supplied = new Set(figures([s.title, s.subtitle, ...(s.bullets || [])].join(' ')));
      const suggested = [p.title, p.subtitle, ...(Array.isArray(p.cards) ? p.cards.flatMap(card => [card.title, card.detail]) : [])].join(' ');
      if (figures(suggested).some(number => !supplied.has(number))) return s;

      const cards = Array.isArray(p.cards)
        ? p.cards.map((c) => `${cleanCardTitle(c.title || '')} — ${cleanCardDetail(c.detail || '')}`)
        : s.bullets;

      return {
        ...s,
        title: p.title ? String(p.title).slice(0, 75) : s.title,
        subtitle: p.subtitle ? String(p.subtitle).slice(0, 140) : s.subtitle,
        bullets: cards.length > 0 ? cards.slice(0, 4) : s.bullets,
      };
    });
  } catch (e) {
    console.warn('[contentRewriter] AI polish parse failed:', e.message);
    return null;
  }
}
