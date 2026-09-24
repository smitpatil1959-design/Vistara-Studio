/**
 * understanding.v2 — the canonical AI brief schema.
 *
 * Every value cluster separates FACT (measured/extracted from the site) from
 * INTERPRETATION (AI reasoning over facts) via `basis`, `confidence` and
 * `evidence`. The validator enforces this shape before anything is stored.
 */

export const scopedValue = (required = true) => ({
  type: 'object',
  additionalProperties: false,
  required: required ? ['value', 'basis', 'confidence', 'evidence'] : [],
  properties: {
    value: { type: 'string', maxLength: 400 },
    basis: { enum: ['fact', 'inferred'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    evidence: { type: 'array', items: { type: 'string', maxLength: 220 }, maxItems: 6 },
  },
});

export const scopedList = (maxItems = 8) => ({
  type: 'array',
  maxItems,
  items: scopedValue(),
});

export const UNDERSTANDING_SCHEMA = {
  $id: 'understanding.v2',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'identity', 'classification', 'audience', 'purpose', 'value', 'offering', 'technology', 'content', 'story', 'meta'],
  properties: {
    schemaVersion: { const: 'understanding.v2' },

    identity: {
      type: 'object',
      additionalProperties: false,
      required: ['websiteName', 'productName', 'tagline'],
      properties: {
        websiteName: scopedValue(),
        productName: scopedValue(),
        tagline: scopedValue(),
      },
    },

    classification: {
      type: 'object',
      additionalProperties: false,
      required: ['category'],
      properties: {
        category: scopedValue(),
        subcategory: { type: ['string', 'null'], maxLength: 80 },
      },
    },

    audience: {
      type: 'object',
      additionalProperties: false,
      required: ['primary', 'segments'],
      properties: {
        primary: scopedValue(),
        segments: scopedList(4),
      },
    },

    purpose: {
      type: 'object',
      additionalProperties: false,
      required: ['primary'],
      properties: {
        primary: scopedValue(),
        callToActionHint: { type: ['string', 'null'], maxLength: 140 },
      },
    },

    value: {
      type: 'object',
      additionalProperties: false,
      required: ['uniqueSellingPoint', 'differentiators'],
      properties: {
        uniqueSellingPoint: scopedValue(),
        differentiators: scopedList(4),
      },
    },

    offering: {
      type: 'object',
      additionalProperties: false,
      required: ['keyFeatures', 'services', 'benefits'],
      properties: {
        keyFeatures: scopedList(7),
        services: scopedList(6),
        benefits: scopedList(5),
      },
    },

    technology: {
      type: 'object',
      additionalProperties: false,
      required: ['signals'],
      properties: {
        signals: scopedList(8),
        stackSummary: { type: ['string', 'null'], maxLength: 160 },
      },
    },

    content: {
      type: 'object',
      additionalProperties: false,
      required: ['importantPages', 'keyMessages', 'tone'],
      properties: {
        importantPages: {
          type: 'array',
          maxItems: 6,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['path', 'title', 'basis', 'evidence'],
            properties: {
              path: { type: 'string', maxLength: 120 },
              title: { type: 'string', maxLength: 140 },
              basis: { enum: ['fact', 'inferred'] },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              evidence: { type: 'array', items: { type: 'string', maxLength: 220 }, maxItems: 4 },
            },
          },
        },
        keyMessages: scopedList(6),
        tone: scopedValue(),
      },
    },

    story: {
      type: 'object',
      additionalProperties: false,
      required: ['suggestedNarrative', 'sectionArc'],
      properties: {
        suggestedNarrative: scopedValue(),
        sectionArc: { type: 'array', maxItems: 14, items: { type: 'string', maxLength: 40 } },
        watchouts: { type: 'array', maxItems: 4, items: { type: 'string', maxLength: 160 } },
      },
    },

    meta: {
      type: 'object',
      additionalProperties: false,
      required: ['engine', 'attempts', 'validated', 'generatedAt'],
      properties: {
        engine: { type: 'string', maxLength: 60 },
        model: { type: ['string', 'null'], maxLength: 60 },
        attempts: { type: 'integer', minimum: 1, maximum: 5 },
        validated: { type: 'boolean' },
        factShare: { type: 'number', minimum: 0, maximum: 1 },
        note: { type: ['string', 'null'], maxLength: 240 },
        generatedAt: { type: 'string' },
      },
    },

    dna: {
      type: 'object',
    },
  },
};

export default UNDERSTANDING_SCHEMA;
