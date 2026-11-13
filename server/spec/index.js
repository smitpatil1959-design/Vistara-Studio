// src/deck-spec/types.ts
var SPEC_VERSION = "presentation.v2";

// src/deck-spec/validate.ts
var ELEMENT_TYPES = ["text", "image", "icon", "shape", "card", "button", "chart", "video", "group", "table", "diagram"];
var PRESETS = ["none", "fade", "rise", "slide", "zoom", "stagger", "blur", "scale", "morph"];
var TRANSITIONS = ["fade", "slide", "zoom", "stagger", "none", "morph", "blur"];
var MOTION_PRESET_IDS = ["cinematic", "elegant", "minimal", "futuristic", "energetic", "corporate"];
var MOTION_DIRECTIONS = ["none", "up", "down", "left", "right"];
var MOTION_TRIGGERS = ["onEnter", "onCascade", "onHover", "manual"];
var SECTIONS = [
  "hero",
  "intro",
  "problem",
  "solution",
  "features",
  "workflow",
  "architecture",
  "benefits",
  "technology",
  "future",
  "cta",
  "market",
  "differentiation",
  "businessValue",
  "growth",
  "implementation",
  "impact",
  "overview",
  "product",
  "services",
  "pricing",
  "comparison",
  "metrics",
  "timeline",
  "ecosystem",
  "audience",
  "useCases",
  "leadership",
  "custom"
];
var LEGACY_SECTION_MAP = {
  about: "overview",
  what_it_does: "solution",
  conclusion: "cta",
  company: "overview",
  geographic_presence: "market",
  competitive_landscape: "comparison",
  differentiators: "differentiation",
  funding_context: "growth",
  news: "future",
  security: "architecture",
  partnerships: "ecosystem",
  integrations: "ecosystem",
  use_cases: "useCases",
  business_model: "businessValue"
};
function toCanonicalSection(rawType) {
  const norm = String(rawType || "").toLowerCase().trim();
  if (!norm) return "custom";
  if (SECTIONS.includes(norm)) return norm;
  if (LEGACY_SECTION_MAP[norm]) return LEGACY_SECTION_MAP[norm];
  return "custom";
}
var FLOW_SLOTS = ["kicker", "title", "subtitle", "body", "media", "stat", "card", "action", "decoration", "footer"];
var EASINGS = ["linear", "ease-out", "ease-in-out", "spring-soft", "spring-snappy"];
var isStr = (v) => typeof v === "string";
var isNum = (v) => typeof v === "number" && Number.isFinite(v);
var isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function err(errors, path, msg) {
  if (errors.length < 64) errors.push(`${path}: ${msg}`);
}
function validatePosition(errors, p, path) {
  if (!isObj(p)) return err(errors, path, "position must be an object");
  const pos = p;
  if (pos.mode !== "flow" && pos.mode !== "absolute") err(errors, path + ".mode", "must be flow|absolute");
  if (pos.slot !== void 0 && !FLOW_SLOTS.includes(pos.slot)) err(errors, path + ".slot", `unknown slot "${String(pos.slot)}"`);
  if (pos.order !== void 0 && !isNum(pos.order)) err(errors, path + ".order", "must be a number");
  if (pos.mode === "absolute" && (!isNum(pos.x) || !isNum(pos.y))) err(errors, path, "absolute mode requires numeric x and y");
}
function validateContent(errors, type, c, path, depth = 0) {
  if (!isObj(c)) return err(errors, path, "content must be an object");
  const k = c.kind;
  if (k !== type) err(errors, path + ".kind", `kind must equal "${type}"`);
  switch (type) {
    case "text":
      if (!isStr(c.text)) err(errors, path + ".text", "required");
      break;
    case "image":
      if (!isStr(c.src)) err(errors, path + ".src", "required");
      break;
    case "icon":
      if (!isStr(c.name)) err(errors, path + ".name", "required");
      break;
    case "video":
      if (!isStr(c.src)) err(errors, path + ".src", "required");
      break;
    case "button":
      if (!isStr(c.label)) err(errors, path + ".label", "required");
      break;
    case "chart":
      if (!Array.isArray(c.series)) err(errors, path + ".series", "required array");
      else for (const point of c.series) {
        if (!isObj(point) || !isStr(point.label) || !isNum(point.value)) err(errors, path + ".series", "each point needs a label and finite value");
      }
      if (!["bars", "line", "area", "pie", "donut", "progress"].includes(String(c.chart))) err(errors, path + ".chart", "unsupported chart type");
      break;
    case "table":
      if (!Array.isArray(c.rows) || c.rows.length > 30 || c.rows.some((row) => !Array.isArray(row) || row.length > 12 || row.some((cell) => !isStr(cell)))) err(errors, path + ".rows", "requires at most 30 rows of 12 string cells");
      break;
    case "diagram":
      if (!Array.isArray(c.nodes) || c.nodes.length > 20 || c.nodes.some((node) => !isObj(node) || !isStr(node.id) || !isStr(node.label))) err(errors, path + ".nodes", "requires up to 20 named nodes");
      if (!Array.isArray(c.edges)) err(errors, path + ".edges", "required array");
      break;
    case "card":
      if (!isStr(c.title)) err(errors, path + ".title", "required");
      break;
    case "shape":
      if (!isStr(c.shape)) err(errors, path + ".shape", "required");
      break;
    case "group": {
      const children = c.children;
      if (!Array.isArray(children)) err(errors, path + ".children", "required array");
      else children.forEach((child, i) => validateElement(errors, child, `${path}.children[${i}]`, depth + 1));
      break;
    }
  }
}
function validateElement(errors, e, path, depth = 0) {
  if (depth > 8) return err(errors, path, "group nesting exceeds 8");
  if (!isObj(e)) return err(errors, path, "element must be an object");
  const el = e;
  if (!isStr(el.id) || !el.id) err(errors, path + ".id", "required");
  if (!el.type || !ELEMENT_TYPES.includes(el.type)) err(errors, path + ".type", `unknown type "${String(el.type)}"`);
  validatePosition(errors, el.position, path + ".position");
  if (!isObj(el.size)) err(errors, path + ".size", "size required");
  else for (const key of ["w", "h"]) {
    const value = el.size[key];
    if (typeof value === "number" && (!isNum(value) || value <= 0 || value > 1e4)) err(errors, path + ".size." + key, "invalid size");
  }
  if (el.rotation !== void 0 && (!isNum(el.rotation) || Math.abs(el.rotation) > 36e3)) err(errors, path + ".rotation", "invalid rotation");
  if (el.type) validateContent(errors, el.type, el.content, path + ".content", depth);
  if (!isObj(el.animation)) err(errors, path + ".animation", "required");
  else if (!PRESETS.includes(String(el.animation.preset))) err(errors, path + ".animation.preset", "unknown preset");
}
function validateSlide(errors, s, path) {
  if (!isObj(s)) return err(errors, path, "slide must be an object");
  const sl = s;
  if (!isStr(sl.id)) err(errors, path + ".id", "required");
  if (!sl.section || !SECTIONS.includes(sl.section)) err(errors, path + ".section", `unknown section "${String(sl.section)}"`);
  if (!isStr(sl.label)) err(errors, path + ".label", "required label");
  if (!isObj(sl.background)) err(errors, path + ".background", "required");
  if (sl.themeOverride !== void 0) {
    if (!isObj(sl.themeOverride)) err(errors, path + ".themeOverride", "theme override must be an object");
    else validateTheme(errors, { skin: "light", ...sl.themeOverride }, path + ".themeOverride");
  }
  if (!Array.isArray(sl.elements)) err(errors, path + ".elements", "required array");
  else sl.elements.forEach((e, i) => validateElement(errors, e, `${path}.elements[${i}]`));
  if (!sl.transition || !TRANSITIONS.includes(sl.transition)) err(errors, path + ".transition", `unknown transition "${String(sl.transition)}"`);
}
function validateTheme(errors, t, path) {
  if (!isObj(t)) return err(errors, path, "theme required");
  const th = t;
  if (th.skin !== "light" && th.skin !== "dark") err(errors, path + ".skin", "light|dark");
  const colors = th.colors;
  if (!isObj(colors)) err(errors, path + ".colors", "required");
  else for (const k of ["bg", "surface", "surfaceAlt", "text", "muted", "accent", "accent2", "line"])
    if (!isStr(colors[k])) err(errors, `${path}.colors.${k}`, "required string");
  const typo = th.typography;
  if (!isObj(typo) || !isStr(typo.headingFont) || !isStr(typo.bodyFont)) err(errors, path + ".typography", "headingFont/bodyFont required");
}
function validateMotion(errors, m, path) {
  if (!isObj(m)) return err(errors, path, "motion required");
  const mo = m;
  if (!mo.entrance || !PRESETS.includes(mo.entrance)) err(errors, path + ".entrance", "unknown preset");
  if (!mo.exit || !PRESETS.includes(mo.exit)) err(errors, path + ".exit", "unknown preset");
  if (!isNum(mo.durationMs) || mo.durationMs < 0 || mo.durationMs > 4e3) err(errors, path + ".durationMs", "0\u20134000ms");
  if (!EASINGS.includes(String(mo.easing))) err(errors, path + ".easing", "unknown easing");
  if (!mo.transition || !TRANSITIONS.includes(mo.transition)) err(errors, path + ".transition", "unknown transition");
  if (mo.preset != null && !MOTION_PRESET_IDS.includes(mo.preset)) err(errors, path + ".preset", "unknown named preset");
  if (mo.direction && !MOTION_DIRECTIONS.includes(mo.direction)) err(errors, path + ".direction", "unknown direction");
  if (mo.trigger && !MOTION_TRIGGERS.includes(mo.trigger)) err(errors, path + ".trigger", "unknown trigger");
  if (mo.parallax != null && (!isNum(mo.parallax) || mo.parallax < 0 || mo.parallax > 1)) err(errors, path + ".parallax", "0\u20131");
}
function validatePresentation(doc) {
  const errors = [];
  if (!isObj(doc)) return { valid: false, errors: ["document must be an object"] };
  const d = doc;
  if (d.schemaVersion !== SPEC_VERSION && d.schemaVersion !== "presentation.v1") err(errors, "schemaVersion", `must be presentation.v1 or ${SPEC_VERSION}`);
  if (!isStr(d.id)) err(errors, "id", "required");
  if (!isStr(d.name)) err(errors, "name", "required");
  if (!isObj(d.canvas) || !isNum(d.canvas.width) || !isNum(d.canvas.height)) err(errors, "canvas", "width/height numbers required");
  validateTheme(errors, d.theme, "theme");
  validateMotion(errors, d.motion, "motion");
  if (!Array.isArray(d.slides)) err(errors, "slides", "required array");
  else {
    const ids = /* @__PURE__ */ new Set();
    d.slides.forEach((s, i) => {
      validateSlide(errors, s, `slides[${i}]`);
      const elementIds = /* @__PURE__ */ new Set();
      const inspect = (elements, depth = 0) => {
        if (depth > 8) {
          err(errors, `slides[${i}]`, "group nesting exceeds 8");
          return;
        }
        for (const element2 of Array.isArray(elements) ? elements : []) {
          if (elementIds.has(element2?.id)) err(errors, `slides[${i}].elements`, "duplicate element id");
          elementIds.add(element2?.id);
          if (element2?.content?.kind === "group") inspect(element2.content.children, depth + 1);
        }
      };
      inspect(s.elements);
      const sobj = s;
      if (isStr(sobj.id)) {
        if (ids.has(sobj.id)) err(errors, `slides[${i}].id`, "duplicate slide id");
        ids.add(sobj.id);
      }
    });
  }
  if (!isObj(d.meta)) err(errors, "meta", "required");
  return { valid: errors.length === 0, errors };
}
var clampStr = (v, fallback = "") => isStr(v) ? v : fallback;
var clampNum = (v, lo, hi, fallback) => isNum(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
function normalizeElement(e) {
  const type = ELEMENT_TYPES.includes(String(e.type)) ? e.type : "text";
  return {
    id: clampStr(e.id) || `el-${Math.random().toString(36).slice(2, 9)}`,
    type,
    position: {
      mode: e.position?.mode === "absolute" ? "absolute" : "flow",
      slot: FLOW_SLOTS.includes(String(e.position?.slot)) ? e.position?.slot : "body",
      order: isNum(e.position?.order) ? e.position.order : 0,
      ...e.position?.mode === "absolute" ? { x: clampNum(e.position.x, 0, 1280, 0), y: clampNum(e.position.y, 0, 720, 0) } : {}
    },
    size: { w: e.size?.w ?? "auto", h: e.size?.h ?? "auto" },
    content: e.content?.kind === "group" ? { ...e.content, children: e.content.children.map((child) => normalizeElement(child)) } : e.content || { kind: "text", text: "", role: "body" },
    style: e.style || {},
    animation: { preset: e.animation?.preset && PRESETS.includes(e.animation.preset) ? e.animation.preset : "fade", delayMs: clampNum(e.animation?.delayMs, 0, 3e3, 0) },
    metadata: isObj(e.metadata) ? e.metadata : {},
    rotation: clampNum(e.rotation, -36e3, 36e3, 0),
    zIndex: clampNum(e.zIndex, -1e3, 1e4, 0),
    locked: e.locked === true,
    hidden: e.hidden === true,
    ...e.groupId ? { groupId: e.groupId } : {}
  };
}
function normalizePresentation(doc, defaults) {
  return {
    schemaVersion: SPEC_VERSION,
    id: clampStr(doc.id, cryptoAvailable() ? crypto.randomUUID() : fallbackId()),
    name: clampStr(doc.name, "Untitled presentation"),
    canvas: { width: clampNum(doc.canvas?.width, 320, 3840, 1280), height: clampNum(doc.canvas?.height, 240, 2160, 720) },
    theme: doc.theme || defaults.theme,
    motion: {
      entrance: doc.motion?.entrance && PRESETS.includes(doc.motion.entrance) ? doc.motion.entrance : defaults.motion.entrance,
      exit: doc.motion?.exit && PRESETS.includes(doc.motion.exit) ? doc.motion.exit : defaults.motion.exit,
      durationMs: clampNum(doc.motion?.durationMs, 0, 4e3, defaults.motion.durationMs),
      delayStaggerMs: clampNum(doc.motion?.delayStaggerMs, 0, 400, defaults.motion.delayStaggerMs),
      easing: EASINGS.includes(String(doc.motion?.easing)) ? doc.motion.easing : defaults.motion.easing,
      transition: doc.motion?.transition && TRANSITIONS.includes(doc.motion.transition) ? doc.motion.transition : defaults.motion.transition,
      preset: doc.motion?.preset && MOTION_PRESET_IDS.includes(doc.motion.preset) ? doc.motion.preset : doc.motion?.preset ?? defaults.motion.preset ?? null,
      direction: doc.motion?.direction && MOTION_DIRECTIONS.includes(doc.motion.direction) ? doc.motion.direction : defaults.motion.direction ?? "up",
      trigger: doc.motion?.trigger && MOTION_TRIGGERS.includes(doc.motion.trigger) ? doc.motion.trigger : defaults.motion.trigger ?? "onEnter",
      parallax: clampNum(doc.motion?.parallax, 0, 1, defaults.motion.parallax ?? 0)
    },
    slides: Array.isArray(doc.slides) ? doc.slides.map((s, i) => normalizeSlide(s, i)) : [],
    meta: {
      ...doc.meta,
      projectUrl: clampStr(doc.meta?.projectUrl),
      purpose: clampStr(doc.meta?.purpose, "general"),
      source: doc.meta?.source === "ai-edit" || doc.meta?.source === "manual-edit" ? doc.meta.source : "generated",
      editorVersion: 2,
      ...doc.schemaVersion === "presentation.v1" ? { migratedFrom: "presentation.v1" } : {}
    },
    ...doc.brand ? { brand: doc.brand } : {},
    ...doc.assets ? { assets: doc.assets } : {},
    updatedAt: isStr(doc.updatedAt) ? doc.updatedAt : (/* @__PURE__ */ new Date()).toISOString()
  };
}
function normalizeSlide(s, i) {
  return {
    id: clampStr(s.id, `slide-${i + 1}`),
    section: SECTIONS.includes(String(s.section)) ? s.section : "custom",
    label: clampStr(s.label, "Section"),
    layout: s.layout === "center" || s.layout === "split" || s.layout === "grid" ? s.layout : "left",
    background: {
      type: s.background?.type === "gradient" || s.background?.type === "image" || s.background?.type === "solid" ? s.background.type : "theme",
      value: clampStr(s.background?.value),
      ...s.background?.overlay ? { overlay: s.background.overlay } : {}
    },
    elements: Array.isArray(s.elements) ? s.elements.map((e) => normalizeElement(e)) : [],
    transition: s.transition && TRANSITIONS.includes(s.transition) ? s.transition : "fade",
    metadata: isObj(s.metadata) ? s.metadata : {},
    ...s.composition ? { composition: s.composition } : {},
    notes: clampStr(s.notes),
    ...s.themeOverride ? { themeOverride: s.themeOverride } : {},
    sources: Array.isArray(s.sources) ? s.sources.filter((source) => isStr(source.url) && /^https?:\/\//.test(source.url)) : [],
    ...s.validation ? { validation: s.validation } : {}
  };
}
function cryptoAvailable() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function";
}
function fallbackId() {
  if (cryptoAvailable()) return crypto.randomUUID();
  return "00000000-0000-4000-8000-000000000000".replace(/0/g, () => (Math.random() * 16 | 0).toString(16));
}

// src/deck-spec/defaults.ts
function defaultThemeSpec() {
  return {
    name: "Studio Paper",
    skin: "light",
    colors: {
      bg: "#F7F6F1",
      surface: "#FFFFFF",
      surfaceAlt: "#EFEEE6",
      text: "#17170F",
      muted: "#6E7264",
      accent: "#65A30D",
      accent2: "#0E7490",
      line: "rgba(23,23,15,0.10)"
    },
    typography: { headingFont: "Inter Tight", bodyFont: "Inter", baseSize: 16, scaleRatio: 1.25 },
    spacing: { unit: 8, sectionGap: 48, cardGap: 20 },
    radius: { sm: 10, md: 16, lg: 24, pill: 999 },
    shadows: {
      sm: "0 1px 2px rgba(23,23,15,0.06)",
      md: "0 12px 30px -14px rgba(23,23,15,0.22)",
      lg: "0 32px 80px -32px rgba(23,23,15,0.35)",
      glow: "0 0 42px -8px {accent}"
    },
    effects: { grain: true, glass: false, glowIntensity: 0.55 }
  };
}
function inkThemeSpec(base) {
  return {
    ...base,
    name: "Studio Ink",
    skin: "dark",
    colors: {
      ...base.colors,
      bg: "#08080F",
      surface: "#10101B",
      surfaceAlt: "#171724",
      text: "#F5F5FA",
      muted: "#9CA0B8",
      line: "rgba(255,255,255,0.09)"
    }
  };
}
function defaultMotionSpec() {
  return {
    entrance: "rise",
    exit: "fade",
    durationMs: 550,
    delayStaggerMs: 90,
    easing: "spring-soft",
    transition: "fade",
    preset: null,
    direction: "up",
    trigger: "onEnter",
    parallax: 0
  };
}

// src/deck-spec/motionPresets.ts
var MOTION_PRESETS = [
  {
    id: "cinematic",
    label: "Cinematic",
    vibe: "Blur reveals and slow zooms; low travel, high drama",
    entrance: "blur",
    exit: "fade",
    durationMs: 900,
    delayStaggerMs: 130,
    easing: "spring-soft",
    transition: "morph",
    preset: null,
    direction: "up",
    trigger: "onEnter",
    parallax: 0.6
  },
  {
    id: "elegant",
    label: "Elegant",
    vibe: "Unhurried rises, silk fades, generous spacing",
    entrance: "rise",
    exit: "fade",
    durationMs: 780,
    delayStaggerMs: 110,
    easing: "ease-out",
    transition: "fade",
    preset: null,
    direction: "up",
    trigger: "onEnter",
    parallax: 0.25
  },
  {
    id: "minimal",
    label: "Minimal",
    vibe: "Opacity and quiet fades only \u2014 restraint as style",
    entrance: "fade",
    exit: "fade",
    durationMs: 340,
    delayStaggerMs: 60,
    easing: "ease-in-out",
    transition: "fade",
    preset: null,
    direction: "none",
    trigger: "onEnter",
    parallax: 0
  },
  {
    id: "futuristic",
    label: "Futuristic",
    vibe: "Lateral glides, scale snaps, electric velocity",
    entrance: "slide",
    exit: "zoom",
    durationMs: 460,
    delayStaggerMs: 70,
    easing: "spring-snappy",
    transition: "slide",
    preset: null,
    direction: "left",
    trigger: "onEnter",
    parallax: 0.4
  },
  {
    id: "energetic",
    label: "Energetic",
    vibe: "Fast rises and punchy scale, tight cadence",
    entrance: "scale",
    exit: "fade",
    durationMs: 320,
    delayStaggerMs: 65,
    easing: "spring-snappy",
    transition: "zoom",
    preset: null,
    direction: "up",
    trigger: "onEnter",
    parallax: 0.2
  },
  {
    id: "corporate",
    label: "Corporate",
    vibe: "Boardroom-safe fades; nothing calls attention to itself",
    entrance: "fade",
    exit: "fade",
    durationMs: 520,
    delayStaggerMs: 90,
    easing: "ease-in-out",
    transition: "fade",
    preset: null,
    direction: "none",
    trigger: "onEnter",
    parallax: 0
  }
];
function getMotionPreset(id) {
  return MOTION_PRESETS.find((p) => p.id === id) || MOTION_PRESETS[2];
}
var PRESET_SYNONYMS = {
  cinematic: "cinematic",
  movie: "cinematic",
  film: "cinematic",
  dramatic: "cinematic",
  hollywood: "cinematic",
  oscar: "cinematic",
  elegant: "elegant",
  elegance: "elegant",
  sophisticated: "elegant",
  luxe: "elegant",
  luxury: "elegant",
  graceful: "elegant",
  editorial: "elegant",
  minimal: "minimal",
  simple: "minimal",
  clean: "minimal",
  subtle: "minimal",
  quiet: "minimal",
  swiss: "minimal",
  restrained: "minimal",
  futuristic: "futuristic",
  neon: "futuristic",
  hud: "futuristic",
  cyberpunk: "futuristic",
  sci: "futuristic",
  scifi: "futuristic",
  cyber: "futuristic",
  energetic: "energetic",
  punchy: "energetic",
  lively: "energetic",
  vibrant: "energetic",
  bold: "energetic",
  snappy: "energetic",
  fast: "energetic",
  corporate: "corporate",
  boardroom: "corporate",
  formal: "corporate",
  conservative: "corporate",
  professional: "corporate",
  conservativeboard: "corporate"
};
function resolveMotionPreset(text2) {
  const words = String(text2).toLowerCase().match(/[a-z]+/g) || [];
  for (const w of words) {
    if (PRESET_SYNONYMS[w]) return PRESET_SYNONYMS[w];
  }
  return null;
}

// src/deck-spec/fromSlides.ts
var elId = () => fallbackId();
function themeSpecFromDeck(theme) {
  const base = theme?.skin === "dark" ? inkThemeSpec(defaultThemeSpec()) : defaultThemeSpec();
  const rawColors = theme?.colors || {};
  return {
    ...base,
    colors: {
      ...base.colors,
      bg: rawColors.bg || base.colors.bg,
      surface: rawColors.surface || base.colors.surface,
      surfaceAlt: rawColors.surfaceAlt || base.colors.surfaceAlt,
      text: rawColors.text || base.colors.text,
      muted: rawColors.mutedText || rawColors.muted || base.colors.muted,
      accent: theme?.accent || rawColors.accent || base.colors.accent,
      accent2: theme?.accent2 || rawColors.accent2 || base.colors.accent2,
      line: rawColors.line || base.colors.line
    },
    typography: {
      ...base.typography,
      headingFont: theme?.headingFont || base.typography.headingFont,
      bodyFont: theme?.bodyFont || base.typography.bodyFont
    }
  };
}
function motionSpecFromDeck(theme) {
  const m = String(theme?.motion || "smooth");
  const preset = ["cinematic", "elegant", "minimal", "futuristic", "energetic", "corporate"].find((id) => m === id) || null;
  if (preset) {
    const p = getMotionPreset(preset);
    return { ...defaultMotionSpec(), ...p, preset };
  }
  return {
    ...defaultMotionSpec(),
    durationMs: m === "snappy" ? 320 : m === "calm" ? 820 : 550,
    entrance: m === "snappy" ? "slide" : "rise",
    easing: m === "snappy" ? "spring-snappy" : "spring-soft",
    preset: m === "calm" ? "elegant" : null
  };
}
var FONT_ROLES = /* @__PURE__ */ new Map([
  ["kicker", 12],
  ["title", 56],
  ["subtitle", 20],
  ["body", 17],
  ["caption", 12]
]);
function textEl(slot, role, text2, order, delayMs) {
  if (!text2 || !text2.trim()) return null;
  return {
    id: elId(),
    type: "text",
    position: { mode: "flow", slot, order },
    size: { w: "auto", h: "auto" },
    content: { kind: "text", text: text2, role },
    style: { fontSize: FONT_ROLES.get(role) },
    animation: { preset: role === "title" ? "rise" : "fade", delayMs },
    metadata: {}
  };
}
var splitBullet = (b) => {
  const i = b.indexOf(" \u2014 ");
  return i === -1 ? [b, ""] : [b.slice(0, i), b.slice(i + 3)];
};
function slideToSpec(slide, index) {
  const elements = [];
  const push = (el) => el && elements.push(el);
  push(textEl("kicker", "kicker", (slide.custom_label || slide.type).toUpperCase(), 0, 0));
  push(textEl("title", "title", slide.title || "", 1, 80));
  push(textEl("subtitle", "subtitle", slide.subtitle || "", 2, 160));
  push(textEl("body", "body", slide.body || "", 3, 220));
  (slide.stats || []).forEach((st, i) => {
    elements.push({
      id: elId(),
      type: "card",
      position: { mode: "flow", slot: "stat", order: i },
      size: { w: "third", h: "auto" },
      content: { kind: "card", title: st.label, body: "", icon: null, index: i, metric: st.value },
      style: {},
      animation: { preset: "stagger", delayMs: 320 + i * 90 },
      metadata: { metric: true }
    });
  });
  (slide.bullets || []).forEach((b, i) => {
    const [title, body] = splitBullet(b);
    elements.push({
      id: elId(),
      type: "card",
      position: { mode: "flow", slot: "card", order: i },
      size: { w: "third", h: "auto" },
      content: { kind: "card", title, body, icon: null, index: i, metric: null },
      style: {},
      animation: { preset: "stagger", delayMs: 260 + i * 80 },
      metadata: {}
    });
  });
  if (slide.image_url) {
    const vd = slide.visualDecision;
    const attr = vd?.attribution;
    elements.push({
      id: elId(),
      type: "image",
      position: { mode: "flow", slot: "media", order: 0 },
      size: { w: "half", h: 420 },
      content: { kind: "image", src: slide.image_url, alt: slide.title || "slide media", fit: "cover", frame: vd?.placement === "browser" ? "browser" : "plain" },
      style: { radius: 14 },
      animation: { preset: "zoom", delayMs: 180 },
      metadata: vd ? {
        visualDecisionType: String(vd.type || ""),
        visualDecisionPlacement: String(vd.placement || ""),
        provider: String(attr?.provider || ""),
        author: String(attr?.author || "")
      } : {}
    });
  }
  if (slide.type === "cta") {
    elements.push({
      id: elId(),
      type: "button",
      position: { mode: "flow", slot: "action", order: 0 },
      size: { w: "auto", h: "auto" },
      content: { kind: "button", label: (slide.stats?.[0]?.value || "").trim() || "Open", href: "#", variant: "primary" },
      style: {},
      animation: { preset: "rise", delayMs: 420 },
      metadata: {}
    });
  }
  return {
    id: slide.id,
    section: toCanonicalSection(slide.type),
    label: slide.custom_label || slide.type || "Section",
    layout: slide.layout || "left",
    background: { type: "theme", value: "" },
    elements,
    transition: slide.animation || "fade",
    metadata: { sort_order: slide.sort_order, position: index },
    notes: "",
    sources: (slide.source_urls || []).filter((url) => /^https?:\/\//.test(url)).map((url) => ({ url }))
  };
}
function getRenderableSlides(spec) {
  if (!spec) return [];
  return spec.slides.map((s, i) => specSlideToRenderable(s, i));
}
function buildSpecFromSlides(project, slides, source, purpose = "general") {
  return {
    schemaVersion: SPEC_VERSION,
    id: `spec-${project.id}`,
    name: `${project.name} \u2014 presentation`,
    canvas: { width: 1280, height: 720 },
    theme: themeSpecFromDeck(project.theme),
    motion: motionSpecFromDeck(project.theme),
    slides: [...slides].sort((a, b) => a.sort_order - b.sort_order).map(slideToSpec),
    meta: { projectUrl: project.url, purpose, source },
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function specSlideToRenderable(slide, index) {
  const texts = slide.elements.filter((e) => e.type === "text");
  const bySlot = (slot) => texts.find((e) => e.content.kind === "text" && e.content.role === slot);
  const cards = slide.elements.filter((e) => e.type === "card" && e.content.kind === "card");
  const stats = cards.filter((c) => c.position.slot === "stat");
  const bulletCards = cards.filter((c) => c.position.slot === "card");
  const image = slide.elements.find((e) => e.type === "image" && e.content.kind === "image");
  return {
    id: slide.id,
    project_id: "",
    sort_order: typeof slide.metadata.sort_order === "number" ? slide.metadata.sort_order : index * 10,
    type: slide.section,
    custom_label: slide.label,
    title: bySlot("title")?.content.kind === "text" ? bySlot("title").content.text : null,
    subtitle: bySlot("subtitle")?.content.kind === "text" ? bySlot("subtitle").content.text : null,
    body: bySlot("body")?.content.kind === "text" ? bySlot("body").content.text : null,
    bullets: bulletCards.map((c) => {
      const cc = c.content;
      return cc.body ? `${cc.title} \u2014 ${cc.body}` : cc.title;
    }),
    stats: stats.map((c) => {
      const cc = c.content;
      return { value: cc.metric || "", label: cc.title };
    }),
    image_url: image && image.content.kind === "image" ? image.content.src : null,
    layout: slide.layout,
    animation: slide.transition,
    theme_override: null
  };
}

// src/deck-spec/ops.ts
var cloneSpec = (s) => JSON.parse(JSON.stringify(s));
function cloneSlideDocument(spec, slideId) {
  return { ...spec, slides: spec.slides.map((slide) => slide.id === slideId ? structuredClone(slide) : slide) };
}
function slideOf(spec, slideId) {
  return spec.slides.find((s) => s.id === slideId) || null;
}
function elementOf(spec, slideId, elementId) {
  const slide = slideOf(spec, slideId);
  if (!slide) return null;
  const walk = (els) => {
    for (const e of els) {
      if (e.id === elementId) return e;
      if (e.content.kind === "group") {
        const hit = walk(e.content.children);
        if (hit) return hit;
      }
    }
    return null;
  };
  return walk(slide.elements);
}
function updateElement(spec, slideId, elementId, patch) {
  const next = cloneSlideDocument(spec, slideId);
  const el = elementOf(next, slideId, elementId);
  if (!el) return spec;
  if (patch.content && patch.content.kind === el.type) el.content = patch.content;
  if (patch.rotation !== void 0) el.rotation = patch.rotation;
  if (patch.locked !== void 0) el.locked = patch.locked;
  if (patch.hidden !== void 0) el.hidden = patch.hidden;
  if (patch.metadata) el.metadata = { ...el.metadata, ...patch.metadata };
  if (patch.contentText !== void 0 && el.content.kind === "text") el.content.text = patch.contentText;
  if (patch.imageSrc !== void 0 && el.content.kind === "image") el.content.src = patch.imageSrc;
  if (patch.imageAlt !== void 0 && el.content.kind === "image") el.content.alt = patch.imageAlt;
  if (patch.cardTitle !== void 0 && el.content.kind === "card") el.content.title = patch.cardTitle;
  if (patch.cardBody !== void 0 && el.content.kind === "card") el.content.body = patch.cardBody;
  if (patch.buttonLabel !== void 0 && el.content.kind === "button") el.content.label = patch.buttonLabel;
  if (patch.buttonHref !== void 0 && el.content.kind === "button") el.content.href = patch.buttonHref;
  if (patch.iconName !== void 0 && el.content.kind === "icon") el.content.name = patch.iconName;
  if (patch.style) el.style = { ...el.style, ...patch.style };
  if (patch.animation) el.animation = { ...el.animation, ...patch.animation };
  if (patch.position) el.position = { ...el.position, ...patch.position };
  if (patch.size) el.size = { ...el.size, ...patch.size };
  return next;
}
function moveElementTo(spec, slideId, elementId, x, y) {
  return updateElement(spec, slideId, elementId, {
    position: {
      mode: "absolute",
      x: Math.round(Math.max(0, Math.min(1280 - 24, x))),
      y: Math.round(Math.max(0, Math.min(720 - 24, y)))
    }
  });
}
function resizeElementTo(spec, slideId, elementId, w, h) {
  return updateElement(spec, slideId, elementId, {
    size: { w: Math.round(Math.max(48, Math.min(1280, w))), h: Math.round(Math.max(24, Math.min(720, h))) }
  });
}
function duplicateElement(spec, slideId, elementId) {
  const next = cloneSlideDocument(spec, slideId);
  const slide = slideOf(next, slideId);
  const el = slide ? elementOf(next, slideId, elementId) : null;
  if (!slide || !el) return { spec, newId: null };
  const copy2 = {
    ...JSON.parse(JSON.stringify(el)),
    id: fallbackId(),
    position: {
      ...el.position,
      mode: "absolute",
      x: el.position.mode === "absolute" && typeof el.position.x === "number" ? el.position.x + 18 : 64,
      y: el.position.mode === "absolute" && typeof el.position.y === "number" ? el.position.y + 18 : 64
    }
  };
  copy2.metadata = { ...el.metadata, duplicatedFrom: el.id };
  if (copy2.content.kind === "group") copy2.content.children = copy2.content.children.map((child) => renewElementIds(child));
  slide.elements.push(copy2);
  return { spec: next, newId: copy2.id };
}
function deleteElement(spec, slideId, elementId) {
  const next = cloneSlideDocument(spec, slideId);
  const slide = slideOf(next, slideId);
  if (!slide) return spec;
  const strip = (els) => els.filter((e) => e.id !== elementId).map((e) => e.content.kind === "group" ? { ...e, content: { ...e.content, children: strip(e.content.children) } } : e);
  slide.elements = strip(slide.elements);
  return next;
}
function reorderElement(spec, slideId, elementId, dir) {
  const next = cloneSlideDocument(spec, slideId);
  const slide = slideOf(next, slideId);
  if (!slide) return spec;
  const el = elementOf(next, slideId, elementId);
  if (!el) return spec;
  const arr = slide.elements;
  if (el.position.mode === "absolute") {
    const i = arr.findIndex((e) => e.id === elementId);
    const j = dir === "up" ? Math.min(arr.length - 1, i + 1) : Math.max(0, i - 1);
    if (i !== j) [arr[i], arr[j]] = [arr[j], arr[i]];
  } else {
    const peers = arr.filter((e) => e.position.mode === "flow" && e.position.slot === el.position.slot).sort((a, b) => (a.position.order ?? 0) - (b.position.order ?? 0));
    const i = peers.findIndex((e) => e.id === elementId);
    const j = dir === "up" ? Math.min(peers.length - 1, i + 1) : Math.max(0, i - 1);
    if (i !== j) {
      const other = peers[j];
      const a = el.position.order ?? i;
      const b = other.position.order ?? j;
      el.position.order = b;
      other.position.order = a;
    }
  }
  return next;
}
var center = { x: 560, y: 320 };
function baseElement(type, content, size, height) {
  return {
    id: fallbackId(),
    type,
    position: { mode: "absolute", x: center.x, y: center.y },
    size: { w: size, h: height },
    content,
    style: {},
    animation: { preset: "rise", delayMs: 0 },
    metadata: {}
  };
}
function makeElement(type) {
  switch (type) {
    case "text":
      return baseElement("text", { kind: "text", text: "New text", role: "body" }, "auto", "auto");
    case "image":
      return baseElement("image", { kind: "image", src: "", alt: "image", fit: "cover", frame: "browser" }, 420, 260);
    case "icon":
      return baseElement("icon", { kind: "icon", name: "sparkles", pack: "lucide" }, 40, 40);
    case "shape":
      return baseElement("shape", { kind: "shape", shape: "glow" }, 360, 240);
    case "card":
      return baseElement("card", { kind: "card", title: "Card title", body: "Supporting line", icon: "sparkles", index: null, metric: null }, 320, 160);
    case "button":
      return baseElement("button", { kind: "button", label: "Learn more", href: "#", variant: "primary" }, "auto", "auto");
    case "chart":
      return baseElement("chart", { kind: "chart", chart: "bars", series: [], dataSource: "user", legend: true, showValues: true }, 520, 300);
    case "table":
      return baseElement("table", { kind: "table", rows: [["Heading", "Heading"], ["Add content", "Add content"]], headerRow: true }, 600, 240);
    case "diagram":
      return baseElement("diagram", { kind: "diagram", layout: "process", nodes: [{ id: fallbackId(), label: "First step" }, { id: fallbackId(), label: "Next step" }], edges: [] }, 720, 180);
    case "video":
      return baseElement("video", { kind: "video", src: "", poster: null, muted: true }, 480, 270);
    case "group":
      return baseElement("group", { kind: "group", children: [] }, "auto", "auto");
    default:
      return baseElement("text", { kind: "text", text: "New text", role: "body" }, "auto", "auto");
  }
}
function addElement(spec, slideId, type) {
  const next = cloneSlideDocument(spec, slideId);
  const slide = slideOf(next, slideId);
  if (!slide) return { spec, newId: null };
  const el = makeElement(type);
  slide.elements.push(el);
  return { spec: next, newId: el.id };
}
function updateSlide(spec, slideId, patch) {
  const next = cloneSlideDocument(spec, slideId);
  const slide = slideOf(next, slideId);
  if (!slide) return spec;
  if (patch.label !== void 0) slide.label = patch.label;
  if (patch.layout !== void 0) slide.layout = patch.layout;
  if (patch.transition !== void 0) slide.transition = patch.transition;
  if (patch.background !== void 0) slide.background = patch.background;
  if (patch.notes !== void 0) slide.notes = patch.notes;
  return next;
}
function addSlide(spec, section, label) {
  const next = { ...spec, slides: [...spec.slides] };
  const id = fallbackId();
  next.slides.push({
    id,
    section,
    label: label || "Section",
    layout: "left",
    background: { type: "theme", value: "" },
    elements: [
      baseElement("text", { kind: "text", text: label || "New section", role: "title" }, "auto", "auto"),
      baseElement("text", { kind: "text", text: "Compose this section in the canvas.", role: "subtitle" }, "auto", "auto")
    ],
    transition: "fade",
    metadata: {}
  });
  return { spec: next, newId: id };
}
function duplicateSlide(spec, slideId) {
  const next = { ...spec, slides: [...spec.slides] };
  const i = next.slides.findIndex((s) => s.id === slideId);
  if (i === -1) return { spec, newId: null };
  const copy2 = JSON.parse(JSON.stringify(next.slides[i]));
  copy2.id = fallbackId();
  copy2.elements = copy2.elements.map(renewElementIds);
  copy2.label = copy2.label + " copy";
  copy2.metadata = { ...copy2.metadata, duplicatedFrom: slideId };
  next.slides.splice(i + 1, 0, copy2);
  return { spec: next, newId: copy2.id };
}
function renewElementIds(element2) {
  const copy2 = structuredClone(element2);
  copy2.id = fallbackId();
  delete copy2.groupId;
  if (copy2.content.kind === "group") copy2.content.children = copy2.content.children.map((child) => ({ ...renewElementIds(child), groupId: copy2.id }));
  return copy2;
}
function deleteSlide(spec, slideId) {
  if (spec.slides.length <= 1) return spec;
  const next = { ...spec, slides: [...spec.slides] };
  next.slides = next.slides.filter((s) => s.id !== slideId);
  return next;
}
function reorderSlides(spec, from, to) {
  const next = { ...spec, slides: [...spec.slides] };
  if (from === to || from < 0 || to < 0 || from >= next.slides.length || to >= next.slides.length) return spec;
  const [moved] = next.slides.splice(from, 1);
  next.slides.splice(to, 0, moved);
  return next;
}
function patchTheme(spec, patch) {
  const next = cloneSpec(spec);
  if (patch.colors) next.theme.colors = { ...next.theme.colors, ...patch.colors };
  if (patch.typography) next.theme.typography = { ...next.theme.typography, ...patch.typography };
  if (patch.radius) next.theme.radius = { ...next.theme.radius, ...patch.radius };
  if (patch.spacing) next.theme.spacing = { ...next.theme.spacing, ...patch.spacing };
  if (patch.shadows) next.theme.shadows = { ...next.theme.shadows, ...patch.shadows };
  if (patch.effects) next.theme.effects = { ...next.theme.effects, ...patch.effects };
  if (patch.name) next.theme.name = patch.name;
  if (patch.skin) next.theme.skin = patch.skin;
  return next;
}
function patchMotion(spec, patch) {
  const next = cloneSpec(spec);
  next.motion = { ...next.motion, ...patch };
  return next;
}
function applyPresetAnimation(spec, preset) {
  const map = { fade: "corporate", zoom: "energetic", stagger: "cinematic", rise: "elegant", slide: "futuristic", none: "minimal", blur: "cinematic", scale: "energetic", morph: "futuristic", static: "minimal" };
  const id = map[preset] || "corporate";
  return setMotionPreset(spec, id);
}
function setMotionPreset(spec, preset) {
  const next = cloneSpec(spec);
  const p = getMotionPreset(preset);
  next.motion = { ...next.motion, ...p, preset };
  for (const s of next.slides) {
    s.transition = p.transition === "none" ? "fade" : p.transition;
    for (const e of s.elements) {
      e.animation = { ...e.animation, preset: p.entrance === "none" ? "fade" : p.entrance };
    }
  }
  return next;
}
function tuneMotion(spec, patch) {
  const next = cloneSpec(spec);
  next.motion = { ...next.motion, ...patch, preset: null };
  return next;
}

// src/deck-spec/brand.ts
function colorHex(value) {
  const text2 = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(text2)) return text2.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(text2)) return "#" + text2.slice(1).split("").map((char) => char + char).join("").toUpperCase();
  const rgb = text2.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)$/i);
  if (rgb && rgb.slice(1, 4).every((n) => +n <= 255) && (!rgb[4] || +rgb[4] >= 0.8)) return "#" + rgb.slice(1, 4).map((n) => (+n).toString(16).padStart(2, "0")).join("").toUpperCase();
  return null;
}
var channels = (hex) => [1, 3, 5].map((offset) => parseInt((colorHex(hex) || "#000000").slice(offset, offset + 2), 16));
function luminance(hex) {
  const values = channels(hex).map((n) => {
    const value = n / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function readableText(bg) {
  if (contrast(bg, "#142019") >= 4.5) return "#142019";
  return contrast(bg, "#FFFFFF") >= contrast(bg, "#000000") ? "#FFFFFF" : "#000000";
}
function tint(a, b, amount) {
  const first = channels(a), second = channels(b);
  return "#" + first.map((value, index) => Math.round(value * (1 - amount) + second[index] * amount).toString(16).padStart(2, "0")).join("").toUpperCase();
}
var chroma = (hex) => {
  const rgb = channels(hex);
  return (Math.max(...rgb) - Math.min(...rgb)) / 255;
};
function deriveBrandKit(input) {
  const candidates = (input.signals || []).map((signal) => ({ ...signal, value: colorHex(signal.value) || "", confidence: Math.max(0, Math.min(1, signal.confidence)) })).filter((signal) => signal.value);
  const score = (signal) => {
    const role = signal.role.toLowerCase();
    const priority = /css.*primary|brand-primary|official/.test(role) ? 100 : /logo/.test(role) ? 90 : /cta|button/.test(role) ? 80 : /navigation|nav/.test(role) ? 60 : /accent|secondary/.test(role) ? 50 : 15;
    const neutral = chroma(signal.value) < 0.08;
    return priority * signal.confidence + chroma(signal.value) * 15 - (neutral && !/css.*primary|official/.test(role) ? 65 : 0);
  };
  const ranked = candidates.filter((signal) => !/background|body-text|surface/.test(signal.role)).sort((a, b) => score(b) - score(a));
  const best = ranked.find((signal) => score(signal) > 22) || ranked.find((signal) => /logo/.test(signal.role) && signal.confidence >= 0.85 && luminance(signal.value) < 0.08);
  const primary = best?.value || "#506A46";
  const accents = [...new Set(ranked.filter((signal) => chroma(signal.value) > 0.12 && score(signal) > 15).map((signal) => signal.value))].filter((hex) => hex !== primary).slice(0, 4);
  const secondary = accents[0] || tint(primary, "#15281F", 0.58);
  const bg = colorHex(input.bodyBackground) || "#FAFBF8";
  const bodyText = colorHex(input.bodyText) || readableText(bg);
  const style = input.visualStyle || (luminance(bg) < 0.12 ? "expressive" : chroma(primary) < 0.1 ? "minimal" : "modern");
  return {
    brandName: input.name,
    primaryColor: primary,
    originalPrimary: primary,
    secondaryColor: secondary,
    accentColors: accents.length ? accents : [secondary],
    backgroundColors: [bg, tint(primary, "#FFFFFF", 0.94)],
    textColors: [contrast(bg, bodyText) >= 4.5 ? bodyText : readableText(bg), "#FFFFFF"],
    fontFamilies: [...new Set(input.fonts || [])].filter((font) => typeof font === "string" && font.length < 100).slice(0, 4),
    logoUrl: input.logoUrl || null,
    visualStyle: style,
    brandPersonality: style === "minimal" ? ["restrained", "precise"] : style === "expressive" ? ["bold", "energetic"] : ["clear", "approachable"],
    confidence: best ? Math.min(0.98, best.confidence) : 0,
    sources: candidates.slice(0, 48),
    isFallback: !best
  };
}
function themeFromBrand(brand, mood = "brand") {
  const base = defaultThemeSpec();
  const primary = colorHex(brand.primaryColor) || "#506A46", dark = mood === "contrast";
  const bg = dark ? tint(primary, "#101916", 0.9) : mood === "soft" ? tint(primary, "#FFFFFF", 0.93) : "#FBFCF9";
  const foreground = readableText(bg);
  return {
    ...base,
    name: `${brand.brandName} \xB7 ${mood}`,
    skin: dark ? "dark" : "light",
    colors: { bg, surface: dark ? tint(bg, "#FFFFFF", 0.06) : "#FFFFFF", surfaceAlt: dark ? tint(bg, "#FFFFFF", 0.1) : tint(primary, "#FFFFFF", 0.94), text: foreground, muted: tint(foreground, bg, 0.28), accent: primary, accent2: brand.secondaryColor, line: tint(foreground, bg, 0.86) },
    typography: { ...base.typography, headingFont: mood === "editorial" ? "Instrument Serif" : brand.fontFamilies.find((font) => /inter|grotesk|arial|helvetica|georgia|serif/i.test(font)) || "Inter Tight", bodyFont: "Inter" },
    effects: { grain: false, glass: false, glowIntensity: 0 },
    radius: { sm: 8, md: brand.visualStyle === "minimal" ? 8 : 18, lg: 24, pill: 999 }
  };
}

// src/deck-spec/design.ts
var COMPOSITIONS = [
  ["cover", "Brand cover", "cover", 1, "A strong opening with room for the brand."],
  ["divider", "Section divider", "statement", 1, "One clear transition in the story."],
  ["summary", "Executive summary", "grid", 3, "Three essential takeaways."],
  ["overview", "Company overview", "split", 2, "Context beside supporting evidence."],
  ["insight", "Key insight", "statement", 1, "Make the main idea unmistakable."],
  ["metric", "Large metric", "metrics", 1, "A verified number and its context."],
  ["dashboard", "Metric dashboard", "metrics", 3, "Compare a small set of actual measurements."],
  ["comparison-two", "Two-column comparison", "comparison", 2, "A balanced side-by-side view."],
  ["comparison-three", "Three-column comparison", "comparison", 3, "Three dimensions with equal emphasis."],
  ["timeline", "Timeline", "diagram", 4, "A sequence with meaningful milestones."],
  ["process", "Process", "diagram", 4, "Connected steps with a clear direction."],
  ["features", "Feature showcase", "grid", 2, "A focused, spacious capability grid."],
  ["image-story", "Image-led story", "image", 2, "A relevant image beside the takeaway."],
  ["full-image", "Full-bleed image", "image", 1, "An image with a readable editorial panel."],
  ["quote", "Quote", "quote", 1, "A supplied statement in an editorial treatment."],
  ["market", "Market overview", "split", 2, "Evidence and context without invented market size."],
  ["landscape", "Competitive landscape", "comparison", 3, "Compare documented differentiators."],
  ["swot", "SWOT analysis", "swot", 2, "Four supplied analytical dimensions."],
  ["problem-solution", "Problem and solution", "comparison", 2, "Connect the problem to the supported response."],
  ["journey", "Customer journey", "diagram", 4, "A sequence grounded in the product workflow."],
  ["business-model", "Business model", "grid", 3, "Explain how the organization works."],
  ["architecture", "Technology architecture", "diagram", 3, "Connected systems with editable labels."],
  ["findings", "Research findings", "grid", 2, "Clear findings and traceable evidence."],
  ["evidence", "Evidence summary", "split", 2, "Separate the insight from its support."],
  ["data", "Data visualization", "chart", 1, "Verified quantitative data only."],
  ["case-study", "Case study", "image", 2, "An image, context and a supported outcome."],
  ["roadmap", "Roadmap", "diagram", 4, "A supplied plan, clearly labelled as a plan."],
  ["recommendations", "Recommendations", "grid", 3, "Actionable, explicitly interpreted next steps."],
  ["risks", "Risks and limitations", "grid", 2, "Make uncertainty and constraints visible."],
  ["conclusion", "Branded conclusion", "statement", 1, "End with one useful message."],
  ["sources", "Sources and references", "sources", 1, "Keep the original evidence close."]
].map(([id, name, kind, columns, description]) => ({ id, name, kind, columns, description }));
var copy = (value) => structuredClone(value);
function fitFont(text2, width, height, preferred = 48, minimum = 14, lineHeight = 1.15) {
  let size = preferred;
  const lines = (font) => String(text2).split("\n").reduce((total, line) => total + Math.max(1, Math.ceil(line.length * font * 0.53 / width)), 0);
  while (size > minimum && lines(size) * size * lineHeight > height) size -= 1;
  return size;
}
function element(type, content, x, y, w, h, style = {}, metadata = {}) {
  return { id: fallbackId(), type, content, position: { mode: "absolute", x, y }, size: { w, h }, style, animation: { preset: "rise", delayMs: 0 }, metadata: { designed: true, ...metadata }, rotation: 0, locked: false };
}
function text(value, role, x, y, w, h, color, fontSize, style = {}) {
  return element("text", { kind: "text", text: value, role }, x, y, w, h, { color, fontSize: fitFont(value, w, h, fontSize, role === "caption" ? 10 : 14, role === "title" ? 1.1 : 1.4), lineHeight: role === "title" ? 1.1 : 1.4, ...style });
}
function slidePalette(theme, variant) {
  const primary = colorHex(theme.colors.accent) || "#506A46";
  const bg = variant === 0 ? primary : variant === 2 ? tint(primary, "#101916", 0.92) : variant === 4 ? tint(primary, "#FFFFFF", 0.93) : theme.colors.bg;
  const ink = contrast(theme.colors.text, bg) >= 4.5 ? theme.colors.text : readableText(bg), dark = readableText(bg) === "#FFFFFF";
  const muted = tint(ink, bg, 0.23);
  return { bg, text: ink, muted: contrast(muted, bg) >= 4.5 ? muted : ink, accent: contrast(bg, primary) >= 4.5 ? primary : ink, card: dark ? tint(bg, "#FFFFFF", 0.08) : "#FFFFFF", line: tint(ink, bg, 0.86), primary };
}
function composeSlide(input, theme, presetId, index = 0, total = 1, brand, variant = index % 5) {
  const preset = COMPOSITIONS.find((item) => item.id === presetId) || COMPOSITIONS[2];
  const slide = copy(input), original = slide.elements;
  const role = (name) => original.find((el) => el.content.kind === "text" && (el.content.role === name || el.position.slot === name));
  const value = (name) => {
    const el = role(name);
    return el?.content.kind === "text" ? el.content.text : "";
  };
  const title = value("title") || slide.label;
  const subtitleRole = value("subtitle") ? "subtitle" : "body";
  const subtitle = value(subtitleRole);
  const cards = original.filter((el) => el.content.kind === "card").slice(0, 6);
  const metricCards = cards.filter((el) => el.content.kind === "card" && el.content.metric);
  const image = original.find((el) => el.content.kind === "image" && el.content.src);
  const chart = original.find((el) => el.content.kind === "chart" && el.content.series.length);
  const palette = slidePalette(theme, variant);
  const elements = [];
  const absorbed = /* @__PURE__ */ new Set();
  const pushTitle = (x = 64, y = 102, w = 1152, h = 130, size = 48) => elements.push(text(title, "title", x, y, w, h, palette.text, size));
  const pushSubtitle = (x = 64, y = 232, w = 1100, h = 80) => {
    if (subtitle) elements.push(text(subtitle, "subtitle", x, y, w, h, palette.muted, 22));
  };
  const pushCard = (card, x, y, w, h, order) => {
    const next = copy(card);
    next.position = { mode: "absolute", x, y, slot: card.position.slot || "card", order };
    next.size = { w, h };
    next.style = { ...next.style, backgroundColor: palette.card, color: readableText(palette.card), borderColor: palette.line, radius: theme.radius.md, fontSize: h < 150 ? 14 : 18, padding: h < 150 ? [16, 16, 16, 16] : [24, 24, 24, 24] };
    if (slide.metadata.storyComposition && next.content.kind === "card") {
      const padding = h < 185 ? 15 : 22;
      next.style.padding = [padding, padding, padding, padding];
      next.style.bodyFontSize = fitFont(next.content.body, w - 2 * padding, h - 2 * padding - 49, 16, 12, 1.4);
      next.content.index = null;
    }
    next.metadata = { ...next.metadata, designed: true };
    elements.push(next);
  };
  const grid = (items, columns, y = 330, height = 270) => {
    const count = Math.min(items.length, columns * 2), rows = Math.max(1, Math.ceil(count / columns)), gap = 22;
    items.slice(0, count).forEach((card, i) => pushCard(card, 64 + i % columns * (1174 / columns), y + Math.floor(i / columns) * ((height + gap) / rows), (1152 - (columns - 1) * gap) / columns, (height - (rows - 1) * gap) / rows, i));
  };
  elements.push(text((value("kicker") || slide.label).toUpperCase(), "kicker", 64, 52, 1e3, 24, palette.accent, 12, { letterSpacing: 2.2 }));
  if (preset.kind === "cover") {
    elements.push(element("shape", { kind: "shape", shape: "rect" }, 64, 128, 64, 7, { backgroundColor: palette.accent, borderWidth: 0 }, { decorative: true }));
    pushTitle(64, 190, image ? 640 : 1100, 235, 78);
    pushSubtitle(66, 455, image ? 620 : 1e3, 100);
    if (image) {
      const next = copy(image);
      next.position = { mode: "absolute", x: 750, y: 150, slot: "media" };
      next.size = { w: 466, h: 420 };
      next.style = { ...next.style, radius: variant === 5 ? 12 : 24 };
      if (variant === 5 && next.content.kind === "image") next.content.fit = "contain";
      elements.push(next);
    }
    if (brand?.logoUrl) elements.push(element("image", { kind: "image", src: brand.logoUrl, alt: `${brand.brandName} logo`, fit: "contain", frame: "none" }, 64, 590, 150, 40, { radius: 0 }, { semantic: "logo" }));
  } else if (preset.kind === "statement" || preset.kind === "quote") {
    pushTitle(80, 150, 1080, subtitle ? 230 : 330, preset.kind === "quote" ? 62 : 72);
    pushSubtitle(84, 428, 960, 120);
    if (cards.length) pushCard(cards[0], 84, 548, 850, 100, 0);
  } else if (preset.kind === "image" && image) {
    if (preset.id === "full-image") {
      const next = copy(image);
      next.position = { mode: "absolute", x: 0, y: 0, slot: "media" };
      next.size = { w: 1280, h: 720 };
      next.style = { radius: 0 };
      next.metadata = { ...next.metadata, decorative: true };
      elements.unshift(next);
      elements.push(element("shape", { kind: "shape", shape: "rect" }, 40, 120, 690, 480, { backgroundColor: palette.bg, radius: 18 }, { decorative: true }));
      pushTitle(72, 160, 620, 210, 58);
      pushSubtitle(74, 390, 600, 130);
    } else {
      pushTitle(64, 140, 580, 200, 54);
      pushSubtitle(66, 360, 560, 110);
      const next = copy(image);
      next.position = { mode: "absolute", x: 730, y: 130, slot: "media" };
      next.size = { w: 486, h: 460 };
      next.style = { ...next.style, radius: theme.radius.lg };
      elements.push(next);
      if (cards[0]) pushCard(cards[0], 64, 500, 580, 120, 0);
    }
  } else if (preset.id === "timeline" && slide.metadata.storyComposition && cards.length) {
    pushTitle(64, 95, 1152, 110, 51);
    elements.push(element("shape", { kind: "shape", shape: "rect" }, 64, 410, 1152, 4, { backgroundColor: palette.accent }, { decorative: true }));
    const width = (1152 - (cards.length - 1) * 20) / cards.length;
    cards.forEach((card, i) => {
      const left = 64 + i * (width + 20), center2 = left + width / 2;
      const above = i % 2 === 0;
      elements.push(element("shape", { kind: "shape", shape: "rect" }, center2 - 1, above ? 376 : 412, 2, 33, { backgroundColor: palette.accent }, { decorative: true }));
      elements.push(element("shape", { kind: "shape", shape: "circle" }, center2 - 9, 403, 18, 18, { backgroundColor: palette.accent }, { decorative: true }));
      pushCard(card, left, above ? 204 : 445, width, 172, i);
    });
  } else if (preset.kind === "diagram" && cards.length) {
    pushTitle();
    pushSubtitle(64, 235, 1120, 70);
    const nodes = cards.slice(0, preset.columns || 4).map((card) => {
      absorbed.add(card.id);
      return { id: card.id, label: card.content.kind === "card" ? card.content.title : "", detail: card.content.kind === "card" ? [card.content.metric, card.content.body].filter(Boolean).join(" \xB7 ") : "" };
    });
    elements.push(element("diagram", { kind: "diagram", layout: preset.id === "architecture" ? "architecture" : /timeline|roadmap/.test(preset.id) ? "timeline" : "process", nodes, edges: nodes.slice(1).map((node, i) => ({ from: nodes[i].id, to: node.id })) }, 64, slide.metadata.storyComposition ? 250 : 340, 1152, slide.metadata.storyComposition ? 350 : 250, { color: readableText(palette.card), backgroundColor: palette.card, borderColor: palette.line }));
  } else if ((preset.id === "landscape" || preset.id === "dashboard") && slide.metadata.storyComposition && cards.length) {
    pushTitle(64, 95, 1152, 110, 51);
    const rows = [[preset.id === "dashboard" ? "Measure" : "Topic", preset.id === "dashboard" ? "Reported figure and context" : "What the sources say"], ...cards.flatMap((card) => {
      if (card.content.kind !== "card") return [];
      absorbed.add(card.id);
      return [[card.content.title, card.content.body]];
    })];
    elements.push(element("table", { kind: "table", headerRow: true, rows }, 64, 232, 1152, 375, { color: readableText(palette.card), backgroundColor: palette.card, fontSize: 17 }));
  } else if (preset.kind === "sources") {
    pushTitle(64, 95, 1120, 100, 52);
    const sources = slide.sources || [];
    if (sources.length) sources.slice(0, 8).forEach((source, i) => elements.push(text(`${String(i + 1).padStart(2, "0")}  ${source.title || source.url}
${source.title ? source.url : ""}`, "body", 64 + i % 2 * 590, 230 + Math.floor(i / 2) * 94, 550, 82, palette.text, 17)));
    else pushSubtitle(64, 260, 1100, 180);
  } else if (preset.kind === "chart" && chart) {
    pushTitle(64, 98, 1120, 110, 48);
    pushSubtitle(64, 215, 1120, 60);
    const alongside = slide.metadata.storyComposition && cards.length;
    const next = copy(chart);
    next.position = { mode: "absolute", x: 64, y: alongside ? 235 : 302 };
    next.size = { w: alongside ? 640 : 1152, h: alongside ? 375 : 320 };
    next.style = { color: readableText(palette.card), backgroundColor: palette.card };
    elements.push(next);
    if (alongside) cards.forEach((card, i) => pushCard(card, 724, 235 + i * (378 / cards.length), 492, 378 / cards.length - 8, i));
  } else if (preset.kind === "split" && cards.length) {
    if (slide.metadata.storyComposition) {
      pushTitle(64, 96, 1120, 118, 54);
      const featured = cards[0];
      const support = cards.slice(1);
      const leftWidth = 550;
      const top = 232;
      const height = 377;
      pushCard(featured, 64, top, leftWidth, height, 0);
      const panel = elements.at(-1);
      if (panel) {
        panel.style.backgroundColor = tint(palette.primary, palette.card, 0.9);
        panel.style.color = readableText(String(panel.style.backgroundColor));
        panel.style.fontSize = 26;
        panel.style.bodyFontSize = 20;
        panel.style.padding = [30, 30, 30, 30];
      }
      const gap = 14;
      const rowHeight = (height - gap * (support.length - 1)) / Math.max(1, support.length);
      support.forEach((card, i) => pushCard(card, 638, top + i * (rowHeight + gap), 578, rowHeight, i + 1));
    } else {
      pushTitle(64, 170, 530, 205, 58);
      pushSubtitle(66, 400, 510, 150);
      cards.slice(0, 3).forEach((card, i) => pushCard(card, 680, 130 + i * 166, 536, 144, i));
    }
  } else if (preset.id === "summary" && slide.metadata.storyComposition && cards.length) {
    pushTitle(64, 96, 1152, 110, 54);
    const gap = 18, width = (1152 - (cards.length - 1) * gap) / cards.length;
    cards.forEach((card, i) => {
      const x = 64 + i * (width + gap);
      elements.push(element("shape", { kind: "shape", shape: "rect" }, x, 232, width, 5, { backgroundColor: palette.primary }, { decorative: true }));
      pushCard(card, x, 250, width, 356, i);
    });
  } else {
    pushTitle(64, 100, 1152, 128, 48);
    pushSubtitle(64, 236, 1100, 70);
    const selected = preset.kind === "metrics" && metricCards.length ? metricCards : cards;
    const columns = slide.metadata.storyComposition && selected.length === 4 ? 2 : Math.min(preset.columns || 2, Math.max(1, selected.length));
    grid(selected, columns, slide.metadata.storyComposition ? 248 : 340, slide.metadata.storyComposition ? 362 : 278);
    if (!selected.length && value("body") && value("body") !== subtitle) elements.push(text(value("body"), "body", 64, 345, 1050, 250, palette.text, 26));
  }
  const sourceHost = slide.sources?.[0]?.url;
  const footer = [
    text(brand?.brandName || "Vistara Studio", "caption", 64, 671, 360, 20, palette.muted, 10),
    ...sourceHost ? [text(sourceHost.replace(/^https?:\/\/(www\.)?/, "").slice(0, 90), "caption", 430, 671, 650, 20, palette.muted, 10, { textAlign: "right" })] : [],
    text(pageNumber(index, total), "caption", 1115, 671, 101, 20, palette.muted, 10, { textAlign: "right" })
  ];
  footer.forEach((el, i) => {
    el.metadata.generatedDecoration = true;
    if (i === footer.length - 1) el.metadata.pageNumber = true;
  });
  const used = new Set(elements.map((el) => el.id));
  for (const el of elements) if (el.content.kind === "text") {
    const contentRole = el.content.role;
    const previous = !["caption", "body"].includes(contentRole) ? role(contentRole === "subtitle" ? subtitleRole : contentRole) : null;
    if (previous && !used.has(previous.id)) {
      el.id = previous.id;
      used.add(previous.id);
    }
  }
  for (const old of original) {
    if (used.has(old.id) || absorbed.has(old.id) || old.metadata.generatedDecoration || old.metadata.designed && (old.metadata.decorative && old.type === "shape" || old.metadata.semantic === "logo")) continue;
    if (!input.composition && old.content.kind === "button" && old.content.href === "#") continue;
    if (input.composition || old.position.mode === "absolute" || !["text", "card", "image"].includes(old.type)) elements.push(old);
  }
  elements.push(...footer);
  return { ...slide, composition: preset.id, background: { type: "solid", value: palette.bg }, elements, metadata: { ...slide.metadata, designVariant: variant, designedV2: true } };
}
var pageNumber = (index, total) => `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
function renumberSlides(spec) {
  let changed = false;
  const slides = spec.slides.map((slide, index) => {
    const value = pageNumber(index, spec.slides.length);
    if (!slide.elements.some((el) => el.metadata.pageNumber && el.content.kind === "text" && el.content.text !== value)) return slide;
    changed = true;
    return { ...slide, elements: slide.elements.map((el) => el.metadata.pageNumber && el.content.kind === "text" ? { ...el, content: { ...el.content, text: value } } : el) };
  });
  return changed ? { ...spec, slides } : spec;
}
function chooseComposition(slide, index, total) {
  if (index === 0 || slide.section === "hero") return "cover";
  if (slide.metadata.referencePage) return "sources";
  const storyComposition = slide.metadata.storyComposition;
  if (typeof storyComposition === "string" && COMPOSITIONS.some((preset) => preset.id === storyComposition)) return storyComposition;
  if (slide.section === "cta" || index === total - 1) return "conclusion";
  if (slide.elements.some((el) => el.content.kind === "chart" && el.content.series.length)) return "data";
  if (slide.elements.some((el) => el.content.kind === "image" && el.content.src)) return index % 2 ? "image-story" : "case-study";
  const map = { workflow: "process", timeline: "timeline", architecture: "architecture", comparison: "comparison-two", differentiation: "comparison-three", metrics: "dashboard", impact: "metric", features: "features", product: "features", services: "features", overview: "overview", market: "market", future: "roadmap", audience: "comparison-three", benefits: "summary" };
  return map[slide.section] || (index % 2 ? "findings" : "overview");
}
function designPresentation(spec, brand, mood = "brand") {
  const next = copy(spec);
  next.brand = copy(brand);
  next.theme = themeFromBrand(brand, mood);
  next.schemaVersion = "presentation.v2";
  next.meta.editorVersion = 2;
  next.slides = next.slides.map((slide, index) => {
    const composition = chooseComposition(slide, index, next.slides.length);
    const restrainedCover = index === 0 && (brand.visualStyle === "minimal" || next.meta.purpose === "product-demo");
    const variant = index > 0 && next.slides.some((item) => item.metadata.storyComposition) ? index % 3 === 0 ? 4 : 1 : index % 5;
    return composeSlide(slide, next.theme, composition, index, next.slides.length, brand, restrainedCover ? 5 : variant);
  });
  return repairDesign(next);
}
function brandForLegacy(name, url, primary) {
  return deriveBrandKit({ name, url, signals: primary && colorHex(primary) ? [{ value: primary, role: "css-primary", sourceUrl: url, method: "Previously saved presentation theme; not a new brand measurement", confidence: 0.4 }] : [] });
}
function inspectDesign(spec) {
  const issues = [], titles = /* @__PURE__ */ new Set();
  for (const slide of spec.slides) {
    const title = slide.elements.find((el) => el.content.kind === "text" && el.content.role === "title");
    const heading = title?.content.kind === "text" ? title.content.text.toLowerCase().trim() : "";
    if (heading && titles.has(heading)) issues.push({ slideId: slide.id, kind: "repetition", message: "Repeated slide title" });
    titles.add(heading);
    const bg = slide.background.type === "solid" ? slide.background.value : spec.theme.colors.bg;
    const content = slide.elements.filter((el) => !el.hidden && !el.metadata.decorative && !["shape", "image"].includes(el.type));
    for (const el of content) {
      const x = el.position.x || 0, y = el.position.y || 0, w = typeof el.size.w === "number" ? el.size.w : 0, h = typeof el.size.h === "number" ? el.size.h : 0;
      if (el.position.mode === "absolute" && (x < 0 || y < 0 || x + w > spec.canvas.width + 1 || y + h > spec.canvas.height + 1)) issues.push({ slideId: slide.id, elementId: el.id, kind: "overflow", message: "Element is outside the slide" });
      if (el.content.kind === "text" && colorHex(el.style.color) && contrast(String(el.style.color), colorHex(el.style.backgroundColor) || bg) < (Number(el.style.fontSize || 16) >= 24 ? 3 : 4.5)) issues.push({ slideId: slide.id, elementId: el.id, kind: "contrast", message: "Text has low contrast" });
      if (el.content.kind === "text" && w && h && fitFont(el.content.text, w, h, Number(el.style.fontSize || 17), 1, Number(el.style.lineHeight || 1.4)) < Number(el.style.fontSize || 17) - 1) issues.push({ slideId: slide.id, elementId: el.id, kind: "overflow", message: "Text may overflow its box" });
    }
    for (let i = 0; i < content.length; i++) for (let j = i + 1; j < content.length; j++) {
      const a = content[i], b = content[j];
      if (a.position.mode !== "absolute" || b.position.mode !== "absolute") continue;
      const width = Math.min((a.position.x || 0) + Number(a.size.w || 0), (b.position.x || 0) + Number(b.size.w || 0)) - Math.max(a.position.x || 0, b.position.x || 0);
      const height = Math.min((a.position.y || 0) + Number(a.size.h || 0), (b.position.y || 0) + Number(b.size.h || 0)) - Math.max(a.position.y || 0, b.position.y || 0);
      if (width > 5 && height > 5) issues.push({ slideId: slide.id, elementId: b.id, kind: "overlap", message: "Content elements overlap" });
    }
  }
  return issues;
}
function repairDesign(spec) {
  const next = copy(spec);
  for (const slide of next.slides) for (const el of slide.elements) {
    if (el.locked || el.metadata.decorative || el.position.mode !== "absolute") continue;
    if (typeof el.size.w === "number") {
      el.size.w = Math.min(el.size.w, next.canvas.width);
      el.position.x = Math.max(0, Math.min(el.position.x || 0, next.canvas.width - el.size.w));
    }
    if (typeof el.size.h === "number") {
      el.size.h = Math.min(el.size.h, next.canvas.height);
      el.position.y = Math.max(0, Math.min(el.position.y || 0, next.canvas.height - el.size.h));
    }
    if (el.content.kind === "text") {
      const bg = colorHex(el.style.backgroundColor) || (slide.background.type === "solid" ? slide.background.value : next.theme.colors.bg);
      if (colorHex(el.style.color) && contrast(String(el.style.color), bg) < 4.5) el.style.color = readableText(bg);
      if (typeof el.size.w === "number" && typeof el.size.h === "number") el.style.fontSize = fitFont(el.content.text, el.size.w, el.size.h, Number(el.style.fontSize || 18), el.content.role === "caption" ? 10 : 12, Number(el.style.lineHeight || 1.4));
    }
  }
  const issues = inspectDesign(next);
  for (const slide of next.slides) slide.validation = { checkedAt: (/* @__PURE__ */ new Date()).toISOString(), score: Math.max(0, 100 - issues.filter((issue) => issue.slideId === slide.id).length * 12), issues: issues.filter((issue) => issue.slideId === slide.id).map((issue) => issue.message) };
  return next;
}
function applyTheme(spec, theme, slideId) {
  const next = copy(spec);
  if (!slideId) next.theme = copy(theme);
  for (const [index, slide] of next.slides.entries()) {
    if (slideId && slide.id !== slideId) continue;
    const oldTheme = { ...spec.theme, ...slide.themeOverride };
    const variant = Number(slide.metadata.designVariant ?? index % 5);
    const before = slidePalette(oldTheme, variant), after = slidePalette(theme, variant);
    if (slideId) slide.themeOverride = { colors: copy(theme.colors), typography: copy(theme.typography) };
    else delete slide.themeOverride;
    if (slide.composition && (slide.background.type === "theme" || slide.background.type === "solid" && colorHex(slide.background.value) === colorHex(before.bg))) {
      slide.background = { type: "solid", value: after.bg };
    }
    const walk = (els) => {
      for (const el of els) {
        if (el.metadata.designed && !el.locked && !el.metadata.customColour) {
          if (el.content.kind === "text") {
            const role = el.content.role;
            const bg = colorHex(el.style.backgroundColor) || (slide.background.type === "solid" ? slide.background.value : theme.colors.bg);
            const color = role === "kicker" ? after.accent : role === "subtitle" || role === "caption" ? after.muted : after.text;
            el.style.color = contrast(color, bg) >= 4.5 ? color : readableText(bg);
          } else if (el.content.kind === "card" || el.content.kind === "diagram" || el.content.kind === "chart") {
            el.style.backgroundColor = after.card;
            el.style.color = readableText(after.card);
            if (el.style.borderColor) el.style.borderColor = after.line;
          }
        }
        if (el.content.kind === "group") walk(el.content.children);
      }
    };
    walk(slide.elements);
  }
  return next;
}

// src/deck-spec/geometry.ts
function elementBox(element2, resolved = {}) {
  return resolved[element2.id] || { x: element2.position.x || 0, y: element2.position.y || 0, w: typeof element2.size.w === "number" ? element2.size.w : 240, h: typeof element2.size.h === "number" ? element2.size.h : 80 };
}
function bounds(boxes) {
  if (!boxes.length) return { x: 0, y: 0, w: 0, h: 0 };
  const x = Math.min(...boxes.map((box) => box.x)), y = Math.min(...boxes.map((box) => box.y));
  return { x, y, w: Math.max(...boxes.map((box) => box.x + box.w)) - x, h: Math.max(...boxes.map((box) => box.y + box.h)) - y };
}
function allElements(elements) {
  return elements.flatMap((element2) => [element2, ...element2.content.kind === "group" ? allElements(element2.content.children) : []]);
}
function selectionBox(slide, ids, resolved = {}) {
  return bounds(allElements(slide.elements).filter((element2) => ids.includes(element2.id)).map((element2) => elementBox(element2, resolved)));
}
function mutate(spec, slideId, work) {
  const next = { ...spec, slides: spec.slides.map((item) => item.id === slideId ? structuredClone(item) : item) }, slide = next.slides.find((item) => item.id === slideId);
  if (slide) work(slide);
  return next;
}
function moveSelection(spec, slideId, ids, dx, dy, resolved = {}) {
  return mutate(spec, slideId, (slide) => {
    const chosen = allElements(slide.elements).filter((element2) => ids.includes(element2.id) && !element2.locked);
    const box = bounds(chosen.map((element2) => elementBox(element2, resolved)));
    dx = Math.max(-box.x, Math.min(spec.canvas.width - box.x - box.w, dx));
    dy = Math.max(-box.y, Math.min(spec.canvas.height - box.y - box.h, dy));
    for (const element2 of chosen) {
      const current = elementBox(element2, resolved);
      element2.position = { ...element2.position, mode: "absolute", x: Math.round(current.x + dx), y: Math.round(current.y + dy) };
      element2.size = { w: current.w, h: current.h };
    }
  });
}
function scaleChildren(element2, sx, sy) {
  if (element2.content.kind !== "group") return;
  for (const child of element2.content.children) {
    child.position.x = (child.position.x || 0) * sx;
    child.position.y = (child.position.y || 0) * sy;
    if (typeof child.size.w === "number") child.size.w *= sx;
    if (typeof child.size.h === "number") child.size.h *= sy;
    if (child.style.fontSize) child.style.fontSize *= Math.min(sx, sy);
    scaleChildren(child, sx, sy);
  }
}
function resizeSelection(spec, slideId, ids, target, resolved = {}) {
  return mutate(spec, slideId, (slide) => {
    const chosen = allElements(slide.elements).filter((element2) => ids.includes(element2.id) && !element2.locked), old = bounds(chosen.map((element2) => elementBox(element2, resolved)));
    const sx = Math.max(0.03, target.w / Math.max(1, old.w)), sy = Math.max(0.03, target.h / Math.max(1, old.h));
    for (const element2 of chosen) {
      const box = elementBox(element2, resolved);
      element2.position = { ...element2.position, mode: "absolute", x: target.x + (box.x - old.x) * sx, y: target.y + (box.y - old.y) * sy };
      element2.size = { w: Math.max(12, box.w * sx), h: Math.max(8, box.h * sy) };
      scaleChildren(element2, sx, sy);
    }
  });
}
var rotatePoint = (x, y, cx, cy, angle) => {
  const rad = angle * Math.PI / 180, dx = x - cx, dy = y - cy;
  return { x: cx + dx * Math.cos(rad) - dy * Math.sin(rad), y: cy + dx * Math.sin(rad) + dy * Math.cos(rad) };
};
function rotateSelection(spec, slideId, ids, degrees, resolved = {}) {
  return mutate(spec, slideId, (slide) => {
    const chosen = allElements(slide.elements).filter((element2) => ids.includes(element2.id) && !element2.locked), box = bounds(chosen.map((element2) => elementBox(element2, resolved)));
    for (const element2 of chosen) {
      const current = elementBox(element2, resolved), point = rotatePoint(current.x + current.w / 2, current.y + current.h / 2, box.x + box.w / 2, box.y + box.h / 2, degrees);
      element2.position = { ...element2.position, mode: "absolute", x: point.x - current.w / 2, y: point.y - current.h / 2 };
      element2.size = { w: current.w, h: current.h };
      element2.rotation = ((element2.rotation || 0) + degrees) % 360;
    }
  });
}
function groupSelection(spec, slideId, ids, resolved = {}) {
  const next = { ...spec, slides: spec.slides.map((item) => item.id === slideId ? structuredClone(item) : item) }, slide = next.slides.find((item) => item.id === slideId);
  if (!slide) return { spec, id: null };
  const chosen = slide.elements.filter((element2) => ids.includes(element2.id) && !element2.locked);
  if (chosen.length < 2) return { spec, id: null };
  const box = bounds(chosen.map((element2) => elementBox(element2, resolved))), id = fallbackId();
  const at = Math.min(...chosen.map((element2) => slide.elements.indexOf(element2)));
  const group = { id, type: "group", position: { mode: "absolute", x: box.x, y: box.y }, size: { w: box.w, h: box.h }, rotation: 0, locked: false, style: {}, animation: { preset: "none", delayMs: 0 }, metadata: {}, content: { kind: "group", children: chosen.map((element2) => {
    const childBox = elementBox(element2, resolved);
    return { ...element2, groupId: id, position: { ...element2.position, mode: "absolute", x: childBox.x - box.x, y: childBox.y - box.y }, size: { w: childBox.w, h: childBox.h } };
  }) } };
  slide.elements = slide.elements.filter((element2) => !chosen.includes(element2));
  slide.elements.splice(at, 0, group);
  return { spec: next, id };
}
function ungroupSelection(spec, slideId, ids) {
  const selected = [];
  const next = mutate(spec, slideId, (slide) => {
    slide.elements = slide.elements.flatMap((group) => {
      if (!ids.includes(group.id) || group.locked || group.content.kind !== "group") return [group];
      const box = elementBox(group);
      return group.content.children.map((child) => {
        const own = elementBox(child), centre = rotatePoint(box.x + own.x + own.w / 2, box.y + own.y + own.h / 2, box.x + box.w / 2, box.y + box.h / 2, group.rotation || 0);
        delete child.groupId;
        child.position = { ...child.position, mode: "absolute", x: centre.x - own.w / 2, y: centre.y - own.h / 2 };
        child.rotation = (child.rotation || 0) + (group.rotation || 0);
        selected.push(child.id);
        return child;
      });
    });
  });
  return { spec: next, ids: selected };
}
function alignSelection(spec, slideId, ids, alignment, resolved = {}) {
  return mutate(spec, slideId, (slide) => {
    const elements = allElements(slide.elements).filter((element2) => ids.includes(element2.id) && !element2.locked), chosen = elements.map((element2) => ({ element: element2, box: elementBox(element2, resolved) }));
    const selection = chosen.length === 1 ? { x: 0, y: 0, w: spec.canvas.width, h: spec.canvas.height } : bounds(chosen.map((item) => item.box));
    if (alignment.startsWith("distribute")) {
      const vertical = alignment.endsWith("y"), axis = vertical ? "y" : "x", size = vertical ? "h" : "w";
      chosen.sort((a, b) => a.box[axis] - b.box[axis]);
      const gap = (selection[size] - chosen.reduce((sum, item) => sum + item.box[size], 0)) / Math.max(1, chosen.length - 1);
      let cursor = selection[axis];
      for (const item of chosen) {
        item.element.position = { ...item.element.position, mode: "absolute", x: item.box.x, y: item.box.y, [axis]: cursor };
        item.element.size = { w: item.box.w, h: item.box.h };
        cursor += item.box[size] + gap;
      }
      return;
    }
    for (const { element: element2, box } of chosen) {
      let { x, y } = box;
      if (alignment === "left") x = selection.x;
      if (alignment === "center") x = selection.x + (selection.w - box.w) / 2;
      if (alignment === "right") x = selection.x + selection.w - box.w;
      if (alignment === "top") y = selection.y;
      if (alignment === "middle") y = selection.y + (selection.h - box.h) / 2;
      if (alignment === "bottom") y = selection.y + selection.h - box.h;
      element2.position = { ...element2.position, mode: "absolute", x, y };
      element2.size = { w: box.w, h: box.h };
    }
  });
}
function duplicateSelection(spec, slideId, ids, resolved = {}) {
  const newIds = [];
  const next = mutate(spec, slideId, (slide) => {
    const chosen = slide.elements.filter((element2) => ids.includes(element2.id));
    for (const original of chosen) {
      const element2 = renewElementIds(original), box = elementBox(original, resolved);
      element2.position = { ...element2.position, mode: "absolute", x: Math.min(1280 - box.w, box.x + 24), y: Math.min(720 - box.h, box.y + 24) };
      element2.size = { w: box.w, h: box.h };
      element2.locked = false;
      slide.elements.push(element2);
      newIds.push(element2.id);
    }
  });
  return { spec: next, ids: newIds };
}
function snapPosition(box, others, canvas, threshold = 6, grid = false) {
  let x = grid ? Math.round(box.x / 8) * 8 : box.x, y = grid ? Math.round(box.y / 8) * 8 : box.y;
  const guides = [];
  const axes = [{ axis: "x", start: x, size: box.w, anchors: [0, canvas.width / 2, canvas.width, ...others.flatMap((other) => [other.x, other.x + other.w / 2, other.x + other.w])] }, { axis: "y", start: y, size: box.h, anchors: [0, canvas.height / 2, canvas.height, ...others.flatMap((other) => [other.y, other.y + other.h / 2, other.y + other.h])] }];
  for (const { axis, start, size, anchors } of axes) {
    let best = threshold + 1, change = 0, anchor = 0;
    for (const candidate of anchors) for (const offset of [0, size / 2, size]) {
      const delta = candidate - start - offset;
      if (Math.abs(delta) < best) {
        best = Math.abs(delta);
        change = delta;
        anchor = candidate;
      }
    }
    if (best <= threshold) {
      if (axis === "x") x += change;
      else y += change;
      guides.push({ axis, value: anchor });
    }
  }
  return { x, y, guides };
}
function flattenElements(elements, origin = { x: 0, y: 0, rotation: 0, cx: 0, cy: 0 }) {
  return elements.filter((element2) => !element2.hidden).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).flatMap((element2) => {
    const box = elementBox(element2), centre = rotatePoint(origin.x + box.x + box.w / 2, origin.y + box.y + box.h / 2, origin.cx, origin.cy, origin.rotation);
    const placed = { ...element2, position: { ...element2.position, mode: "absolute", x: centre.x - box.w / 2, y: centre.y - box.h / 2 }, rotation: (element2.rotation || 0) + origin.rotation };
    if (element2.content.kind !== "group") return [placed];
    return flattenElements(element2.content.children, { x: placed.position.x, y: placed.position.y, cx: centre.x, cy: centre.y, rotation: placed.rotation });
  });
}
function diagramGeometry(content, width, height) {
  if (content.layout === "cycle") {
    const w2 = Math.min(240, width / 3), h2 = Math.min(120, height / 2.5), rx = Math.max(0, width / 2 - w2 / 2 - 8), ry = Math.max(0, height / 2 - h2 / 2 - 8);
    return content.nodes.map((node, i) => ({ ...node, x: width / 2 + rx * Math.cos(-Math.PI / 2 + i * 2 * Math.PI / Math.max(1, content.nodes.length)) - w2 / 2, y: height / 2 + ry * Math.sin(-Math.PI / 2 + i * 2 * Math.PI / Math.max(1, content.nodes.length)) - h2 / 2, w: w2, h: h2 }));
  }
  const count = content.nodes.length, cols = content.layout === "architecture" ? Math.min(3, count) : Math.min(4, count), rows = Math.max(1, Math.ceil(count / Math.max(1, cols))), gap = 30;
  const w = (width - gap * (cols - 1)) / Math.max(1, cols), h = (height - gap * (rows - 1)) / rows;
  return content.nodes.map((node, i) => ({ ...node, x: i % Math.max(1, cols) * (w + gap), y: Math.floor(i / Math.max(1, cols)) * (h + gap), w, h }));
}

// src/deck-spec/evidence.ts
function verifiedChartPoints(claims) {
  const points = [];
  for (const claim of claims) {
    if (!["verified", "supported"].includes(claim.status) || (claim.confidence ?? 0.7) < 0.65 || /\b(target|forecast|expected to|plans? to|could reach|up to)\b/i.test(claim.claim)) continue;
    const url = (claim.source_urls || claim.sourceUrls || []).find((source) => /^https?:\/\//.test(source));
    const match = claim.claim.match(/(?:^|\s)(\d[\d,]*(?:\.\d+)?)\s*(users|customers|attendees|downloads|countries|members|locations|employees|projects|groups|organizations|languages|students|graduates|%)(?=\W|$)/i);
    if (!url || !match) continue;
    const value = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(value)) continue;
    points.push({ claimId: claim.id, label: claim.claim.slice(0, 54).trim(), value, unit: match[2].toLowerCase(), sourceUrl: url });
  }
  return points;
}

// src/deck-spec/proposals.ts
function applyEditorProposal(doc, proposal) {
  let next = doc, focus = proposal.slideId;
  const locate = () => next.slides.findIndex((slide) => slide.id === proposal.slideId);
  if (locate() < 0) return { document: doc, focus };
  for (const op of proposal.operations) {
    const index = locate(), slide = next.slides[index];
    if (op.kind === "rewrite") {
      const element2 = slide.elements.find((el) => el.id === op.elementId);
      if (element2?.content.kind === "text" && !element2.locked && !element2.hidden) {
        next = updateElement(next, slide.id, element2.id, { content: { ...element2.content, text: op.text } });
      }
    } else if (op.kind === "layout" && COMPOSITIONS.some((preset) => preset.id === op.preset)) {
      next = { ...next, slides: next.slides.map((s, i) => i === index ? composeSlide(s, next.theme, op.preset, i, next.slides.length, next.brand, Number(s.metadata.designVariant ?? i % 5)) : s) };
    } else if (op.kind === "theme") {
      const brand = next.brand || brandForLegacy(next.name, next.meta.projectUrl, next.theme.colors.accent);
      next = applyTheme(next, themeFromBrand(brand, op.mood));
    } else if (op.kind === "purpose") {
      const order = op.purpose === "investor" ? ["metrics", "market", "growth", "businessValue", "differentiation", "comparison", "pricing", "overview", "product", "services"] : ["intro", "overview", "problem", "product", "features", "workflow", "impact", "technology", "metrics"];
      const score = (s) => s.section === "hero" ? -2 : s.metadata.referencePage ? 100 : s.section === "cta" ? 99 : order.includes(s.section) ? order.indexOf(s.section) : 50;
      const slides = [...next.slides].sort((a, b) => score(a) - score(b));
      next = renumberSlides({ ...next, meta: { ...next.meta, purpose: op.purpose }, slides });
      const hero = next.slides.find((item) => item.section === "hero");
      const kicker = hero?.elements.find((element2) => element2.content.kind === "text" && element2.content.role === "kicker" && !element2.locked);
      if (hero && kicker) next = updateElement(next, hero.id, kicker.id, { contentText: op.purpose === "investor" ? "INVESTOR BRIEFING" : "COLLEGE PROJECT" });
    } else if (op.kind === "evidence" || op.kind === "chart") {
      const title = op.kind === "chart" ? "Verified figures" : op.title;
      const { spec, newId } = addSlide(next, "overview", title);
      const added = spec.slides.at(-1);
      added.elements = added.elements.slice(0, 1);
      if (op.kind === "evidence") {
        added.sources = op.claims.map((item) => item.source);
        for (const claim of op.claims) {
          const card = makeElement("card");
          card.content = { kind: "card", title: "Research finding", body: claim.text, icon: null, index: null, metric: null };
          card.metadata = { claimId: claim.id, sourceUrl: claim.source.url };
          added.elements.push(card);
        }
      } else {
        added.sources = op.points.map((point) => ({ url: point.sourceUrl, claimId: point.claimId }));
        const chart = makeElement("chart");
        chart.content = { kind: "chart", chart: "bars", series: op.points.map((point) => ({ label: point.label, value: point.value, claimId: point.claimId, sourceUrl: point.sourceUrl })), dataSource: "verified", axisLabel: op.points[0]?.unit, legend: false, showValues: true };
        added.elements.push(chart);
      }
      added.notes = "Evidence from this project\u2019s latest completed research. See slide sources for the original context.";
      const slides = spec.slides.slice(0, -1);
      slides.splice(index + 1, 0, composeSlide(added, spec.theme, op.kind === "chart" ? "data" : "findings", index + 1, spec.slides.length, spec.brand));
      next = renumberSlides({ ...spec, slides });
      focus = newId;
    }
  }
  return { document: next, focus };
}
export {
  COMPOSITIONS,
  LEGACY_SECTION_MAP,
  MOTION_PRESETS,
  SECTIONS,
  SPEC_VERSION,
  addElement,
  addSlide,
  alignSelection,
  allElements,
  applyEditorProposal,
  applyPresetAnimation,
  applyTheme,
  bounds,
  brandForLegacy,
  buildSpecFromSlides,
  chooseComposition,
  cloneSpec,
  colorHex,
  composeSlide,
  contrast,
  defaultMotionSpec,
  defaultThemeSpec,
  deleteElement,
  deleteSlide,
  deriveBrandKit,
  designPresentation,
  diagramGeometry,
  duplicateElement,
  duplicateSelection,
  duplicateSlide,
  elementBox,
  fitFont,
  flattenElements,
  getMotionPreset,
  getRenderableSlides,
  groupSelection,
  inkThemeSpec,
  inspectDesign,
  luminance,
  makeElement,
  motionSpecFromDeck,
  moveElementTo,
  moveSelection,
  fallbackId as newSpecId,
  normalizeElement,
  normalizePresentation,
  patchMotion,
  patchTheme,
  readableText,
  renewElementIds,
  renumberSlides,
  reorderElement,
  reorderSlides,
  repairDesign,
  resizeElementTo,
  resizeSelection,
  resolveMotionPreset,
  rotateSelection,
  selectionBox,
  setMotionPreset,
  slidePalette,
  slideToSpec,
  snapPosition,
  specSlideToRenderable,
  themeFromBrand,
  themeSpecFromDeck,
  tint,
  toCanonicalSection,
  tuneMotion,
  ungroupSelection,
  updateElement,
  updateSlide,
  validatePresentation,
  verifiedChartPoints
};
