/**
 * Canonical domain models for Vistara Studio.
 * Mirrors the Supabase (PostgreSQL) schema defined in /supabase/schema.sql.
 */

export interface SlideStat {
  value: string;
  label: string;
}

export interface Slide {
  id: string;
  project_id: string;
  sort_order: number;
  type: string;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  bullets: string[] | null;
  stats: SlideStat[] | null;
  image_url: string | null;
  layout: string | null;
  animation: string | null;
  theme_override: Record<string, unknown> | null;
  custom_label?: string | null;
}

/** Measured, evidence-backed audit finding — every field is factual. */
export type FindingSeverity = 'critical' | 'warning' | 'suggestion' | 'pass';

export interface AuditFinding {
  id: string;
  category: string;
  severity: FindingSeverity;
  title: string;
  explanation: string;
  /** measured evidence — status codes, ms, px, selectors, counts */
  evidence: string;
  recommendation: string;
}

export interface AuditCategory {
  key: string;
  label: string;
  score: number;
  findings: AuditFinding[];
}

export interface AuditVitals {
  lcpMs: number | null;
  cls: number;
  inpMs: number | null;
  inpSamples: number;
  longtasks: number;
  longtaskMs: number;
  perfIndex: number | null;
  fcpMs: number | null;
  ttfbMs: number | null;
  totalTransferKb: number;
  resourceCount: number;
}

export interface AuditViewportResult {
  name: string;
  width: number;
  height: number;
  viewportWidth: number;
  scrollableWidth: number;
  horizontalOverflowPx: number;
  clippedCount: number;
  offenders: string[];
}

export interface Audit {
  version?: string;
  engine?: 'rendered-browser' | 'document-capture';
  overall: number;
  score?: number;
  grade?: 'A' | 'B' | 'C' | 'D' | 'F';
  verdict: string;
  counts?: { critical: number; warning: number; suggestion: number; pass: number };
  categories: AuditCategory[];
  findings?: AuditFinding[];
  vitals?: AuditVitals | null;
  viewports?: AuditViewportResult[];
  security?: { https: boolean; mixedContent: boolean; cookieCount: number };
  generatedAt: string;
}

export interface AnalysisPage {
  url: string;
  path: string;
  title: string;
  h1: string;
  words: number;
  status: number;
  loadMs: number;
  images: number;
  links: number;
}

export interface AnalysisLinkProbe {
  url: string;
  status: number;
  ok: boolean;
  blocked?: boolean;
}

export interface RedirectHop {
  url: string;
  status: number;
  to: string | null;
}

export interface ConsoleCapture {
  text: string;
}

export interface FailedRequest {
  url: string;
  method: string;
  error: string;
}

export interface StructuredCrawlError {
  success: false;
  errorCode: string;
  message: string;
  url: string;
  finalUrl?: string | null;
  httpStatus?: number | null;
  stage?: string;
  retryable?: boolean;
  details?: string | null;
}

export interface Analysis {
  fetchedAt: string;
  url: string;
  finalUrl?: string;
  host: string;
  status: number;
  httpStatus?: number;
  loadMs: number;
  sizeKb: number;
  title: string;
  description: string;
  language: string;
  screenshot: string;
  pages: AnalysisPage[];
  headings: { level: number; text: string }[];
  paragraphs: string[];
  images: { src: string; alt: string | null; lazy: boolean }[];
  buttons?: string[];
  forms?: { inputs: number; labeled: number } | null;
  nav?: { hasHeader: boolean; hasNav: boolean; hasFooter: boolean } | null;
  colors: { hex: string; count: number }[];
  fonts: string[];
  tech: { name: string; category: string }[];
  links: { internal: number; external: number; probed: AnalysisLinkProbe[] };
  /** capture pipeline used — 'browser' = real Chromium render, 'document' = hardened fetch fallback */
  captureMode?: 'browser' | 'document';
  crawlStatus?: 'complete' | 'partial' | 'failed';
  dataQuality?: 'high' | 'limited' | 'partial';
  crawlError?: StructuredCrawlError | null;
  redirects?: RedirectHop[];
  consoleErrors?: ConsoleCapture[];
  failedRequests?: FailedRequest[];
  /** stage-scoped degradation — which sub-steps fell back, if any */
  failedStages?: { stage: string; message: string }[];
  briefEngine?: string;
  /** Internet research metadata attached by orchestrateResearch() */
  research?: {
    mode: 'crawl_only' | 'crawl_and_search';
    status: string;
    subject?: { name: string; domain: string; orgType: string; description: string } | null;
    summary?: { totalSources: number; totalEvidence: number; totalClaims: number; totalConflicts: number; durationMs: number } | null;
    webResearchStatus?: string;
  } | null;
}

