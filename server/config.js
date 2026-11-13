/**
 * Server Configuration
 *
 * Manages all server-side environment variables safely.
 * NEVER expose secrets to the client — especially OPENAI_API_KEY.
 *
 * Usage:
 *   import config from './config.js';
 *   const apiKey = config.openaiApiKey;
 */

const requiredKeys = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

/**
 * Safe diagnostic.
 * This NEVER prints the API key itself.
 */
console.log(
  '[vistara-config] OpenAI env:',
  !!process.env.OPENAI_API_KEY,
  'model:',
  process.env.OPENAI_MODEL || '(missing)'
);

const config = {
  // ── Supabase (required) ──────────────────────────────────────────────────
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,

  // ── OpenAI (SERVER-SIDE ONLY) ─────────────────────────────────────────────
  // Used for web research through the OpenAI Responses API.
  //
  // IMPORTANT:
  // Never rename this to VITE_OPENAI_API_KEY.
  // Never expose this value to frontend code.
  openaiApiKey: (process.env.OPENAI_API_KEY || '').trim(),

  openaiModel: (
    process.env.OPENAI_MODEL || 'gpt-4o-mini'
  ).trim(),

  // ── Research budget ──────────────────────────────────────────────────────
  maxCrawlPages: parseInt(
    process.env.MAX_CRAWL_PAGES || '50',
    10
  ),

  maxSearchQueries: parseInt(
    process.env.MAX_SEARCH_QUERIES || '10',
    10
  ),

  maxResearchSources: parseInt(
    process.env.MAX_RESEARCH_SOURCES || '30',
    10
  ),

  maxAiCallsPerStudy: parseInt(
    process.env.MAX_AI_CALLS_PER_STUDY || '20',
    10
  ),

  // ── Slide generation ──────────────────────────────────────────────────────
  // No minimum — the planner NEVER creates filler slides to reach a target.
  // Slide count is purely evidence-driven.
  // slideSafetyMax is an absolute ceiling to prevent runaway expansion,
  // NOT a target. Normal decks will be 4–12 slides.
  slideSafetyMax: parseInt(
    process.env.SLIDE_SAFETY_MAX || '16',
    10
  ),

  // ── Timeouts (milliseconds) ──────────────────────────────────────────────
  crawlTimeout: parseInt(
    process.env.CRAWL_TIMEOUT_MS || '30000',
    10
  ),

  searchTimeout: parseInt(
    process.env.SEARCH_TIMEOUT_MS || '15000',
    10
  ),

  maxResponseBytes: parseInt(
    process.env.MAX_RESPONSE_BYTES ||
    String(2 * 1024 * 1024),
    10
  ),

  // ── Application ──────────────────────────────────────────────────────────
  environment: process.env.NODE_ENV || 'development',

  isDevelopment:
    (process.env.NODE_ENV || 'development') === 'development',

  isProduction:
    (process.env.NODE_ENV || 'development') === 'production',

  /**
   * Validate required environment variables.
   *
   * @returns {{
   *   valid: boolean,
   *   missing: string[],
   *   warnings: string[]
   * }}
   */
  getMissingKeys() {
    return requiredKeys.filter(
      (key) => key === 'SUPABASE_URL' ? !this.supabaseUrl : !process.env[key]
    );
  },

  /**
   * Check whether OpenAI integration is available.
   *
   * IMPORTANT:
   * Do NOT require the key to start with "sk-".
   * OpenAI key formats can change, and the safest
   * configuration check is simply whether a value exists.
   *
   * @returns {boolean}
   */
  isOpenAiConfigured() {
    const provider = (process.env.AI_PROVIDER || 'auto').toLowerCase();
    return ['openai', 'auto'].includes(provider) && !(provider === 'auto' && process.env.NVIDIA_API_KEY) && !!this.openaiApiKey;
  },

  /**
   * Get configuration validation status.
   *
   * @returns {{
   *   valid: boolean,
   *   missing: string[],
   *   warnings: string[]
   * }}
   */
  validate() {
    const missing = this.getMissingKeys();
    const warnings = [];

    if (!this.isOpenAiConfigured()) {
      warnings.push(
        'OPENAI_API_KEY not configured — web research disabled; crawl-only mode active'
      );
    }

    if (!this.openaiModel) {
      warnings.push(
        'OPENAI_MODEL not configured — using default model'
      );
    }

    return {
      valid: missing.length === 0,
      missing,
      warnings,
    };
  },

  /**
   * Get a safe string representation for logging.
   *
   * NEVER include API keys or other secrets.
   *
   * @returns {string}
   */
  toLogString() {
    const status = this.validate();

    return [
      `Environment: ${this.environment}`,

      `Supabase: ${this.supabaseUrl ? '✓' : '✗'
      }`,

      `OpenAI web research: ${this.isOpenAiConfigured()
        ? `✓ (${this.openaiModel})`
        : '✗ crawl-only mode'
      }`,

      `Crawl limits: pages=${this.maxCrawlPages}, queries=${this.maxSearchQueries}, sources=${this.maxResearchSources}`,

      `Slide safety max: ${this.slideSafetyMax} (evidence-driven count, no floor)`,

      status.warnings.length > 0
        ? `⚠️ ${status.warnings.join('; ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  },
};

// ── Validate on module load ─────────────────────────────────────────────────
//
// Only required Supabase variables cause startup failure.
// Missing OpenAI configuration is allowed so the application
// can gracefully fall back to crawl-only mode.

const validation = config.validate();

// Validate on first database use. API modules must remain importable during
// deployment builds and for OPTIONS/liveness requests without runtime secrets.

if (validation.warnings.length > 0) {
  console.warn(
    '[vistara-config]',
    validation.warnings.join(' | ')
  );
}

export default config;
