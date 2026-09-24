/**
 * React Safety Utilities
 *
 * Prevents crashes from malformed data.
 * Ensures all values are JSON-serializable before rendering.
 *
 * Problem:
 * "Objects are not valid as a React child"
 * Caused by: { object }, arrays of objects, React components, etc.
 *
 * Solution:
 * - Safe render wrappers for all slide content
 * - JSON validation before storage
 * - Type guards for slide properties
 * - Error boundaries to catch failures
 */

/**
 * Safely render any value to string
 * @param {*} value - Any value to render
 * @param {string} fallback - Fallback text if value is invalid
 * @returns {string} Safe string representation
 */
export function safeRender(value: unknown, fallback: string = '—'): string {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return fallback;
  }

  // Handle booleans
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  // Handle numbers
  if (typeof value === 'number') {
    return String(value);
  }

  // Handle strings
  if (typeof value === 'string') {
    return value.trim() || fallback;
  }

  // Handle arrays - render first string value or fallback
  if (Array.isArray(value)) {
    if (value.length === 0) return fallback;
    const first = value.find((v: unknown) => typeof v === 'string');
    return first ? String(first) : fallback;
  }

  // Handle objects - DON'T render directly
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Try to get a sensible string property
    if (obj.text) return String(obj.text);
    if (obj.title) return String(obj.title);
    if (obj.label) return String(obj.label);
    if (obj.name) return String(obj.name);
    // Object can't be rendered
    return fallback;
  }

  // Fallback for other types
  return fallback;
}

/**
 * Safely render slide title
 * @param {string|null} title - Slide title
 * @returns {string} Safe title
 */
export function renderSlideTitle(title: string | null): string {
  const safe = safeRender(title, 'Untitled Slide');
  return safe.substring(0, 200); // Cap length
}

/**
 * Safely render slide subtitle
 * @param {string|null} subtitle - Slide subtitle
 * @returns {string} Safe subtitle
 */
export function renderSlideSubtitle(subtitle: string | null): string {
  const safe = safeRender(subtitle, '');
  return safe.substring(0, 500);
}

/**
 * Safely render slide body text
 * @param {string|null} body - Slide body
 * @returns {string} Safe body text
 */
export function renderSlideBody(body: string | null): string {
  const safe = safeRender(body, '');
  return safe.substring(0, 2000);
}

/**
 * Safely render slide bullets
 * @param {Array|null} bullets - Array of bullet points
 * @returns {Array<string>} Safe bullet array
 */
export function renderSlideBullets(bullets: unknown): string[] {
  if (!Array.isArray(bullets)) {
    return [];
  }

  return bullets
    .map((b: unknown) => safeRender(b, ''))
    .filter((b: string) => b.length > 0)
    .slice(0, 10) // Max 10 bullets
    .map((b: string) => b.substring(0, 500)); // Cap bullet length
}

/**
 * Safely render slide stats
 * @param {Array|null} stats - Array of { value, label }
 * @returns {Array<Object>} Safe stats array
 */
export function renderSlideStats(
  stats: unknown
): Array<{ value: string; label: string }> {
  if (!Array.isArray(stats)) {
    return [];
  }

  return stats
    .map((stat: unknown) => {
      if (!stat || typeof stat !== 'object') {
        return null;
      }
      const s = stat as Record<string, unknown>;
      return {
        value: safeRender(s.value, '0'),
        label: safeRender(s.label, 'Metric')
      };
    })
    .filter((s: unknown): s is { value: string; label: string } => s !== null)
    .slice(0, 6); // Max 6 stats
}

/**
 * Validate slide data before rendering
 * @param {Object} slide - Slide object
 * @returns {Object} Validated slide with safe values
 */
