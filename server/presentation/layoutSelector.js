/**
 * Vistara Studio — Presentation Layout Selector v2
 *
 * Selects the optimal visual layout for each slide based on its COMMUNICATION INTENT,
 * not merely its content quantity (bullet count, stat count).
 *
 * Pipeline:
 *   content + topicKey + topicRole → communication intent → layout
 *
 * Enforces visual rhythm: no more than 2 consecutive slides with the same layout.
 *
 * v2 improvements:
 *   - Intent-based selection driven by topicKey + topicRole + content signals
 *   - 9 layout types (added: large_metric, editorial, quote, two_column, timeline)
 *   - Purpose context influences intent (investor → metrics get large_metric even with 2 stats)
 *   - Rhythm enforcement extended to all 9 types
 */

const LAYOUT_TYPES = [
  'grid',         // 3-4 feature cards in a horizontal row
  'split',        // 50/50 visual + text
  'center',       // centered hero statement, metrics, or summary
  'left',         // text-heavy left-aligned
  'two_column',   // 2 equal columns (comparison / before-after)
  'large_metric', // 1-3 large numbers as primary focal point
  'editorial',    // full-bleed prose statement, magazine style
  'quote',        // single prominent statement or pull quote
  'timeline',     // sequential steps or process flow
];

/**
 * Communication intent → layout mapping.
 * Intent is derived from topicKey + topicRole + content signals.
 */
const INTENT_LAYOUT_MAP = {
  // Identity / introduction
  'establish_identity':   'center',      // hero without image
  'establish_identity_with_image': 'split', // hero with screenshot
  // Scale / credibility via numbers
  'establish_scale':      'large_metric',
  'establish_credibility':'large_metric',
  // Synthesize and close
  'synthesize':           'center',
  // Frame a problem or opportunity
  'frame_context':        'editorial',
  'frame_problem':        'editorial',
  // Show a singular vision or statement
  'singular_insight':     'editorial',
  'singular_vision':      'quote',
  // Showcase product capabilities in parallel
  'showcase_parallel':    'grid',
  // Compare / contrast two items
  'compare_contrast':     'two_column',
  // Walk through a process
  'sequential_process':   'timeline',
  // Explain what something does (single narrative thread)
  'explain_purpose':      'split',
  // Serve an audience / use cases
  'explain_audience':     'split',
  // Show ecosystem / partnerships (multiple parallel items)
  'showcase_ecosystem':   'grid',
  // Show competitive differentiation
  'show_differentiation': 'split',
  // Technical depth / infrastructure
  'technical_depth':      'grid',
  // Pricing tiers
  'show_pricing':         'grid',
};

/**
 * Derive communication intent from slide metadata + content.
 */
