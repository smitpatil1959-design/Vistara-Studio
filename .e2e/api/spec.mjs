// api/db-client.js
import { createClient } from "@supabase/supabase-js";

// api/db-wake.js
var PROJECT_REF = process.env.FULLSTACK_PROJECT_REF || "";
var RESTORE_URL = process.env.FULLSTACK_RESTORE_API_URL || "";
var _restoreTriggered = false;
function triggerRestore() {
  if (_restoreTriggered || !PROJECT_REF || !RESTORE_URL) return;
  _restoreTriggered = true;
  fetch(RESTORE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_ref: PROJECT_REF })
  }).catch(() => {
  });
  setTimeout(() => {
    _restoreTriggered = false;
  }, 6e4);
}

// api/db-client.js
var supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    global: {
      fetch: async (url, options) => {
        const res = await fetch(url, options);
        if (!res.ok && res.status >= 500) triggerRestore();
        return res;
      }
    }
  }
);
var db_client_default = supabase;

// src/deck-spec/types.ts
var SPEC_VERSION = "presentation.v1";

// src/deck-spec/validate.ts
var ELEMENT_TYPES = ["text", "image", "icon", "shape", "card", "button", "chart", "video", "group"];
var PRESETS = ["none", "fade", "rise", "slide", "zoom", "stagger", "blur", "scale", "morph"];
var TRANSITIONS = ["fade", "slide", "zoom", "stagger", "none", "morph", "blur"];
var MOTION_PRESET_IDS = ["cinematic", "elegant", "minimal", "futuristic", "energetic", "corporate"];
var MOTION_DIRECTIONS = ["none", "up", "down", "left", "right"];
var MOTION_TRIGGERS = ["onEnter", "onCascade", "onHover", "manual"];
var SECTIONS = ["hero", "intro", "problem", "solution", "features", "workflow", "architecture", "benefits", "technology", "future", "cta", "market", "differentiation", "businessValue", "growth", "implementation", "impact", "custom"];
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

