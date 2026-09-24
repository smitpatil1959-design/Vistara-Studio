/**
 * Vistara Studio — Extraction Quality Gatekeeper
 *
 * Dedicated extraction-quality layer that runs BEFORE claims reach presentation planning.
 * Intercepts and filters:
 *   - Navigation labels & menu fragments ("Home", "About Us", "Sign In", "Menu")
 *   - Isolated numbers and fragments ("6, envoy", "1 food delivery", "Step 1", "01")
 *   - Cookie / privacy notices & tracking boilerplate
 *   - Footer fragments & copyright notices ("© 2024 All rights reserved")
 *   - Broken HTML extraction & unbalanced entities
 *   - Accessibility fragments ("Skip to content", "aria-label")
 *   - Incomplete sentences and meaningless word/number combinations
 *   - Strings that are lists of proper nouns without a predicate (navigation lists, not claims)
 *
 * Domain-agnostic: Works universally across arbitrary websites.
 */

// Common navigation, UI chrome, and utility labels
const UI_CHROME_PATTERNS = [
  /^(home|menu|navigation|nav|header|footer|sidebar|breadcrumb)$/i,
  /^(sign in|log in|login|sign up|signup|register|logout|log out|my account|profile)$/i,
  /^(privacy policy|terms of service|terms & conditions|cookie policy|cookie settings|manage cookies|cookie preferences)$/i,
  /^(all rights reserved|copyright|©|\(c\)|legal notices|disclaimer)$/i,
  /^(skip to (?:main )?content|skip navigation|accessibility|screen reader)$/i,
  /^(click here|read more|learn more|see more|view more|explore more|continue reading|find out more)$/i,
  /^(search|search here|type to search|submit|filter|sort by|results|close|open|toggle)$/i,
  /^(cart|checkout|shopping bag|items? in cart|view cart|empty cart)$/i,
  /^(subscribe|newsletter|join our mailing list|enter your email|stay updated)$/i,
  /^(contact us|get in touch|reach out|send message|office locations?)$/i,
  /^(follow us|share this|facebook|twitter|linkedin|instagram|youtube|github|discord|tiktok|pinterest)$/i,
  /^(page \d+|next page|previous page|back to top|load more)$/i,
  /^(download app|get the app|app store|google play|available on)$/i,
  /^(accept|accept all|reject|reject all|allow|deny|agree|disagree)$/i,
  /^(powered by|built with|made with|created by)(\s+\w+){0,3}$/i,
];