export function validateSlideData(slide: unknown): Record<string, unknown> {
  if (!slide || typeof slide !== 'object') {
    return {
      id: 'unknown',
      title: 'Invalid Slide',
      subtitle: '',
      body: 'Unable to render this slide.',
      bullets: [],
      stats: [],
      image_url: null,
      layout: 'center',
      animation: 'fade'
    };
  }

  const s = slide as Record<string, unknown>;

  return {
    id: s.id || 'unknown',
    title: renderSlideTitle(s.title as string | null),
    subtitle: renderSlideSubtitle(s.subtitle as string | null),
    body: renderSlideBody(s.body as string | null),
    bullets: renderSlideBullets(s.bullets),
    stats: renderSlideStats(s.stats),
    image_url: validateImageUrl(s.image_url as string | null),
    layout: validateLayout(s.layout as string | null),
    animation: validateAnimation(s.animation as string | null),
    theme_override: validateThemeOverride(s.theme_override)
  };
}

/**
 * Validate image URL
 * @param {string|null} url - Image URL
 * @returns {string|null} Valid URL or null
 */
export function validateImageUrl(url: string | null): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();
  if (
    !trimmed.startsWith('http://') &&
    !trimmed.startsWith('https://') &&
    !trimmed.startsWith('data:')
  ) {
    return null;
  }

  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return null;
  }
}

/**
 * Validate layout type
 * @param {string|null} layout - Layout name
 * @returns {string} Valid layout or 'center'
 */
export function validateLayout(layout: string | null): string {
  const valid = ['left', 'center', 'split', 'grid', 'fullscreen'];
  return valid.includes(layout as string) ? (layout as string) : 'center';
}

/**
 * Validate animation type
 * @param {string|null} animation - Animation name
 * @returns {string} Valid animation or 'fade'
 */
export function validateAnimation(animation: string | null): string {
  const valid = ['fade', 'stagger', 'slide', 'zoom', 'none'];
  return valid.includes(animation as string) ? (animation as string) : 'fade';
}

/**
 * Validate theme override object
 * @param {Object|null} theme - Theme object
 * @returns {Object|null} Validated theme or null
 */
export function validateThemeOverride(
  theme: unknown
): Record<string, string> | null {
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) {
    return null;
  }

  const valid: Record<string, string> = {};
  const keys = ['accent', 'accent2', 'bg', 'text'];
  const t = theme as Record<string, unknown>;

  for (const key of keys) {
    if (t[key] && typeof t[key] === 'string') {
      // Basic hex/rgb validation
      const color = t[key] as string;
      if (isValidColor(color)) {
        valid[key] = color;
      }
    }
  }

  return Object.keys(valid).length > 0 ? valid : null;
}

/**
 * Check if value is a valid color
 * @param {string} color - Color string
 * @returns {boolean}
 */
function isValidColor(color: string): boolean {
  // Hex color
  if (/^#[0-9A-F]{6}$/i.test(color)) return true;

  // rgb/rgba
  if (/^rgba?\(/.test(color)) return true;

  // Named color
  const named = [
    'red',
    'blue',
    'green',
    'white',
    'black',
    'yellow',
    'orange',
    'purple',
    'gray',
    'silver'
  ];
  if (named.includes(color.toLowerCase())) return true;

  return false;
}

/**
 * Validate JSON serialization
 * Ensures data can be stored and retrieved without issues
 * @param {*} value - Value to validate
 * @returns {boolean} True if JSON-safe
 */
export function isJsonSafe(value: unknown): boolean {
  try {
    const serialized = JSON.stringify(value);
    JSON.parse(serialized);
    return true;
  } catch {
    return false;
  }
}

/**
 * Make value JSON-safe by removing non-serializable properties
 * @param {*} value - Value to make safe
 * @returns {*} JSON-safe value
 */
export function makeJsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((v: unknown) => makeJsonSafe(v)).filter((v) => v !== undefined);
  }

  // Object
  const safe: Record<string, unknown> = {};
  const obj = value as Record<string, unknown>;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const safeValue = makeJsonSafe(obj[key]);
      if (safeValue !== undefined) {
        safe[key] = safeValue;
      }
    }
  }

  return safe;
}

/**
 * Error Boundary component
 * See src/components/ErrorBoundary.tsx for React implementation
 */
export function createErrorFallback(error?: Error): Record<string, unknown> {
  return {
    className: 'error-boundary-fallback',
    message: '⚠️ Unable to render this section',
    details: error?.message || 'Unknown error',
    showDetails: !!error?.message
  };
}