function deriveCommunicationIntent(slide) {
  const topicKey   = slide.topicKey   || '';
  const topicRole  = slide.topicRole  || slide.purpose || '';
  const layout     = slide.layout;    // hint from storyPlanner
  const bullets    = Array.isArray(slide.bullets) ? slide.bullets : [];
  const stats      = Array.isArray(slide.stats)   ? slide.stats   : [];
  const hasImage   = Boolean(slide.image_url);
  const subtitleLen = (slide.subtitle || '').length;
  const bodyLen    = (slide.body || '').length;

  // ── Fixed-intent topics ───────────────────────────────────────────────────

  if (topicKey === 'hero') {
    return hasImage ? 'establish_identity_with_image' : 'establish_identity';
  }

  if (topicKey === 'closing') return 'synthesize';

  if (topicKey === 'metrics') {
    // Metrics with many stats → scale; with fewer → still credibility
    return stats.length >= 2 ? 'establish_scale' : 'establish_credibility';
  }

  if (topicKey === 'context') {
    // Context with a long text body → editorial framing
    return (subtitleLen > 80 || bodyLen > 80) ? 'frame_context' : 'explain_purpose';
  }

  if (topicKey === 'core_purpose') return 'explain_purpose';

  if (topicKey === 'differentiators') return 'show_differentiation';

  if (topicKey === 'audience')     return 'explain_audience';
  if (topicKey === 'technology')   return bullets.length >= 3 ? 'technical_depth' : 'explain_purpose';
  if (topicKey === 'ecosystem')    return 'showcase_ecosystem';
  if (topicKey === 'pricing')      return 'show_pricing';

  if (topicKey === 'offerings') {
    // 3+ items → parallel grid; 2 items → side-by-side comparison; 1 → explain
    if (bullets.length >= 3) return 'showcase_parallel';
    if (bullets.length === 2) return 'compare_contrast';
    return 'explain_purpose';
  }

  if (topicKey === 'capabilities') {
    if (bullets.length >= 3) return 'showcase_parallel';
    if (bullets.length === 2) return 'compare_contrast';
    return 'explain_purpose';
  }

  // ── Role-based signals ────────────────────────────────────────────────────

  if (/opening/.test(topicRole)) return hasImage ? 'establish_identity_with_image' : 'establish_identity';
  if (/closing|summary/.test(topicRole)) return 'synthesize';
  if (/metrics|scale/.test(topicRole))   return stats.length >= 2 ? 'establish_scale' : 'establish_credibility';
  if (/differentiation/.test(topicRole)) return 'show_differentiation';
  if (/ecosystem/.test(topicRole))       return 'showcase_ecosystem';
  if (/technology/.test(topicRole))      return bullets.length >= 3 ? 'technical_depth' : 'explain_purpose';

  // ── Content-signal fallbacks ──────────────────────────────────────────────

  if (stats.length >= 3 && bullets.length <= 1) return 'establish_scale';
  if (bullets.length >= 3) return 'showcase_parallel';
  if (bullets.length === 2) return 'compare_contrast';
  if (bullets.length === 1 && (bullets[0] || '').length > 80) return 'singular_insight';

  // Default: explain with split
  return 'explain_purpose';
}

/**
 * Optimizes layouts across a slide deck.
 * @param {Array} slides
 * @returns {Array}
 */
export function optimizeDeckLayouts(slides) {
  if (!Array.isArray(slides) || slides.length === 0) return slides;

  const result = [];

  for (let i = 0; i < slides.length; i++) {
    const s = { ...slides[i] };
    const prevLayout     = result[i - 1]?.layout || null;
    const prevPrevLayout = result[i - 2]?.layout || null;

    // Derive intent → layout
    const intent = deriveCommunicationIntent(s);
    let chosenLayout = INTENT_LAYOUT_MAP[intent] || 'split';

    // Enforce visual rhythm: no 3 consecutive identical layouts
    // (Allow consecutive centers only for hero+closing pair)
    if (
      chosenLayout === prevLayout &&
      chosenLayout === prevPrevLayout &&
      chosenLayout !== 'center'
    ) {
      chosenLayout = alternateLayout(chosenLayout, s);
    }

    // Specific guard: grid must have bullets; fallback to split if not
    if (chosenLayout === 'grid' && (!Array.isArray(s.bullets) || s.bullets.length === 0)) {
      chosenLayout = 'split';
    }
    // large_metric must have stats; fallback to center
    if (chosenLayout === 'large_metric' && (!Array.isArray(s.stats) || s.stats.length === 0)) {
      chosenLayout = 'center';
    }

    s.layout = chosenLayout;
    result.push(s);
  }

  return result;
}

function alternateLayout(current, slide) {
  const bullets = Array.isArray(slide.bullets) ? slide.bullets : [];
  const stats   = Array.isArray(slide.stats)   ? slide.stats   : [];

  if (current === 'split') {
    if (bullets.length >= 3) return 'grid';
    if (stats.length >= 2)   return 'large_metric';
    return 'editorial';
  }
  if (current === 'grid') {
    if (stats.length >= 2) return 'large_metric';
    return 'split';
  }
  if (current === 'center' || current === 'large_metric') {
    return bullets.length >= 3 ? 'grid' : 'split';
  }
  if (current === 'editorial') {
    return bullets.length >= 2 ? 'grid' : 'split';
  }
  if (current === 'two_column') return 'split';
  if (current === 'timeline')   return 'grid';

  // Fallback cycle (exclude quote/timeline to keep them rare/intentional)
  const cycle = ['split', 'grid', 'center', 'editorial', 'left'].filter((l) => l !== current);
  return cycle[0] || 'split';
}