export interface UnderstandingFeature {
  name: string;
  desc: string;
}

export interface UnderstandingBenefit {
  title: string;
  desc: string;
  metric: string;
}

export interface Understanding {
  productName: string;
  tagline: string;
  category: string;
  summary: string;
  audience: string[];
  businessGoal: string;
  features: UnderstandingFeature[];
  benefits: UnderstandingBenefit[];
  usps: string[];
  technology: string[];
  tone: string;
  host: string;
}

/** understanding.v2 — schema-validated, fact/inference separated. Canonical shape in /src/lib/understanding.ts */
export type { RichUnderstanding } from '../lib/understanding';

/** Projects store either the legacy flat brief or the v2 rich brief. */
export type AnyUnderstanding = Understanding | import('../lib/understanding').RichUnderstanding;

export type DeckSkin = 'light' | 'dark';
/** Named motion presets + the legacy temperament values. */
export type DeckMotion = 'smooth' | 'snappy' | 'calm' | 'cinematic' | 'elegant' | 'minimal' | 'futuristic' | 'energetic' | 'corporate';

export interface DeckTheme {
  skin: DeckSkin;
  accent: string;
  accent2: string;
  headingFont: string;
  bodyFont: string;
  motion: DeckMotion;
  radius: number;
}

/** Canonical research pipeline lifecycle. */
export type ProjectStatus =
  | 'queued'
  | 'crawling'
  | 'processing'
  | 'completed'
  | 'generating'
  | 'generated'
  | 'planning'
  | 'failed'
  // Research platform pipeline steps
  | 'identifying'
  | 'researching'
  | 'extracting'
  | 'validating'
  /** legacy aliases kept for rows written before the crawl lifecycle */
  | 'draft'
  | 'analyzing'
  | 'analyzed'
  | 'error';

/** What the presentation will be used for — steers tone and section emphasis at generation time. */
export type PresentationPurpose =
  // Legacy
  | 'college' | 'investor' | 'client' | 'product-demo' | 'portfolio' | 'general'
  // Research platform purposes
  | 'company_overview' | 'investor_research' | 'competitor_analysis'
  | 'product_research' | 'sales_presentation' | 'market_research';

export interface ProjectIntake {
  project_id: string;
  purpose: PresentationPurpose;
  design_prompt: string | null;
  created_at: string;
}

/** Intake payload supplied at study creation. */
export interface CreateStudyInput {
  url: string;
  purpose: PresentationPurpose;
  designPrompt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Research Platform Types
// ────────────────────────────────────────────────────────────────────────────

/** Subject identified from the crawled website */
export interface SubjectInfo {
  name: string;
  domain: string;
  orgType: string;
  description: string;
  url?: string;
}

/** Research session status */
export type ResearchSessionStatus =
  | 'queued' | 'identifying' | 'crawling' | 'researching'
  | 'extracting' | 'validating' | 'planning' | 'generating'
  | 'completed' | 'partial' | 'failed';

/** Research mode */
export type ResearchMode = 'crawl_only' | 'crawl_and_search';

/** Research session summary returned by /api/research */
export interface ResearchSession {
  id: string;
  status: ResearchSessionStatus;
  researchMode: ResearchMode;
  subjectName: string | null;
  subjectType: string | null;
  sourcesCount: number;
  evidenceCount: number;
  claimsCount: number;
  conflictsCount: number;
  errorsCount: number;
  searchQueriesRun: number;
  crawlDate: string | null;
  searchDate: string | null;
  completionTime: string | null;
  createdAt: string;
  openaiConfigured?: boolean;
}

/** Source type classification */
export type SourceType =
  | 'official' | 'official_documentation' | 'official_newsroom'
  | 'news' | 'government' | 'industry' | 'third_party';

/** Web/crawl source */
export interface ResearchSource {
  id: string;
  url: string;
  title: string;
  snippet: string;
  sourceType: SourceType;
  domain: string;
  hierarchyScore: number;
  publicationDate: string | null;
  fetchedAt: string | null;
}

/** Evidence item */
export interface ResearchEvidence {
  id: string;
  sourceId: string;
  claimType: string;
  pageTitle: string | null;
  section: string | null;
  extractedText: string;
  confidence: number;
  publicationDate: string | null;
  sourceUrl: string | null;
  sourceType: SourceType;
}

/** Claim status */
export type ClaimStatus = 'verified' | 'supported' | 'inferred' | 'conflicting' | 'rejected';

/** Validated research claim */
export interface ResearchClaim {
  id: string;
  claim: string;
  claimType: string;
  status: ClaimStatus;
  confidence: number;
  sourceUrls: string[];
  basis: 'fact' | 'observation' | 'interpretation';
}

export type DnaVerificationStatus = 'Verified' | 'Partially verified' | 'Not verified';

export interface DnaEvidenceItem {
  claim: string;
  evidence: string[];
  status: DnaVerificationStatus;
  confidence: number;
}

export interface BrandIdentityDNA {
  logo: {
    url: string | null;
    alt: string | null;
    status: DnaVerificationStatus;
    evidence: string[];
  };
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    rawPalette: { hex: string; count: number; role?: string }[];
    status: DnaVerificationStatus;
    evidence: string[];
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    allFonts: string[];
    status: DnaVerificationStatus;
    evidence: string[];
  };
  visualStyle: {
    style: string;
    density: 'compact' | 'normal' | 'generous';
    radius: number;
    status: DnaVerificationStatus;
    evidence: string[];
  };
  imageStyle: {
    treatment: string;
    detectedTypes: string[];
    sampleImages: { src: string; alt: string | null }[];
    status: DnaVerificationStatus;
    evidence: string[];
  };
}

