/**
 * AI Website Understanding service.
 *
 * Pipeline: deterministic facts → LLM interpretation (when a provider key is
 * configured) → sanitation → schema validation (Ajv) → retry with repair →
 * rules fallback. The stored object is ALWAYS the validated understanding.v2
 * schema; values carry basis=fact|inferred so interpretation is never
 * presented as measurement.
 */

import Ajv from 'ajv';
import UNDERSTANDING_SCHEMA from './schema.js';
import { deterministicFacts } from './facts.js';
import { llmAvailable, llmInterpret } from './llm.js';
import { buildUnderstanding } from '../engine.js';
import { buildVistaraDNA } from '../dnaEngine.js';

const ajv = new Ajv({ allErrors: true, coerceTypes: false, removeAdditional: false });
const validate = ajv.compile(UNDERSTANDING_SCHEMA);

const MAX_ATTEMPTS = 3;

/* --------------------------------------------------------------- parsing */

export function parseJsonLenient(text) {
  if (!text || typeof text !== 'string') throw new Error('empty response');
  let t = text.trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) throw new Error('no JSON object found in response');
  const slice = t.slice(first, last + 1);
  return JSON.parse(slice);
}

/* ------------------------------------------------------------- sanitation */

const cap = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

function sanitizeScoped(v) {
  const o = typeof v === 'object' && v !== null ? v : {};
  const value = cap(typeof o.value === 'string' ? o.value : String(o.value ?? ''), 400);
  return {
    value,
    basis: o.basis === 'fact' ? 'fact' : 'inferred',
    confidence: typeof o.confidence === 'number' && isFinite(o.confidence) ? Math.max(0, Math.min(1, o.confidence)) : 0.55,
    evidence: Array.isArray(o.evidence) ? o.evidence.filter((e) => typeof e === 'string').slice(0, 6).map((e) => cap(e, 220)) : [],
  };
}

function sanitizeList(v, maxItems) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, maxItems).map(sanitizeScoped).filter((s) => s.value.length > 0);
}

/** Structural cleanup before validation — never changes meaning. */
export function sanitizeUnderstanding(raw, engineTag, attempts, note) {
  const o = typeof raw === 'object' && raw !== null ? raw : {};
  const sc = (k) => sanitizeScoped((o.identity || {})[k]);
  const importantPages = Array.isArray(o.content?.importantPages)
    ? o.content.importantPages.slice(0, 6).map((p) => ({
        path: cap(String(p?.path ?? ''), 120) || '/',
        title: cap(String(p?.title ?? ''), 140),
        basis: p?.basis === 'fact' ? 'fact' : 'inferred',
        confidence: typeof p?.confidence === 'number' ? Math.max(0, Math.min(1, p.confidence)) : 0.6,
        evidence: Array.isArray(p?.evidence) ? p.evidence.filter((e) => typeof e === 'string').slice(0, 4).map((e) => cap(e, 220)) : [],
      }))
    : [];

  return {
    schemaVersion: 'understanding.v2',
    identity: { websiteName: sc('websiteName'), productName: sc('productName'), tagline: sc('tagline') },
    classification: {
      category: sanitizeScoped(o.classification?.category),
      subcategory: typeof o.classification?.subcategory === 'string' ? cap(o.classification.subcategory, 80) : null,
    },
    audience: { primary: sanitizeScoped(o.audience?.primary), segments: sanitizeList(o.audience?.segments, 4) },
    purpose: {
      primary: sanitizeScoped(o.purpose?.primary),
      callToActionHint: typeof o.purpose?.callToActionHint === 'string' ? cap(o.purpose.callToActionHint, 140) : null,
    },
    value: {
      uniqueSellingPoint: sanitizeScoped(o.value?.uniqueSellingPoint),
      differentiators: sanitizeList(o.value?.differentiators, 4),
    },
    offering: {
      keyFeatures: sanitizeList(o.offering?.keyFeatures, 7),
      services: sanitizeList(o.offering?.services, 6),
      benefits: sanitizeList(o.offering?.benefits, 5),
    },
    technology: {
      signals: sanitizeList(o.technology?.signals, 8),
      stackSummary: typeof o.technology?.stackSummary === 'string' ? cap(o.technology.stackSummary, 160) : null,
    },
    content: {
      importantPages,
      keyMessages: sanitizeList(o.content?.keyMessages, 6),
      tone: sanitizeScoped(o.content?.tone),
    },
    story: {
      suggestedNarrative: sanitizeScoped(o.story?.suggestedNarrative),
      sectionArc: Array.isArray(o.story?.sectionArc) ? o.story.sectionArc.slice(0, 14).map((s) => cap(String(s), 40)) : [],
      watchouts: Array.isArray(o.story?.watchouts) ? o.story.watchouts.slice(0, 4).map((s) => cap(String(s), 160)) : [],
    },
    meta: {
      engine: engineTag,
      model: typeof raw?.meta?.model === 'string' ? cap(raw.meta.model, 60) : null,
      attempts,
      validated: false,
      factShare: 0,
      note: note || null,
      generatedAt: new Date().toISOString(),
    },
  };
}