// src/deck-spec/fromSlides.ts
var elId = () => fallbackId();
function themeSpecFromDeck(theme) {
  const base = theme?.skin === "dark" ? inkThemeSpec(defaultThemeSpec()) : defaultThemeSpec();
  return {
    ...base,
    colors: {
      ...base.colors,
      accent: theme?.accent || base.colors.accent,
      accent2: theme?.accent2 || base.colors.accent2
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
    elements.push({
      id: elId(),
      type: "image",
      position: { mode: "flow", slot: "media", order: 0 },
      size: { w: "half", h: 420 },
      content: { kind: "image", src: slide.image_url, alt: slide.title || "slide media", fit: "cover", frame: "browser" },
      style: { radius: 14 },
      animation: { preset: "zoom", delayMs: 180 },
      metadata: {}
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
    section: slide.type || "custom",
    label: slide.custom_label || slide.type || "Section",
    layout: slide.layout || "left",
    background: { type: "theme", value: "" },
    elements,
    transition: slide.animation || "fade",
    metadata: { sort_order: slide.sort_order, position: index }
  };
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

// server/visibility.js
var VISIBILITIES = ["public", "unlisted", "private"];
var DEFAULT_VISIBILITY = "unlisted";
async function getVisibility(supabase2, projectId) {
  const { data } = await supabase2.from("project_visibility").select("visibility").eq("project_id", projectId).maybeSingle();
  const v = data?.visibility;
  return VISIBILITIES.includes(v) ? v : DEFAULT_VISIBILITY;
}
async function ensureDeckAccess(supabase2, req, projectId) {
  const visibility = await getVisibility(supabase2, projectId);
  if (visibility === "private") {
    const token = (req.headers.authorization || "").replace(/^Bearer /i, "");
    if (!token) return { allowed: false, reason: "auth-required", visibility };
    const { data, error } = await supabase2.auth.getUser(token).catch(() => ({ data: null, error: new Error("auth") }));
    if (error || !data?.user) return { allowed: false, reason: "auth-required", visibility };
  }
  return { allowed: true, visibility };
}
async function requireSignedIn(supabase2, req) {
  const token = (req.headers.authorization || "").replace(/^Bearer /i, "");
  if (!token) return null;
  const { data, error } = await supabase2.auth.getUser(token).catch(() => ({ data: null, error: new Error("auth") }));
  if (error || !data?.user) return null;
  return data.user;
}

// api/spec.js
var cors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
};
async function loadSlidesOrdered(projectId) {
  const { data } = await db_client_default.from("slides").select("*").eq("project_id", projectId).order("sort_order", { ascending: true });
  return data || [];
}
async function projectSpecToRows(spec, projectId) {
  const textRole = (s, role) => {
    const el = s.elements.find((e) => e.type === "text" && e.content.kind === "text" && e.content.role === role);
    return el ? el.content.text : null;
  };
  const rows = spec.slides.map((s, i) => {
    const cards = s.elements.filter((e) => e.type === "card" && e.position.slot === "card");
    const stats = s.elements.filter((e) => e.type === "card" && e.position.slot === "stat");
    const media = s.elements.find((e) => e.type === "image" && e.content.kind === "image");
    const kick = s.elements.find((e) => e.type === "text" && e.content.kind === "text" && e.content.role === "kicker");
    return {
      id: s.id,
      project_id: projectId,
      sort_order: (i + 1) * 10,
      type: s.section,
      custom_label: kick ? kick.content.text : s.label,
      title: textRole(s, "title"),
      subtitle: textRole(s, "subtitle"),
      body: textRole(s, "body"),
      bullets: cards.map((c) => c.content.body ? `${c.content.title} \u2014 ${c.content.body}` : c.content.title),
      stats: stats.map((c) => ({ value: c.content.metric || "", label: c.content.title })),
      image_url: media ? media.content.src : null,
      layout: s.layout,
      animation: s.transition,
      theme_override: null
    };
  });
  const { data: existing } = await db_client_default.from("slides").select("id").eq("project_id", projectId);
  const keep = new Set(rows.map((r) => r.id));
  const doomed = (existing || []).map((r) => r.id).filter((id) => !keep.has(id));
  if (doomed.length) await db_client_default.from("slides").delete().in("id", doomed);
  for (const row of rows) {
    const known = (existing || []).some((r) => r.id === row.id);
    if (known) {
      const { id, ...fields } = row;
      await db_client_default.from("slides").update(fields).eq("id", id);
    } else {
      await db_client_default.from("slides").insert(row);
    }
  }
}
async function loadSpecRow(projectId) {
  const { data } = await db_client_default.from("project_specs").select("*").eq("project_id", projectId).maybeSingle();
  return data || null;
}
async function upsertSpec(projectId, spec) {
  const existing = await loadSpecRow(projectId);
  const next = { ...spec, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  if (existing) {
    await db_client_default.from("project_specs").update({ spec: next, version: (existing.version || 1) + 1, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("project_id", projectId);
    return (existing.version || 1) + 1;
  }
  await db_client_default.from("project_specs").insert({ project_id: projectId, spec: next, version: 1 });
  return 1;
}
async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    if (req.method === "GET") {
      const { projectId } = req.query;
      if (!projectId) return res.status(400).json({ error: "projectId required" });
      const access = await ensureDeckAccess(db_client_default, req, projectId);
      if (!access.allowed) return res.status(404).json({ error: "This presentation is private \u2014 sign in to view it." });
      const existing = await loadSpecRow(projectId);
      if (existing) return res.status(200).json(existing);
      const [{ data: project }, slides] = await Promise.all([
        db_client_default.from("projects").select("*").eq("id", projectId).single(),
        loadSlidesOrdered(projectId)
      ]);
      if (!project) return res.status(404).json({ error: "Project not found." });
      if (!slides.length) return res.status(404).json({ error: "No deck generated yet." });
      const { data: intake } = await db_client_default.from("project_intake").select("purpose").eq("project_id", projectId).maybeSingle();
      const spec = buildSpecFromSlides(project, slides, "generated", intake?.purpose || "general");
      const version = await upsertSpec(projectId, spec);
      return res.status(200).json({ project_id: projectId, spec, version, updated_at: (/* @__PURE__ */ new Date()).toISOString(), built: true });
    }
    if (req.method === "POST") {
      const { spec } = req.body || {};
      if (!spec) return res.status(400).json({ error: "spec required" });
      const result = validatePresentation(spec);
      return res.status(result.valid ? 200 : 422).json(result);
    }
    if (req.method === "PUT") {
      if (!await requireSignedIn(db_client_default, req)) return res.status(401).json({ error: "Sign in to save decks." });
      const { projectId, spec } = req.body || {};
      if (!projectId || !spec) return res.status(400).json({ error: "projectId and spec required" });
      const { data: project } = await db_client_default.from("projects").select("id").eq("id", projectId).single();
      if (!project) return res.status(404).json({ error: "Project not found." });
      const normalized = normalizePresentation(spec, { theme: defaultThemeSpec(), motion: defaultMotionSpec() });
      const result = validatePresentation(normalized);
      if (!result.valid) return res.status(422).json(result);
      const version = await upsertSpec(projectId, normalized);
      await projectSpecToRows(normalized, projectId).catch((e) => console.warn("row projection failed:", e.message));
      return res.status(200).json({ valid: true, errors: [], version });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err2) {
    console.error("spec api error:", err2);
    return res.status(500).json({ error: err2.message || "Server error" });
  }
}
export {
  handler as default
};
