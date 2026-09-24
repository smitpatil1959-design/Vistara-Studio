/**
 * Vistara Studio — AI Presentation Quality Engine
 *
 * Automated Presentation Quality & Self-Critique Engine.
 * Analyzes content, layout, typography, visuals, brand, and story progression.
 * Executes bounded auto-repair loops to guarantee collision-free,
 * rhythmically varied, professionally art-directed 16:9 presentations.
 */

import { CANVAS, estimateTextHeight, isWithinSafeArea, validateSlideLayout, repairSlideSpatialCollision } from './layoutEngine.js';
import { contrastRatio, hexToHsl } from './engine.js';


export const AUDIT_METRICS_BLACKLIST = [
  'audit score',
  'pages analyzed',
  'response time',
  'document weight',
  'document size',
  'first response',
  'composite audit',
  'measured audit',
  'measured lcp',
  'pages in production',
  'pages shipped',
  'pages in the experience',
  'verified stack signals',
  'measured response',
  'health today',
  'health score',
  'lcp (live render)',
  'http status',
  'crawl statistics',
  'link health',
  'security score',
  'internal analysis',
];

const AUDIT_METRICS_REGEX = new RegExp(`\\b(${AUDIT_METRICS_BLACKLIST.join('|')})\\b`, 'i');

/**
 * Evaluates quality metrics for an individual slide.
 */
export function analyzeSlideQuality(slide, designSystem = null, deckContext = {}) {
  const issues = [];
  const strengths = [];

  let contentScore = 100;
  let layoutScore = 100;
  let typographyScore = 100;
  let visualScore = 100;
  let brandScore = 100;
  let readabilityScore = 100;

  const title = (slide.title || '').replace(/\*/g, '').trim();
  const subtitle = (slide.subtitle || '').trim();
  const body = (slide.body || '').trim();
  const bullets = Array.isArray(slide.bullets) ? slide.bullets : [];
  const stats = Array.isArray(slide.stats) ? slide.stats : [];

  // 1. CONTENT ANALYSIS
  if (!title) {
    issues.push({ dimension: 'content', severity: 'critical', message: 'Missing slide title.' });
    contentScore -= 40;
  } else if (title.length > 70) {
    issues.push({ dimension: 'content', severity: 'medium', message: 'Title exceeds optimal length (max 65 chars).' });
    contentScore -= 15;
  } else {
    strengths.push('Concise, punchy headline');
  }

  if (body.length > 200) {
    issues.push({ dimension: 'content', severity: 'medium', message: 'Body text is too verbose for presentation canvas.' });
    contentScore -= 15;
    readabilityScore -= 15;
  }

  // Audit telemetry check (strictly prohibited on presentation slides)
  const fullText = `${title} ${subtitle} ${body} ${bullets.join(' ')} ${stats.map((s) => `${s.value} ${s.label}`).join(' ')}`;
  if (AUDIT_METRICS_REGEX.test(fullText)) {
    issues.push({ dimension: 'content', severity: 'critical', message: 'Slide contains prohibited technical audit telemetry.' });
    contentScore -= 50;
  }

  // Robotic marker check
  if (/^(Goal —|Tone —|Language —|Category:)/i.test(fullText)) {
    issues.push({ dimension: 'content', severity: 'low', message: 'Slide contains raw metadata prefixes.' });
    contentScore -= 10;
  }

  // 2. LAYOUT & SPATIAL COLLISION ANALYSIS
  const spatial = validateSlideLayout(slide);
  if (!spatial.valid) {
    layoutScore -= 30;
    spatial.issues.forEach((iss) => {
      issues.push({ dimension: 'layout', severity: 'high', message: iss.message });
    });
  } else {
    strengths.push('16:9 safe area adherence and zero bounding box collisions');
  }

  // Density budget
  const totalItems = bullets.length + stats.length;
  if (totalItems > 8) {
    issues.push({ dimension: 'layout', severity: 'medium', message: 'Excessive item density on slide.' });
    layoutScore -= 20;
    readabilityScore -= 20;
  }

  // 3. TYPOGRAPHY & CONTRAST ANALYSIS
  if (designSystem) {
    const bg = designSystem.bg || (designSystem.skin === 'dark' ? '#080E0B' : '#FFFFFF');
    const text = designSystem.text || (designSystem.skin === 'dark' ? '#F0FDF4' : '#111827');
    const accent = designSystem.accent || '#10B981';

    const contrast = contrastRatio(bg, text);
    if (contrast < 4.5) {
      issues.push({ dimension: 'typography', severity: 'high', message: `Low text contrast ratio (${contrast.toFixed(2)}:1, min 4.5:1 required).` });
      typographyScore -= 25;
      readabilityScore -= 25;
    }

    const accentContrast = contrastRatio(bg, accent);
    if (accentContrast < 3.0) {
      issues.push({ dimension: 'brand', severity: 'medium', message: `Accent color has low contrast (${accentContrast.toFixed(2)}:1).` });
      brandScore -= 15;
    }

  }

  // 4. VISUAL RELEVANCE & INTEGRITY
  if (slide.image_url) {
    if (slide.visualDecision) {
      strengths.push(`Curated visual: ${slide.visualDecision.reason || 'Attributed editorial photo'}`);
    }
    if (slide.layout !== 'split' && slide.layout !== 'hero' && slide.type !== 'hero') {
      issues.push({ dimension: 'visual', severity: 'low', message: 'Image present on non-split layout.' });
      visualScore -= 10;
    }
  }

  contentScore = Math.max(0, Math.min(100, contentScore));
  layoutScore = Math.max(0, Math.min(100, layoutScore));
  typographyScore = Math.max(0, Math.min(100, typographyScore));
  visualScore = Math.max(0, Math.min(100, visualScore));
  brandScore = Math.max(0, Math.min(100, brandScore));
  readabilityScore = Math.max(0, Math.min(100, readabilityScore));

  const overallScore = Math.round(
    contentScore * 0.25 +
    layoutScore * 0.25 +
    readabilityScore * 0.2 +
    typographyScore * 0.15 +
    brandScore * 0.15
  );

  return {
    slideId: slide.id,
    type: slide.type,
    scores: {
      content: contentScore,
      layout: layoutScore,
      typography: typographyScore,
      visual: visualScore,
      brand: brandScore,
      readability: readabilityScore,
      overall: overallScore,
    },
    passed: overallScore >= 80 && !issues.some((i) => i.severity === 'critical'),
    issues,
    strengths,
  };
}