// Meaningless fragments like "6, envoy", "1 food delivery", "4.5 (120)", "step 2"
const FRAGMENT_PATTERNS = [
  /^\d+\s*,\s*[a-z0-9_-]+$/i,               // e.g. "6, envoy"
  /^\d+\s+[a-z]{1,5}$/i,                     // e.g. "1 car", "2 box", "3 day"
  /^\d+\s+(?:food|delivery|ride|taxi|order|trip|step|item|result|review|star|rating|vote|like|share|comment|view|click|visit|user|customer|product|service|page|post|tag|category)s?$/i,
  /^(?:step|part|item|option|tab|section|chapter|lesson|module|unit|phase|stage)\s+\d+$/i,
  /^[[\d.,\s/%$€£¥+-]+$/,                    // only numbers/symbols without context
  /^[a-z0-9_-]+:[a-z0-9_-]+$/i,             // technical slugs like "hero:banner"
  /^\s*[\(\[\{]\s*\d+\s*[\)\]\}]\s*$/,       // isolated "(12)"
  /^v?\d+(\.\d+)+$/i,                        // version numbers alone like "1.0.4"
  /^\d+\s*(?:hrs?|mins?|secs?|days?|weeks?|months?|years?)\s*(?:ago)?$/i, // "2 days ago"
  /^\d+\s*(?:of)\s*\d+$/i,                   // "1 of 10"
  /^(?:from|by|at|in|on|to|for|with|and|or|the|a|an)\s+\w+$/i, // preposition + one word
  /^(?:\w+\s+){0,2}(?:loading|fetching|processing|please wait|updated|refresh)\.?$/i,
];

// Clickbait, tabloid headlines, and third-party review gossip
const CLICKBAIT_OR_GOSSIP_PATTERNS = [
  /\b(priced less than the iphone|top 10|top 5|watch video|photos?:|images?:|exclusive review|first drive review|spy shots|unveiled|facelift launched|leak revealed|rumors?|deal of the day)\b/i,
  /\b(you won'?t believe|shocking truth|must see|going viral|breaks the internet|click here to)\b/i,
  /\b(check out|don'?t miss|limited time offer|act now|buy now for)\b/i,
];

// Navigation-list patterns: comma-or-pipe separated proper nouns with no verb
// These are menu extractions, not sentences. e.g. "Electronics · Clothing · Sports · Home"
const NAV_LIST_PATTERNS = [
  /^[A-Z][a-zA-Z\s]+(?:\s*[·|,/]\s*[A-Z][a-zA-Z\s]+){2,}$/, // "Electronics · Clothing · Sports"
  /^(?:[A-Z][a-zA-Z]+\s*){1,3}(?:\s*\|\s*(?:[A-Z][a-zA-Z]+\s*){1,3}){2,}$/, // "A B | C D | E F"
];

// Technical artifact patterns (code / framework artifacts that slip through)
const TECHNICAL_ARTIFACT_PATTERNS = [
  /\b(var\s+|function\(|webpackJsonp|window\.__|\bdocument\.|addEventListener|querySelector|innerHTML|appendChild)\b/,
  /\b(__webpack|exports\.|module\.exports|require\(|import\s+{)\b/,
  /^\s*\{[\s\S]{0,200}\}\s*$/,              // JSON-like blobs
  /data-[a-z-]+="[^"]{0,60}"/,              // HTML data attributes
  /\b(aria-label|role="[a-z]+"|tabindex=)/i,
];

/**
 * Normalizes raw extracted text:
 * - Decodes simple entities
 * - Strips tags
 * - Collapses whitespace
 *
 * @param {string} text
 * @returns {string}
 */
export function cleanExtractedText(text) {
  if (typeof text !== 'string') return '';

  return text
    .replace(/<[^>]+>/g, ' ')       // Strip HTML tags
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Evaluates whether extracted text is a meaningless fragment, UI label, or crawler junk.
 *
 * @param {string} rawText
 * @returns {boolean} True if garbage/fragment, false if meaningful content
 */
export function isGarbageOrFragment(rawText) {
  const text = cleanExtractedText(rawText);
  if (!text) return true;

  // Too short to contain a meaningful insight or fact
  if (text.length < 12) return true;

  // Overly long unformatted dumps (often raw code or minified JSON)
  if (text.length > 900) return true;

  // Check UI chrome patterns
  for (const pattern of UI_CHROME_PATTERNS) {
    if (pattern.test(text)) return true;
  }

  // Check fragment patterns
  for (const pattern of FRAGMENT_PATTERNS) {
    if (pattern.test(text)) return true;
  }

  // Check clickbait gossip
  for (const pattern of CLICKBAIT_OR_GOSSIP_PATTERNS) {
    if (pattern.test(text)) return true;
  }

  // Check navigation list patterns
  for (const pattern of NAV_LIST_PATTERNS) {
    if (pattern.test(text)) return true;
  }

  // Check technical artifacts
  for (const pattern of TECHNICAL_ARTIFACT_PATTERNS) {
    if (pattern.test(text)) return true;
  }

  // Check if string is predominantly punctuation or numbers
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 8) return true;

  const letterRatio = letters.length / text.length;
  if (letterRatio < 0.45 && text.length < 50) return true;

  // Check word count: meaningful claims usually have at least 4 distinct words
  const words = text.split(/\s+/).filter((w) => w.length > 1);
  if (words.length < 4) return true;

  // Repetitive word stutter e.g. "Cars cars cars cars"
  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
  if (words.length >= 6 && uniqueWords.size <= 2) return true;

  // Trailing or leading garbage symbols
  if (/^[,\.;:\-_/|\\]/.test(text) && text.length < 25) return true;

  // Sentence structure check: a meaningful claim usually contains at least one verb-like word
  // (heuristic: ends with punctuation, or contains a common verb form)
  const hasVerbStructure =
    /[.!?]$/.test(text) ||                                    // ends with sentence punctuation
    /\b(is|are|was|were|has|have|had|does|do|did|can|will|would|should|may|might|must|offers?|provides?|enables?|delivers?|helps?|builds?|creates?|connects?|serves?|supports?|includes?|allows?|gives?|makes?|uses?|runs?)\b/i.test(text);

  // Short texts (< 60 chars) without verb structure are likely labels
  if (text.length < 60 && !hasVerbStructure && !/\d/.test(text)) return true;

  return false;
}

/**
 * Validates whether candidate content is high-quality evidence suitable for presentation planning.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function isHighQualityContent(text) {
  return !isGarbageOrFragment(text);
}

/**
 * Filter a list of candidate items (evidence or claims) removing low-quality noise.
 *
 * @param {Array} items
 * @param {Function} [textExtractor] - Function to get text from item (defaults to (item) => item.text || item.claim)
 * @returns {Array} High quality items only
 */
export function filterHighQualityItems(items, textExtractor) {
  if (!Array.isArray(items)) return [];

  const extract = textExtractor || ((item) => {
    if (typeof item === 'string') return item;
    return item?.claim || item?.extracted_text || item?.text || '';
  });

  return items.filter((item) => {
    const txt = extract(item);
    return isHighQualityContent(txt);
  });
}
