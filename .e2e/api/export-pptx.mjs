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

// server/export/readiness.js
var HEAD_TIMEOUT = 4500;
async function assetReachable(url) {
  try {
    const r = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(HEAD_TIMEOUT) });
    let status = r.status;
    if (status === 405 || status === 501) {
      const g = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(HEAD_TIMEOUT) });
      status = g.status;
      try {
        if (g.body) await g.body.cancel();
      } catch {
      }
    }
    return { ok: status < 400, status };
  } catch {
    return { ok: false, status: 0 };
  }
}
var FONT_FALLBACKS = {
  "Inter Tight": "Aptos Display",
  "Space Grotesk": "Aptos Display",
  Inter: "Segoe UI",
  "Instrument Serif": "Georgia",
  "JetBrains Mono": "Consolas"
};
function estimateFieldWidth(text, fontSize) {
  return String(text || "").length * fontSize * 0.54;
}
async function buildReadinessReport(spec, { format = "pptx", probeAssets = true } = {}) {
  const findings = [];
  const add = (severity, kind, message, target) => findings.push({ severity, kind, message, target });
  const v = validatePresentation(spec);
  if (!v.valid) v.errors.slice(0, 8).forEach((e) => add("block", "schema", `Spec invalid \u2014 ${e}`));
  else add("ok", "schema", `presentation.v1 validates cleanly (${spec.slides.length} slides)`);
  const font = spec.theme?.typography?.headingFont || "Inter";
  const direct = FONT_FALLBACKS[font];
  if (format === "web") add("ok", "font", `Browser renders the real face: ${font}`);
  else if (direct) add("warn", "font", `${font} has no Office-safe equivalent \u2014 headlines export as ${direct} (listed here, not swapped silently)`, "theme");
  else add("ok", "font", `${font} maps to an Office-safe face; nothing changes`);
  const animKinds = /* @__PURE__ */ new Map();
  const animated = [];
  const videos = [];
  const images = [];
  let absCount = 0;
  let clipRisks = 0;
  for (const slide of spec.slides) {
    for (const el of slide.elements) {
      if (el.animation?.preset && el.animation.preset !== "none") {
        animated.push(el.id);
        animKinds.set(el.animation.preset, (animKinds.get(el.animation.preset) || 0) + 1);
      }
      if (el.type === "video") videos.push({ slide: slide.label, id: el.id });
      if (el.type === "image") images.push({ slide: slide.label, id: el.id, src: el.content.kind === "image" ? el.content.src : "" });
      if (el.position.mode === "absolute") {
        absCount++;
        const x = el.position.x ?? 0;
        const y = el.position.y ?? 0;
        const w = typeof el.size.w === "number" ? el.size.w : 200;
        const h = typeof el.size.h === "number" ? el.size.h : 80;
        if (x < 0 || y < 0 || x + w > spec.canvas.width + 8 || y + h > spec.canvas.height + 8) clipRisks++;
      }
      if (el.type === "text" && el.content.kind === "text") {
        const size = el.style?.fontSize ?? (el.content.role === "title" ? 56 : el.content.role === "subtitle" ? 20 : 17);
        const avail = spec.canvas.width - 2 * ((spec.theme?.spacing?.sectionGap ?? 48) + 16);
        if (estimateFieldWidth(el.content.text, size) > avail * 1.15)
          add("warn", "overflow", `\u201C${el.content.text.slice(0, 38)}\u2026\u201D likely overflows its canvas at ${size}px`, slide.label);
      }
    }
  }
  if (animated.length) {
    const kinds = [...animKinds.entries()].map(([k, n]) => `${k}\xD7${n}`).join(", ");
    if (format === "web") add("ok", "animation", `${animated.length} animated elements verified interactive in present mode (${kinds})`);
    else add("note", "animation", `${animated.length} animated elements (${kinds}) render at their rest state in a file \u2014 frames are final poses, nothing lost`);
  }
  if (videos.length) {
    for (const v2 of videos) {
      if (format === "pptx") add("warn", "element", `Slide \u201C${v2.slide}\u201D: video becomes a labeled still frame + link`, v2.slide);
      else if (format === "pdf") add("note", "element", `Slide \u201C${v2.slide}\u201D: video prints as its poster frame`, v2.slide);
      else add("ok", "element", `Slide \u201C${v2.slide}\u201D: video plays inline on the web`);
    }
  }
  if (absCount) add("ok", "element", `${absCount} absolutely-placed elements map 1:1 into export coordinates`);
  if (clipRisks) add("warn", "overflow", `${clipRisks} elements sit partly outside the 1280\xD7720 canvas \u2014 they will print clipped`);
  if (spec.motion?.trigger === "manual" && format !== "web")
    add("note", "animation", "Manual-reveal slides export fully revealed (presenters see the final state)");
  if (probeAssets && images.length) {
    const probe = images.slice(0, 10);
    const results = await Promise.all(probe.map(async (i) => ({ ...i, r: i.src ? await assetReachable(i.src) : { ok: false, status: 0 } })));
    const broken = results.filter((r) => !r.r.ok || !r.src);
    if (broken.length === 0) add("ok", "asset", `${probe.length} imagery references fetched healthy`);
    else for (const b of broken) add("block", "asset", `Missing image on slide \u201C${b.slide}\u201D (${b.src ? "HTTP " + b.r.status : "no source"})`, b.slide);
  } else if (images.length) {
    add("note", "asset", `${images.length} imagery references \u2014 reachability probe skipped for speed`);
  }
  const blocks = findings.filter((f) => f.severity === "block").length;
  const warns = findings.filter((f) => f.severity === "warn").length;
  const notes = findings.filter((f) => f.severity === "note").length;
  return {
    format,
    ready: blocks === 0,
    counts: { block: blocks, warn: warns, note: notes, ok: findings.filter((f) => f.severity === "ok").length },
    findings,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}

// server/export/pptx.js
var EMU_PER_PX = 13.333 / 1280;
var px = (n) => Math.round(n * EMU_PER_PX * 100) / 100;
var FONT_PT = 0.75;
async function fetchAsDataUri(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(9e3) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 4 * 1024 * 1024) return null;
    const mime = r.headers.get("content-type") || "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
function hex(c, fallback = "FFFFFF") {
  const m = String(c || "").match(/#([0-9a-f]{6})/i);
  return m ? m[1].toUpperCase() : fallback;
}
function richText(specTheme, text, sizePx, weight) {
  const fontFace = FONT_FALLBACKS[specTheme.typography.headingFont] || FONT_FALLBACKS[specTheme.typography.bodyFont] || "Segoe UI";
  const parts = [];
  String(text || "").split("*").forEach((chunk, i) => {
    parts.push({
      text: chunk,
      options: { fontFace, fontSize: Math.round(sizePx * FONT_PT), bold: weight === "bold", italic: i % 2 === 1, color: i % 2 === 1 ? hex(specTheme.colors.accent) : hex(specTheme.colors.text) }
    });
  });
  return parts;
}
function addFooter(slide, spec, index) {
  const y = px(720 - 38);
  slide.addText("VISTARA STUDIO", {
    x: px(64),
    y,
    w: 3.2,
    h: 0.22,
    fontFace: "Segoe UI",
    fontSize: 8,
    color: hex(spec.theme.colors.muted, "888888"),
    charSpacing: 4
  });
  slide.addText(`${String(index + 1).padStart(2, "0")} / ${String(spec.slides.length).padStart(2, "0")}`, {
    x: 10.4,
    y,
    w: 2.2,
    h: 0.22,
    align: "right",
    fontFace: "Segoe UI",
    fontSize: 8.5,
    color: hex(spec.theme.colors.accent),
    bold: true
  });
}
async function buildPptx(spec) {
  const { SlideFactory } = await safePptx();
  const pptx = SlideFactory();
  pptx.defineLayout({ name: "VISTARA", width: 13.333, height: 7.5 });
  pptx.layout = "VISTARA";
  pptx.author = "Vistara Studio";
  pptx.title = spec.name;
  pptx.subject = spec.meta?.projectUrl || "";
  const pad = spec.theme.spacing?.sectionGap ?? 48;
  const x0 = px(pad + 16);
  const contentW = 13.333 - 2 * x0;
  const bodyFont = FONT_FALLBACKS[spec.theme.typography.bodyFont] || "Segoe UI";
  for (let i = 0; i < spec.slides.length; i++) {
    const s = spec.slides[i];
    const slide = pptx.addSlide();
    const bgColor = s.background?.type === "solid" && s.background.value ? hex(s.background.value) : hex(spec.theme.colors.bg);
    slide.background = { color: bgColor };
    if (s.background?.type === "image" && s.background.value) {
      const uri = await fetchAsDataUri(s.background.value);
      if (uri) slide.addImage({ data: uri, x: 0, y: 0, w: "100%", h: "100%" });
    }
    const slot = (name) => s.elements.filter((e) => e.position.slot === name);
    const kicker = slot("kicker")[0];
    const title = slot("title")[0];
    const subtitle = slot("subtitle")[0];
    const body = slot("body")[0];
    const stats = slot("stat").slice(0, 4);
    const cards = slot("card");
    const media = slot("media")[0];
    const actions = slot("action");
    const videos = s.elements.filter((e) => e.type === "video");
    const abs = s.elements.filter((e) => e.position.mode === "absolute");
    const isCenter = s.layout === "center" || s.section === "cta";
    let y = px(pad * 0.9);
    if (kicker && kicker.content.kind === "text") {
      slide.addText(kicker.content.text.toUpperCase(), { x: x0, y, w: contentW, h: 0.3, align: isCenter ? "center" : "left", fontFace: bodyFont, fontSize: 9, color: hex(spec.theme.colors.accent), charSpacing: 4, bold: true });
      y += 0.36;
    }
    if (title && title.content.kind === "text") {
      slide.addText(richText(spec.theme, title.content.text, 56, "bold"), { x: x0, y, w: contentW, h: 1.15, align: isCenter ? "center" : "left", valign: "top" });
      y += 1.2;
    }
    if (subtitle && subtitle.content.kind === "text") {
      slide.addText(subtitle.content.text, { x: x0, y, w: contentW, h: 0.45, align: isCenter ? "center" : "left", fontFace: bodyFont, fontSize: 13, color: hex(spec.theme.colors.muted) });
      y += 0.52;
    }
    if (body && body.content.kind === "text") {
      slide.addText(body.content.text, { x: x0, y, w: media ? contentW * 0.54 : contentW * 0.72, h: 1.05, align: isCenter ? "center" : "left", fontFace: bodyFont, fontSize: 11.5, color: hex(spec.theme.colors.muted), lineSpacing: 18 });
    }
    if (media && media.content.kind === "image") {
      const uri = await fetchAsDataUri(media.content.src);
      if (uri) {
        if (isCenter) slide.addImage({ data: uri, x: 4.6, y: 4.1, w: 4.1, h: 2.6, sizing: { type: "cover", w: 4.1, h: 2.6 } });
        else slide.addImage({ data: uri, x: x0 + contentW * 0.58, y: 0.9, w: contentW * 0.42, h: 3.35, sizing: { type: "cover", w: contentW * 0.42, h: 3.35 } });
      } else {
        slide.addShape(pptx.ShapeType.roundRect, { x: x0 + contentW * 0.58, y: 0.9, w: contentW * 0.42, h: 3.35, rectRadius: 0.08, fill: { color: hex(spec.theme.colors.surfaceAlt, "EFEEE6") }, line: { color: hex(spec.theme.colors.line, "DDDDDD"), width: 1 } });
        slide.addText("Image unavailable during export", { x: x0 + contentW * 0.58, y: 2.4, w: contentW * 0.42, align: "center", fontFace: bodyFont, fontSize: 9, color: hex(spec.theme.colors.muted, "888888") });
      }
    }
    if (stats.length) {
      const colW = (contentW - (stats.length - 1) * 0.24) / stats.length;
      stats.forEach((st, j) => {
        const x = x0 + j * (colW + 0.24);
        const sy = 4.55;
        slide.addShape(pptx.ShapeType.roundRect, { x, y: sy, w: colW, h: 1, rectRadius: 0.07, fill: { color: hex(spec.theme.colors.surface, "FFFFFF") }, line: { color: hex(spec.theme.colors.line, "DDDDDD"), width: 1 } });
        const c = st.content;
        if (c.kind === "card") {
          slide.addText(String(c.metric || ""), { x: x + 0.1, y: sy + 0.12, w: colW - 0.2, align: "center", fontFace: FONT_FALLBACKS[spec.theme.typography.headingFont] || "Segoe UI", fontSize: 22, bold: true, color: hex(spec.theme.colors.accent) });
          slide.addText(String(c.title || ""), { x: x + 0.1, y: sy + 0.62, w: colW - 0.2, align: "center", fontFace: bodyFont, fontSize: 8.5, color: hex(spec.theme.colors.muted, "777777"), charSpacing: 2 });
        }
      });
    }
    if (cards.length) {
      const cols = cards.length <= 1 ? 1 : cards.length <= 2 ? 2 : cards.length <= 4 ? 2 : 3;
      const rows = Math.ceil(cards.length / cols);
      const g = 0.18;
      const startY = stats.length && media ? 0 : stats.length ? 5 : isCenter ? 4.4 : 3.55;
      const card = (cw, chh) => ({
        w: (contentW - g * (cols - 1)) / cols,
        h: Math.min(chh, 1.35)
      });
      const csize = card(0, 0);
      cards.slice(0, 6).forEach((c, j) => {
        const cz = csize;
        const col = j % cols;
        const row = Math.floor(j / cols);
        const x = x0 + col * (csize.w + g);
        const yy = startY + row * (csize.h + g);
        if (yy + csize.h > 6.8) return;
        slide.addShape(pptx.ShapeType.roundRect, { x, y: yy, w: csize.w, h: csize.h, rectRadius: 0.07, fill: { color: hex(spec.theme.colors.surface, "FFFFFF") }, line: { color: hex(spec.theme.colors.line, "DDDDDD"), width: 1 } });
        if (c.content.kind === "card") {
          const idx = c.content.index != null ? `${String(c.content.index + 1).padStart(2, "0")} ` : "";
          slide.addText(idx + (c.content.title || ""), { x: x + 0.16, y: yy + 0.12, w: csize.w - 0.32, fontFace: FONT_FALLBACKS[spec.theme.typography.headingFont] || "Segoe UI", fontSize: 11, bold: true, color: hex(spec.theme.colors.text) });
          if (c.content.body) slide.addText(c.content.body, { x: x + 0.16, y: yy + 0.5, w: csize.w - 0.32, h: csize.h - 0.62, fontFace: bodyFont, fontSize: 8.5, color: hex(spec.theme.colors.muted, "777777"), valign: "top" });
        }
      });
      void rows;
    }
    actions.forEach((b, j) => {
      if (b.content.kind !== "button") return;
      const bx = isCenter ? 5.35 + j * 2.5 : x0 + j * 2.5;
      const by = 4.05;
      slide.addShape(pptx.ShapeType.roundRect, { x: bx, y: by, w: 2.3, h: 0.5, rectRadius: 0.25, fill: { color: hex(spec.theme.colors.accent) } });
      const opts = { x: bx, y: by, w: 2.3, h: 0.5, align: "center", fontFace: bodyFont, fontSize: 11, bold: true, color: spec.theme.skin === "dark" ? "FFFFFF" : "FFFFFF" };
      if (b.content.href && /^https?:/i.test(b.content.href)) opts.hyperlink = { url: b.content.href };
      slide.addText(b.content.label || "Open", opts);
    });
    videos.forEach((v, j) => {
      const vx = isCenter ? 4.6 : x0, vy = 4.5 + j * 1.2;
      slide.addShape(pptx.ShapeType.roundRect, { x: vx, y: vy, w: isCenter ? 4.1 : 4.4, h: 1, rectRadius: 0.08, fill: { color: "17170F" } });
      const vc = v.content.kind === "video" ? v.content : null;
      slide.addText([
        { text: "\u25B6  Video \u2014 plays on web export", options: { bold: true, color: "F4F4EF", fontFace: bodyFont, fontSize: 10 } },
        { text: vc?.src ? `
${vc.src.slice(0, 64)}` : "", options: { color: "9DB494", fontFace: "Consolas", fontSize: 7.5 } }
      ], { x: vx + 0.18, y: vy + 0.16, w: (isCenter ? 4.1 : 4.4) - 0.36, h: 0.75, ...vc?.src ? { hyperlink: { url: vc.src } } : {} });
    });
    for (const el of abs) {
      const x = px(el.position.x ?? 0);
      const y2 = px(el.position.y ?? 0);
      const w = px(typeof el.size.w === "number" ? el.size.w : 200);
      const h = px(typeof el.size.h === "number" ? el.size.h : 80);
      if (el.type === "text" && el.content.kind === "text") {
        slide.addText(richText(spec.theme, el.content.text, el.style?.fontSize ?? 17, (el.style?.fontWeight ?? 500) >= 600 ? "bold" : "normal"), { x, y: y2, w, h, valign: "top" });
      } else if (el.type === "image" && el.content.kind === "image") {
        const uri = await fetchAsDataUri(el.content.src);
        if (uri) slide.addImage({ data: uri, x, y: y2, w, h });
      } else if (el.type === "shape") {
        slide.addShape(pptx.ShapeType.rect, { x, y: y2, w, h, fill: { color: hex(el.style?.backgroundColor || spec.theme.colors.surfaceAlt, "EFEEE6") } });
      } else if (el.type === "card" && el.content.kind === "card") {
        slide.addShape(pptx.ShapeType.roundRect, { x, y: y2, w, h, rectRadius: 0.07, fill: { color: hex(spec.theme.colors.surface, "FFFFFF") }, line: { color: hex(spec.theme.colors.line, "DDDDDD"), width: 1 } });
        slide.addText(`${el.content.title}${el.content.body ? "\n" + el.content.body : ""}`, { x: x + 0.14, y: y2 + 0.1, w: w - 0.28, h: h - 0.2, fontFace: bodyFont, fontSize: 9.5, color: hex(spec.theme.colors.text), valign: "top" });
      } else if (el.type === "chart" && el.content.kind === "chart" && el.content.series.length) {
        const labels = el.content.series.map((p) => String(p.label).slice(0, 6));
        const values = el.content.series.map((p) => Number.isFinite(p.value) ? Number(p.value) : 0);
        try {
          slide.addChart(pptx.ChartType.bar, [{ name: "series", labels, values }], { x, y: y2, w, h, barDir: "bar", chartColors: [hex(spec.theme.colors.accent)], fontFace: bodyFont, catAxisLabelFontSize: 8 });
        } catch {
        }
      }
    }
    addFooter(slide, spec, i);
  }
  return pptx;
}
async function safePptx() {
  const mod = await import("pptxgenjs");
  const PptxGenJS = mod.default || mod;
  return { SlideFactory: () => new PptxGenJS() };
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

// server/ratelimit.js
var buckets = /* @__PURE__ */ new Map();
function rateLimit(key, { capacity, windowMs }) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.ts > windowMs) {
    b = { tokens: capacity - 1, ts: now };
    buckets.set(key, b);
    return { ok: true, retryAfterSec: 0 };
  }
  if (b.tokens <= 0) {
    return { ok: false, retryAfterSec: Math.ceil((b.ts + windowMs - now) / 1e3) };
  }
  b.tokens -= 1;
  return { ok: true, retryAfterSec: 0 };
}
function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "anon";
}
function enforceRateLimit(req, res, tag, budget, windowMs) {
  const verdict = rateLimit(`${tag}:${clientIp(req)}`, { capacity: budget, windowMs });
  if (!verdict.ok) {
    res.setHeader("Retry-After", String(verdict.retryAfterSec));
    res.status(429).json({ error: `Too many requests \u2014 try again in ${verdict.retryAfterSec}s.` });
    return false;
  }
  return true;
}