/**
 * Evaluates quality and visual rhythm across the entire presentation deck.
 */
export function analyzeDeckQuality(slides, project = null, designSystem = null) {
  if (!Array.isArray(slides) || slides.length === 0) {
    return {
      passed: false,
      overallScore: 0,
      scores: { content: 0, layout: 0, visual: 0, brand: 0, story: 0, readability: 0 },
      issues: [{ dimension: 'deck', severity: 'critical', message: 'Deck contains no slides.' }],
      rhythm: { varietyScore: 0, repetitivePatterns: [] },
      story: { hasNarrativeArc: false, missingCoreQuestions: [] },
    };
  }

  const slideResults = slides.map((s, idx) =>
    analyzeSlideQuality(s, designSystem, { index: idx, total: slides.length })
  );

  const issues = [];
  const strengths = [];

  // 1. VISUAL RHYTHM & REPETITIVE PATTERN DETECTION
  const layoutSequence = slides.map((s) => s.layout || 'left');
  const repetitivePatterns = [];
  for (let i = 0; i < layoutSequence.length - 2; i++) {
    if (layoutSequence[i] === layoutSequence[i + 1] && layoutSequence[i] === layoutSequence[i + 2]) {
      repetitivePatterns.push({
        layout: layoutSequence[i],
        startIndex: i,
        endIndex: i + 2,
        message: `Monotonous layout rhythm: 3 consecutive ${layoutSequence[i]} slides.`,
      });
      issues.push({
        dimension: 'rhythm',
        severity: 'medium',
        message: `Monotonous layout sequence (${layoutSequence[i]}) from slide ${i + 1} to ${i + 3}.`,
      });
    }
  }

  const uniqueLayouts = new Set(layoutSequence);
  const layoutVarietyScore = Math.min(100, Math.round((uniqueLayouts.size / 3) * 100));

  // 2. STORYTELLING PROGRESSION CHECK
  const types = slides.map((s) => s.type);
  const storyChecks = {
    hasIntroduction: types.some((t) => ['hero', 'intro', 'company'].includes(t)),
    hasProblem: types.includes('problem'),
    hasSolution: types.some((t) => ['solution', 'features', 'howItWorks'].includes(t)),
    hasBenefitsOrImpact: types.some((t) => ['benefits', 'impact', 'businessValue', 'valueProposition', 'differentiation', 'trust'].includes(t)),
    hasClosing: types.some((t) => ['cta', 'closing', 'future', 'growth', 'conclusion', 'opportunities'].includes(t)),
  };

  const missingStoryElements = [];
  if (!storyChecks.hasIntroduction) missingStoryElements.push('What is this (Hero/Intro)');
  if (!storyChecks.hasProblem) missingStoryElements.push('Why it matters / The problem');
  if (!storyChecks.hasSolution) missingStoryElements.push('What is the solution');
  if (!storyChecks.hasBenefitsOrImpact) missingStoryElements.push('Measurable proof / Benefits');
  if (!storyChecks.hasClosing) missingStoryElements.push('Call to action / Next steps');

  let storyScore = 100 - missingStoryElements.length * 15;
  if (missingStoryElements.length > 0) {
    issues.push({
      dimension: 'story',
      severity: 'low',
      message: `Story arc could be strengthened with: ${missingStoryElements.join(', ')}`,
    });
  } else {
    strengths.push('Comprehensive narrative arc covering problem, solution, proof and next steps');
  }

  // 3. INFORMATION DEDUPLICATION CHECK
  const seenHeadlines = new Set();
  slides.forEach((s, idx) => {
    const cleanTitle = (s.title || '').replace(/\*/g, '').toLowerCase().trim();
    if (cleanTitle) {
      if (seenHeadlines.has(cleanTitle)) {
        issues.push({
          dimension: 'content',
          severity: 'medium',
          message: `Duplicate headline “${s.title}” on slide ${idx + 1}.`,
        });
      }
      seenHeadlines.add(cleanTitle);
    }
  });

  // Calculate aggregated dimension scores
  const avgContent = Math.round(slideResults.reduce((acc, r) => acc + r.scores.content, 0) / slides.length);
  const avgLayout = Math.round(slideResults.reduce((acc, r) => acc + r.scores.layout, 0) / slides.length);
  const avgTypography = Math.round(slideResults.reduce((acc, r) => acc + r.scores.typography, 0) / slides.length);
  const avgVisual = Math.round(slideResults.reduce((acc, r) => acc + r.scores.visual, 0) / slides.length);
  const avgBrand = Math.round(slideResults.reduce((acc, r) => acc + r.scores.brand, 0) / slides.length);
  const avgReadability = Math.round(slideResults.reduce((acc, r) => acc + r.scores.readability, 0) / slides.length);

  const overallScore = Math.round(
    avgContent * 0.22 +
    avgLayout * 0.22 +
    storyScore * 0.20 +
    avgReadability * 0.16 +
    avgBrand * 0.10 +
    layoutVarietyScore * 0.10
  );

  return {
    passed: overallScore >= 85 && !slideResults.some((r) => r.issues.some((i) => i.severity === 'critical')),
    overallScore,
    scores: {
      content: avgContent,
      layout: avgLayout,
      typography: avgTypography,
      visual: avgVisual,
      brand: avgBrand,
      story: storyScore,
      readability: avgReadability,
      variety: layoutVarietyScore,
    },
    slideResults,
    issues: [...issues, ...slideResults.flatMap((r) => r.issues)],
    strengths,
    rhythm: {
      varietyScore: layoutVarietyScore,
      repetitivePatterns,
      sequence: layoutSequence,
    },
    story: {
      hasNarrativeArc: missingStoryElements.length <= 1,
      missingCoreQuestions: missingStoryElements,
    },
  };
}

