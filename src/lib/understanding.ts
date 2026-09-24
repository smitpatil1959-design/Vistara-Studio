import type { Understanding } from '../types';

/** A schema-bound value: fact measured on the site, or an inference — never mixed. */
export interface ScopedValue {
  value: string;
  basis: 'fact' | 'inferred';
  confidence: number;
  evidence: string[];
}

export interface RichUnderstanding {
  schemaVersion: 'understanding.v2';
  identity: { websiteName: ScopedValue; productName: ScopedValue; tagline: ScopedValue };
  classification: { category: ScopedValue; subcategory: string | null };
  audience: { primary: ScopedValue; segments: ScopedValue[] };
  purpose: { primary: ScopedValue; callToActionHint: string | null };
  value: { uniqueSellingPoint: ScopedValue; differentiators: ScopedValue[] };
  offering: { keyFeatures: ScopedValue[]; services: ScopedValue[]; benefits: ScopedValue[] };
  technology: { signals: ScopedValue[]; stackSummary: string | null };
  content: {
    importantPages: { path: string; title: string; basis: 'fact' | 'inferred'; confidence: number; evidence: string[] }[];
    keyMessages: ScopedValue[];
    tone: ScopedValue;
  };
  story: { suggestedNarrative: ScopedValue; sectionArc: string[]; watchouts: string[] };
  meta: { engine: string; model: string | null; attempts: number; validated: boolean; factShare: number; note: string | null; generatedAt: string };
  __host?: string;
}

export function isRichUnderstanding(u: unknown): u is RichUnderstanding {
  return !!u && typeof u === 'object' && (u as { schemaVersion?: string }).schemaVersion === 'understanding.v2';
}

/** Rich brief → flat working shape (deck composer, quick facts, legacy panels). */
export function flattenUnderstanding(u: Understanding | RichUnderstanding | null | undefined): Understanding | null {
  if (!u) return null;
  if (!isRichUnderstanding(u)) return u as Understanding;
  const v = (s?: ScopedValue) => (s && typeof s.value === 'string' ? s.value : '');
  const splitPair = (s: string) => {
    const i = s.indexOf(' — ');
    return i === -1 ? { name: s, desc: '' } : { name: s.slice(0, i), desc: s.slice(i + 3) };
  };
  return {
    productName: v(u.identity.productName),
    tagline: v(u.identity.tagline),
    category: v(u.classification.category),
    summary: v(u.story.suggestedNarrative),
    audience: [v(u.audience.primary), ...(u.audience.segments || []).map(v)].filter(Boolean),
    businessGoal: v(u.purpose.primary),
    features: (u.offering.keyFeatures || []).map((s) => splitPair(v(s))),
    benefits: (u.offering.benefits || []).map((s) => ({ title: splitPair(v(s)).name, desc: splitPair(v(s)).desc || v(s), metric: '' })),
    usps: [v(u.value.uniqueSellingPoint), ...(u.value.differentiators || []).map(v)].filter(Boolean),
    technology: (u.technology.signals || []).map(v).filter(Boolean),
    tone: v(u.content.tone),
    host: u.__host || '',
  };
}