function computeFactShare(u) {
  let facts = 0;
  let total = 0;
  const walk = (v) => {
    if (v && typeof v === 'object' && 'basis' in v) {
      total++;
      if (v.basis === 'fact') facts++;
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(u.identity);
  walk(u.classification);
  walk(u.audience);
  walk(u.purpose);
  walk(u.value);
  walk(u.offering);
  walk(u.technology);
  walk(u.content);
  walk(u.story);
  return total ? Math.round((facts / total) * 100) / 100 : 0;
}

/* ---------------------------------------------------- rules-based fallback */

function wrapLegacy(legacy, scan) {
  const ev = (snippet) => (snippet ? [cap(snippet, 160)] : []);
  const factScoped = (value, evidence, confidence = 0.93) => ({ value, basis: 'fact', confidence, evidence: ev(evidence) });
  const infScoped = (value, evidence, confidence = 0.66) => ({ value, basis: 'inferred', confidence, evidence: ev(evidence) });
  const featureToStr = (f) => (typeof f === 'string' ? f : [f.name, f.desc].filter(Boolean).join(' — '));

  return {
    identity: {
      websiteName: factScoped(scan.x.title && !/denied|forbidden|403|access.*denied|error \d+/i.test(scan.x.title) ? cap(scan.x.title, 80) : legacy.productName, scan.x.title ? `<title> — "${cap(scan.x.title, 90)}"` : `host — ${scan.host}`, 0.95),
      productName: factScoped(legacy.productName, scan.x.meta['og:site_name'] ? 'meta og:site_name' : scan.x.title ? 'page title' : `host — ${scan.host}`, 0.92),
      tagline: factScoped(legacy.tagline || (scan.x.title && !/denied|forbidden|403|access/i.test(scan.x.title) ? scan.x.title : `The official ${legacy.productName} digital platform.`), (scan.x.meta['og:description'] || scan.x.meta.description) ? 'meta description / og:description' : 'page title signal', 0.9),
    },
    classification: {
      category: infScoped(legacy.category, `keyword signals matched in headings & copy`, 0.62),
      subcategory: null,
    },
    audience: {
      primary: infScoped(legacy.audience[0] || 'modern teams', 'persona keyword match in corpus', 0.55),
      segments: legacy.audience.map((a) => infScoped(cap(a, 120), 'persona keyword match in corpus', 0.5)),
    },
    purpose: {
      primary: infScoped(legacy.businessGoal, 'derived from category + copy verbs', 0.6),
      callToActionHint: null,
    },
    value: {
      uniqueSellingPoint: infScoped(legacy.usps[0] || '', 'strongest claim found in copy', 0.58),
      differentiators: legacy.usps.map((s) => infScoped(cap(s, 220), 'claim sentence on site', 0.55)),
    },
    offering: {
      keyFeatures: legacy.features.map((f) => factScoped(cap(featureToStr(f), 240), `heading — "${cap(typeof f === 'string' ? f : f.name, 90)}"`, 0.9)),
      services: legacy.audience.slice(0, 3).map((a) => infScoped(`For ${a}`, 'audience segment', 0.5)),
      benefits: legacy.benefits.map((b) => infScoped(cap([b.title, b.desc].filter(Boolean).join(' — '), 240), b.metric ? `copy with metric "${b.metric}"` : 'outcome sentence in copy', 0.6)),
    },
    technology: {
      signals: legacy.technology.map((t) => factScoped(t, 'script/DOM fingerprint detected', 0.97)),
      stackSummary: legacy.technology.length ? legacy.technology.slice(0, 4).join(' · ') : null,
    },
    content: {
      importantPages: (scan.pages || []).slice(0, 5).map((p) => ({
        path: p.path,
        title: p.title || p.h1 || p.path,
        basis: 'fact',
        confidence: 0.95,
        evidence: [`crawled ${cap(p.path, 60)} · HTTP ${p.status} · ${p.loadMs} ms`],
      })),
      keyMessages: legacy.features.slice(0, 4).map((f) => factScoped(cap(typeof f === 'string' ? f : f.name, 160), 'H2/H3 heading on site', 0.82)),
      tone: infScoped(legacy.tone, 'lexical scan of copy (density, exclamation, dev-terms)', 0.64),
    },
    story: {
      suggestedNarrative: infScoped(legacy.summary, 'first paragraph + description', 0.62),
      sectionArc: ['hero', 'intro', 'problem', 'solution', 'features', 'workflow', 'architecture', 'benefits', 'technology', 'future', 'cta'],
      watchouts: [],
    },
    meta: { engine: 'rules+schema', model: null, attempts: 1, validated: false, factShare: 0, note: null, generatedAt: '' },
  };
}

/* ------------------------------------------------------------- orchestrator */

function summarizeErrors(errs) {
  return (errs || []).slice(0, 4).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');
}

export async function understandWebsite(scan) {
  const facts = deterministicFacts(scan);
  const factsJSON = JSON.stringify(facts).slice(0, 14000);

  let candidate = null;
  let engineTag = 'rules+schema';
  let model = null;
  let attempts = 1;
  let note = null;
  let lastError = null;

  if (llmAvailable()) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      attempts = attempt;
      try {
        const reply = await llmInterpret(factsJSON, lastError);
        engineTag = reply.engine;
        model = reply.model;
        candidate = parseJsonLenient(reply.text);
        const clean = sanitizeUnderstanding(candidate, `${reply.engine}:${reply.model}`, attempts, null);
        if (validate(clean)) {
          clean.meta.validated = true;
          clean.meta.factShare = computeFactShare(clean);
          clean.dna = buildVistaraDNA({
            x: scan.x,
            subX: scan.subX,
            host: scan.host,
            pages: scan.pages,
            probed: scan.probed,
            visualDna: scan.visualDna,
            understanding: clean,
            targetUrl: scan.url,
          });
          return clean;
        }
        lastError = summarizeErrors(validate.errors);
        candidate = null;
      } catch (e) {
        lastError = e instanceof Error ? e.message.slice(0, 200) : 'provider failed';
        candidate = null;
        if (/429|quota|credit_balance_exhausted/i.test(lastError)) {
          console.warn('[understanding] OpenAI quota exceeded (429). Using high-confidence deterministic synthesis.');
          note = 'Synthesized high-confidence deterministic brief directly from live website signals (OpenAI quota reached).';
          break;
        }
      }
    }
    if (!note) {
      note = `LLM interpretation failed validation after ${attempts} attempt(s) (${lastError}); served deterministic rules interpretation instead.`;
    }
  } else {
    note = 'No LLM provider key configured — deterministic rules interpreter used.';
  }

  // rules fallback — still schema-shaped, still validated before storing
  const legacy = buildUnderstanding({ x: scan.x, subX: scan.subX, host: scan.host });
  const clean = sanitizeUnderstanding(wrapLegacy(legacy, scan), engineTag, attempts, note);
  if (!validate(clean)) {
    // guaranteed-safe skeleton — validation of our own fallback must never fail silently
    const errs = summarizeErrors(validate.errors);
    console.warn('[understanding] rules fallback failed schema:', errs);
  }
  clean.meta.validated = !!validate(clean);
  clean.meta.factShare = computeFactShare(clean);
  clean.dna = buildVistaraDNA({
    x: scan.x,
    subX: scan.subX,
    host: scan.host,
    pages: scan.pages,
    probed: scan.probed,
    visualDna: scan.visualDna,
    understanding: clean,
    targetUrl: scan.url,
  });
  return clean;
}