/**
 * Multi-pass bounded AI Self-Critique & Auto-Repair Engine.
 * Generates, critiques, reflows, repairs, and re-validates the presentation.
 */
export function critiqueAndRepairDeck(slidesIn, designSystem = null, project = null, maxPasses = 3) {
  let slides = [...slidesIn];
  const improvements = [];

  for (let pass = 1; pass <= maxPasses; pass++) {
    const analysis = analyzeDeckQuality(slides, project, designSystem);

    // If deck meets elite quality criteria with 0 critical issues, finalize
    if (analysis.passed && analysis.overallScore >= 92 && analysis.rhythm.repetitivePatterns.length === 0) {
      break;
    }

    const seenTitles = new Set();
    const nextSlides = slides.map((s, i) => {
      let candidate = repairSlideSpatialCollision(s);

      // 1. Auto-Repair Content & Purge Telemetry
      let title = (candidate.title || '').trim();
      let subtitle = (candidate.subtitle || '').trim();
      let body = (candidate.body || '').trim();
      let bullets = Array.isArray(candidate.bullets) ? [...candidate.bullets] : [];
      let stats = Array.isArray(candidate.stats) ? [...candidate.stats] : [];

      // Purge any blacklist telemetry
      stats = stats.filter((st) => !AUDIT_METRICS_REGEX.test(st.label || '') && !AUDIT_METRICS_REGEX.test(st.value || ''));

      // Remove robotic prefixes
      bullets = bullets.map((b) => {
        let bStr = String(b)
          .replace(/^Goal —\s*/i, 'Mission — ')
          .replace(/^Tone —\s*/i, 'Design Voice — ')
          .replace(/^Language —\s*/i, 'Locale — ');
        return bStr;
      });

      // Deduplicate headlines
      const cleanTitleKey = title.toLowerCase().replace(/\*/g, '').trim();
      if (seenTitles.has(cleanTitleKey)) {
        title = `${title} (Cont.)`;
        improvements.push(`Deduplicated headline on slide ${i + 1}`);
      }
      seenTitles.add(cleanTitleKey);


      // 2. Auto-Repair Visual Rhythm & Break Repetitive Layouts
      let layout = candidate.layout || 'left';
      if (i >= 2 && layout === slides[i - 1]?.layout && layout === slides[i - 2]?.layout) {
        const altLayout = layout === 'grid' ? 'split' : layout === 'split' ? 'center' : 'grid';
        improvements.push(`Reflowed slide ${i + 1} layout from ${layout} to ${altLayout} for rhythmic visual variety`);
        layout = altLayout;
      }

      // 3. Auto-Repair Spatial Bounds
      const spatial = validateSlideLayout({ ...candidate, title, subtitle, body, bullets, stats, layout });
      if (!spatial.valid) {
        subtitle = subtitle.slice(0, 85).replace(/\s\S*$/, '') + (subtitle.length > 85 ? '…' : '');
        body = body.slice(0, 135).replace(/\s\S*$/, '') + (body.length > 135 ? '…' : '');
        bullets = bullets.slice(0, 4);
        improvements.push(`Tightened typography on slide ${i + 1} to fit 16:9 safe canvas bounds`);
      }

      return {
        ...candidate,
        sort_order: (i + 1) * 10,
        title,
        subtitle,
        body,
        bullets,
        stats,
        layout,
        animation: candidate.animation || 'fade',
      };
    });

    slides = nextSlides;
  }

  // Final verification pass
  const finalAnalysis = analyzeDeckQuality(slides, project, designSystem);

  return {
    slides,
    quality: finalAnalysis,
    summary: {
      passed: finalAnalysis.passed,
      score: finalAnalysis.overallScore,
      contentQuality: finalAnalysis.scores.content,
      layoutQuality: finalAnalysis.scores.layout,
      brandQuality: finalAnalysis.scores.brand,
      storyQuality: finalAnalysis.scores.story,
      readability: finalAnalysis.scores.readability,
      improvements: [...new Set(improvements)],
    },
  };
}
