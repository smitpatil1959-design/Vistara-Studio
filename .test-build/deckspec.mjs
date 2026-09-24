// src/deck-spec/types.ts
var SPEC_VERSION = "presentation.v1";

// src/deck-spec/validate.ts
var ELEMENT_TYPES = ["text", "image", "icon", "shape", "card", "button", "chart", "video", "group"];
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
function validateContent(errors, type, c, path) {
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
      else children.forEach((child, i) => validateElement(errors, child, `${path}.children[${i}]`));
      break;
    }
  }
}
function validateElement(errors, e, path) {
  if (!isObj(e)) return err(errors, path, "element must be an object");
  const el = e;
  if (!isStr(el.id) || !el.id) err(errors, path + ".id", "required");
  if (!el.type || !ELEMENT_TYPES.includes(el.type)) err(errors, path + ".type", `unknown type "${String(el.type)}"`);
  validatePosition(errors, el.position, path + ".position");
  if (!isObj(el.size)) err(errors, path + ".size", "size required");
  if (el.type) validateContent(errors, el.type, el.content, path + ".content");
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
  if (d.schemaVersion !== SPEC_VERSION) err(errors, "schemaVersion", `must be "${SPEC_VERSION}"`);
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
    content: e.content || { kind: "text", text: "", role: "body" },
    style: e.style || {},
    animation: { preset: e.animation?.preset && PRESETS.includes(e.animation.preset) ? e.animation.preset : "fade", delayMs: clampNum(e.animation?.delayMs, 0, 3e3, 0) },
    metadata: isObj(e.metadata) ? e.metadata : {}
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
      projectUrl: clampStr(doc.meta?.projectUrl),
      purpose: clampStr(doc.meta?.purpose, "general"),
      source: doc.meta?.source === "ai-edit" || doc.meta?.source === "manual-edit" ? doc.meta.source : "generated"
    },
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
    metadata: isObj(s.metadata) ? s.metadata : {}
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
function resolveMotionPreset(text) {
  const words = String(text).toLowerCase().match(/[a-z]+/g) || [];
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
function textEl(slot, role, text, order, delayMs) {
  if (!text || !text.trim()) return null;
  return {
    id: elId(),
    type: "text",
    position: { mode: "flow", slot, order },
    size: { w: "auto", h: "auto" },
    content: { kind: "text", text, role },
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
    metadata: { sort_order: slide.sort_order, position: index }
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
  const next = cloneSpec(spec);
  const el = elementOf(next, slideId, elementId);
  if (!el) return spec;
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
  const next = cloneSpec(spec);
  const slide = slideOf(next, slideId);
  const el = slide ? elementOf(next, slideId, elementId) : null;
  if (!slide || !el) return { spec, newId: null };
  const copy = {
    ...JSON.parse(JSON.stringify(el)),
    id: fallbackId(),
    position: {
      ...el.position,
      mode: "absolute",
      x: el.position.mode === "absolute" && typeof el.position.x === "number" ? el.position.x + 18 : 64,
      y: el.position.mode === "absolute" && typeof el.position.y === "number" ? el.position.y + 18 : 64
    }
  };
  copy.metadata = { ...el.metadata, duplicatedFrom: el.id };
  slide.elements.push(copy);
  return { spec: next, newId: copy.id };
}
function deleteElement(spec, slideId, elementId) {
  const next = cloneSpec(spec);
  const slide = slideOf(next, slideId);
  if (!slide) return spec;
  const strip = (els) => els.filter((e) => e.id !== elementId).map((e) => e.content.kind === "group" ? { ...e, content: { ...e.content, children: strip(e.content.children) } } : e);
  slide.elements = strip(slide.elements);
  return next;
}
function reorderElement(spec, slideId, elementId, dir) {
  const next = cloneSpec(spec);
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
      return baseElement("chart", { kind: "chart", chart: "bars", series: [{ label: "Q1", value: 44 }, { label: "Q2", value: 68 }, { label: "Q3", value: 92 }] }, 420, 220);
    case "video":
      return baseElement("video", { kind: "video", src: "", poster: null, muted: true }, 480, 270);
    case "group":
      return baseElement("group", { kind: "group", children: [] }, "auto", "auto");
    default:
      return baseElement("text", { kind: "text", text: "New text", role: "body" }, "auto", "auto");
  }
}
function addElement(spec, slideId, type) {
  const next = cloneSpec(spec);
  const slide = slideOf(next, slideId);
  if (!slide) return { spec, newId: null };
  const el = makeElement(type);
  slide.elements.push(el);
  return { spec: next, newId: el.id };
}
function updateSlide(spec, slideId, patch) {
  const next = cloneSpec(spec);
  const slide = slideOf(next, slideId);
  if (!slide) return spec;
  if (patch.label !== void 0) slide.label = patch.label;
  if (patch.layout !== void 0) slide.layout = patch.layout;
  if (patch.transition !== void 0) slide.transition = patch.transition;
  if (patch.background !== void 0) slide.background = patch.background;
  return next;
}
function addSlide(spec, section, label) {
  const next = cloneSpec(spec);
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
  const next = cloneSpec(spec);
  const i = next.slides.findIndex((s) => s.id === slideId);
  if (i === -1) return { spec, newId: null };
  const copy = JSON.parse(JSON.stringify(next.slides[i]));
  copy.id = fallbackId();
  copy.elements = copy.elements.map((e) => ({ ...e, id: fallbackId() }));
  copy.label = copy.label + " copy";
  copy.metadata = { ...copy.metadata, duplicatedFrom: slideId };
  next.slides.splice(i + 1, 0, copy);
  return { spec: next, newId: copy.id };
}
function deleteSlide(spec, slideId) {
  if (spec.slides.length <= 1) return spec;
  const next = cloneSpec(spec);
  next.slides = next.slides.filter((s) => s.id !== slideId);
  return next;
}
function reorderSlides(spec, from, to) {
  const next = cloneSpec(spec);
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
export {
  LEGACY_SECTION_MAP,
  MOTION_PRESETS,
  SECTIONS,
  SPEC_VERSION,
  addElement,
  addSlide,
  applyPresetAnimation,
  buildSpecFromSlides,
  cloneSpec,
  defaultMotionSpec,
  defaultThemeSpec,
  deleteElement,
  deleteSlide,
  duplicateElement,
  duplicateSlide,
  getMotionPreset,
  getRenderableSlides,
  inkThemeSpec,
  makeElement,
  motionSpecFromDeck,
  moveElementTo,
  fallbackId as newSpecId,
  normalizeElement,
  normalizePresentation,
  patchMotion,
  patchTheme,
  reorderElement,
  reorderSlides,
  resizeElementTo,
  resolveMotionPreset,
  setMotionPreset,
  slideToSpec,
  specSlideToRenderable,
  themeSpecFromDeck,
  toCanonicalSection,
  tuneMotion,
  updateElement,
  updateSlide,
  validatePresentation
};