export interface BusinessUnderstandingDNA {
  productName: string;
  tagline: string;
  summary: {
    value: string;
    status: DnaVerificationStatus;
    evidence: string[];
  };
  businessCategory: {
    primary: string;
    subcategory: string | null;
    status: DnaVerificationStatus;
    evidence: string[];
  };
  valueProposition: {
    statement: string;
    supportingPoints: string[];
    status: DnaVerificationStatus;
    evidence: string[];
  };
  productsServices: {
    name: string;
    description: string;
    status: DnaVerificationStatus;
    evidence: string[];
  }[];
  differentiators: {
    claim: string;
    status: DnaVerificationStatus;
    evidence: string[];
  }[];
}

export interface AudienceDNA {
  primaryAudience: {
    segment: string;
    status: DnaVerificationStatus;
    evidence: string[];
  };
  secondarySegments: {
    segment: string;
    status: DnaVerificationStatus;
    evidence: string[];
  }[];
  userNeeds: {
    problem: string;
    status: DnaVerificationStatus;
    evidence: string[];
  }[];
  useCases: {
    title: string;
    scenario: string;
    status: DnaVerificationStatus;
    evidence: string[];
  }[];
}

export interface BrandVoiceDNA {
  tone: {
    primary: string;
    descriptors: string[];
    status: DnaVerificationStatus;
    evidence: string[];
  };
  messagingStyle: {
    style: string;
    status: DnaVerificationStatus;
    evidence: string[];
  };
  commonTerminology: {
    terms: string[];
    status: DnaVerificationStatus;
    evidence: string[];
  };
  headlinePatterns: {
    pattern: string;
    examples: string[];
    status: DnaVerificationStatus;
    evidence: string[];
  }[];
  ctaStyle: {
    primaryAction: string;
    detectedCtas: string[];
    status: DnaVerificationStatus;
    evidence: string[];
  };
}

export interface VisualLanguageDNA {
  colors: {
    bg: string;
    surface: string;
    surfaceAlt: string;
    text: string;
    mutedText: string;
    accent: string;
    accent2: string;
    line: string;
  };
  typographyHierarchy: {
    headingFont: string;
    bodyFont: string;
    scaleRatio: number;
    status: DnaVerificationStatus;
    evidence: string[];
  };
  photographyStyle: {
    description: string;
    status: DnaVerificationStatus;
    evidence: string[];
  };
  layoutPatterns: {
    grid: string;
    cardStyle: string;
    radius: number;
    status: DnaVerificationStatus;
    evidence: string[];
  };
  uiPatterns: {
    buttons: string[];
    interactiveElements: string[];
    status: DnaVerificationStatus;
    evidence: string[];
  };
}