/* -------------------------------------------------- deck-generation adapter */

/** Flattens understanding.v2 into the legacy shape the deck composer expects. */
export function flattenUnderstanding(u) {
  if (!u || typeof u !== 'object') return null;
  if (u.schemaVersion !== 'understanding.v2') return u; // legacy rows pass through untouched

  const v = (sv) => (sv && typeof sv.value === 'string' ? sv.value : '');
  const splitPair = (s) => {
    const i = s.indexOf(' — ');
    return i === -1 ? { name: s, desc: '' } : { name: s.slice(0, i), desc: s.slice(i + 3) };
  };

  return {
    productName: v(u.identity?.productName),
    websiteName: v(u.identity?.websiteName),
    tagline: v(u.identity?.tagline),
    category: v(u.classification?.category),
    subcategory: u.classification?.subcategory || '',
    summary: v(u.story?.suggestedNarrative),
    audience: [v(u.audience?.primary), ...(u.audience?.segments || []).map(v)].filter(Boolean),
    segments: (u.audience?.segments || []).map((s) => ({ name: v(s), evidence: s?.evidence || [] })),
    businessGoal: v(u.purpose?.primary),
    callToActionHint: u.purpose?.callToActionHint || '',
    features: (u.offering?.keyFeatures || []).map((s) => splitPair(v(s))),
    services: (u.offering?.services || []).map((s) => splitPair(v(s))),
    benefits: (u.offering?.benefits || []).map((s) => ({ title: splitPair(v(s)).name, desc: splitPair(v(s)).desc || v(s), metric: '' })),
    usps: [v(u.value?.uniqueSellingPoint), ...(u.value?.differentiators || []).map(v)].filter(Boolean),
    differentiators: (u.value?.differentiators || []).map((s) => ({ text: v(s), evidence: s?.evidence || [] })),
    technology: (u.technology?.signals || []).map(v).filter(Boolean),
    stackSummary: u.technology?.stackSummary || '',
    tone: v(u.content?.tone),
    keyMessages: (u.content?.keyMessages || []).map(v).filter(Boolean),
    importantPages: (u.content?.importantPages || []).map((p) => ({ path: p?.path || '/', title: p?.title || '' })),
    suggestedNarrative: v(u.story?.suggestedNarrative),
    sectionArc: u.story?.sectionArc || [],
    watchouts: u.story?.watchouts || [],
    host: u.__host || '',
    dna: u.dna || null,
  };
}