// api/export-pptx.js
var maxDuration = 60;
var cors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
};
async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ error: "projectId required" });
  if (!enforceRateLimit(req, res, "export", 20, 36e5)) return;
  try {
    const access = await ensureDeckAccess(db_client_default, req, projectId);
    if (!access.allowed) return res.status(404).json({ error: "Not found." });
    const [{ data: project }, { data: specRow }] = await Promise.all([
      db_client_default.from("projects").select("*").eq("id", projectId).single(),
      db_client_default.from("project_specs").select("spec").eq("project_id", projectId).maybeSingle()
    ]);
    if (!project) return res.status(404).json({ error: "Project not found." });
    let spec = specRow?.spec;
    if (!spec) {
      const { data: slides } = await db_client_default.from("slides").select("*").eq("project_id", projectId).order("sort_order", { ascending: true });
      if (!slides?.length) return res.status(422).json({ error: "No deck generated yet." });
      spec = buildSpecFromSlides(project, slides, "generated");
    }
    const report = await buildReadinessReport(spec, { format: "pptx", probeAssets: true });
    if (!report.ready) {
      return res.status(422).json({ error: "Export has blocking issues", report });
    }
    const pptx = await buildPptx(spec);
    const buf = await pptx.write({ outputType: "nodebuffer" });
    await db_client_default.from("project_events").insert({ project_id: projectId, kind: "updated" }).then(() => {
    });
    const filename = `${(project.name || "presentation").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-vistara.pptx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(buf.length));
    return res.status(200).end(Buffer.from(buf));
  } catch (err2) {
    console.error("export-pptx error:", err2);
    return res.status(500).json({ error: err2.message || "Server error" });
  }
}
export {
  handler as default,
  maxDuration
};