export interface ExperienceIntelligenceDNA {
  navigation: {
    hasHeader: boolean;
    hasNav: boolean;
    hasFooter: boolean;
    headerLinks: { text: string; url: string }[];
    footerLinks: { text: string; url: string }[];
    status: DnaVerificationStatus;
    evidence: string[];
  };
  userJourney: {
    entryPoint: string;
    coreProgression: string[];
    primaryGoal: string;
    status: DnaVerificationStatus;
    evidence: string[];
  };
  conversionFlow: {
    primaryCta: string;
    formInputsCount: number;
    status: DnaVerificationStatus;
    evidence: string[];
  };
  importantPages: {
    path: string;
    title: string;
    role: string;
    status: DnaVerificationStatus;
    evidence: string[];
  }[];
  strengths: {
    area: string;
    detail: string;
    evidence: string[];
  }[];
  frictionPoints: {
    area: string;
    detail: string;
    evidence: string[];
  }[];
}

export interface VistaraDNA {
  version: '1.0';
  generatedAt: string;
  targetUrl: string;
  host: string;
  verificationSummary: {
    overallScore: number;
    verifiedCount: number;
    partiallyVerifiedCount: number;
    notVerifiedCount: number;
    totalPagesCrawled: number;
    totalEvidencePoints: number;
  };
  brandIdentity: BrandIdentityDNA;
  businessUnderstanding: BusinessUnderstandingDNA;
  audience: AudienceDNA;
  brandVoice: BrandVoiceDNA;
  visualLanguage: VisualLanguageDNA;
  experienceIntelligence: ExperienceIntelligenceDNA;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- intentional placeholder for discriminated union extension
export interface ProjectEventKind_Dummy {}

export type ProjectEventKind =
  | 'created'
  | 'updated'
  | 'analysis_started'
  | 'analysis_complete'
  | 'analysis_failed'
  | 'generate_started'
  | 'generated'
  | 'slide_updated'
  | 'slide_created'
  | 'slide_deleted'
  | 'ai_edit';

export interface ProjectEvent {
  id: number;
  project_id: string;
  kind: ProjectEventKind;
  created_at: string;
}

// ============================================================
// EVIDENCE-BASED RESEARCH MODELS (canonical, non-duplicated)
// ============================================================

// Note: SourceType, ClaimStatus, ResearchSession are defined earlier
// in the Research Platform Types section (added for the research pipeline).
// The types below extend those with DB-column-named variants for direct DB row mapping.

export type SourceType2 = 'official' | 'official_documentation' | 'official_newsroom' | 'news' | 'government' | 'industry' | 'third_party';

export interface Source {
  id: string;
  project_id: string;
  url: string;
  title: string | null;
  snippet: string | null;
  source_type: SourceType;
  domain: string | null;
  hierarchy_score: number | null;
  publication_date: string | null;
  fetched_at: string | null;
  status: 'success' | 'error' | 'timeout' | 'forbidden';
  error_message: string | null;
  created_at: string;
}

export type ClaimType = 
  | 'company_description'
  | 'product'
  | 'service'
  | 'feature'
  | 'pricing'
  | 'audience'
  | 'industry'
  | 'market'
  | 'metric'
  | 'customer'
  | 'location'
  | 'integration'
  | 'technology'
  | 'security'
  | 'business_model'
  | 'founder'
  | 'leadership'
  | 'partnership'
  | 'news'
  | 'competitor'
  | 'differentiator'
  | 'observation'
  | 'interpretation'
  | 'other';

export type EvidenceBasis = 'fact' | 'observation' | 'interpretation';

export interface Evidence {
  id: string;
  project_id: string;
  source_id: string;
  claim_type: ClaimType;
  page_title: string | null;
  section: string | null;
  extracted_text: string;
  raw_context: string | null;
  confidence: number;
  publication_date: string | null;
  created_at: string;
}

export interface Claim {
  id: string;
  project_id: string;
  claim: string;
  value: string | null;
  claim_type: ClaimType;
  status: ClaimStatus;
  evidence_ids: string[];
  source_urls: string[];
  confidence: number;
  basis: EvidenceBasis;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  url: string;
  status: ProjectStatus;
  analysis: Analysis | null;
  audit: Audit | null;
  understanding: AnyUnderstanding | null;
  dna?: VistaraDNA | null;
  theme: DeckTheme | null;
  created_at: string;
  /** joined from project_intake when fetching a single project */
  intake?: { purpose: PresentationPurpose; design_prompt: string | null } | null;
}

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMsg {
  id: number;
  project_id: string;
  role: ChatRole;
  content: string;
  created_at: string;
}

/** Workspace-level preferences (client-persisted, applied to new studies). */
export interface StudioPrefs {
  paletteId: string;
  motion: DeckMotion;
  skin: DeckSkin;
}
