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

// server/security.js
var CRAWL_LIMITS = {
  pageLimit: 5,
  // max documents captured per scan
  navTimeoutMs: 12e3,
  // per-navigation timeout
  hopTimeoutMs: 8e3,
  // per redirect-probe timeout
  redirectLimit: 5,
  // max 3xx hops followed
  totalBudgetMs: 45e3,
  // whole-scan hard budget
  maxHtmlBytes: 4 * 1024 * 1024,
  // HTML parsing cap per document
  maxScreenshotBytes: 12e5,
  // re-encode above this
  maxConsoleEntries: 40,
  maxFailedRequests: 40
};
var UA_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; VistaraStudioBot/1.1; +https://vistara.studio/bot)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.5"
};
var BOT_UA = UA_HEADERS["User-Agent"];

// server/browserCrawl.js
import { chromium as pw } from "playwright-core";
import sparticuz from "@sparticuz/chromium";

// server/understanding/service.js
import Ajv from "ajv";

// server/understanding/schema.js
var scopedValue = (required = true) => ({
  type: "object",
  additionalProperties: false,
  required: required ? ["value", "basis", "confidence", "evidence"] : [],
  properties: {
    value: { type: "string", maxLength: 400 },
    basis: { enum: ["fact", "inferred"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    evidence: { type: "array", items: { type: "string", maxLength: 220 }, maxItems: 6 }
  }
});
var scopedList = (maxItems = 8) => ({
  type: "array",
  maxItems,
  items: scopedValue()
});
var UNDERSTANDING_SCHEMA = {
  $id: "understanding.v2",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "identity", "classification", "audience", "purpose", "value", "offering", "technology", "content", "story", "meta"],
  properties: {
    schemaVersion: { const: "understanding.v2" },
    identity: {
      type: "object",
      additionalProperties: false,
      required: ["websiteName", "productName", "tagline"],
      properties: {
        websiteName: scopedValue(),
        productName: scopedValue(),
        tagline: scopedValue()
      }
    },
    classification: {
      type: "object",
      additionalProperties: false,
      required: ["category"],
      properties: {
        category: scopedValue(),
        subcategory: { type: ["string", "null"], maxLength: 80 }
      }
    },
    audience: {
      type: "object",
      additionalProperties: false,
      required: ["primary", "segments"],
      properties: {
        primary: scopedValue(),
        segments: scopedList(4)
      }
    },
    purpose: {
      type: "object",
      additionalProperties: false,
      required: ["primary"],
      properties: {
        primary: scopedValue(),
        callToActionHint: { type: ["string", "null"], maxLength: 140 }
      }
    },
    value: {
      type: "object",
      additionalProperties: false,
      required: ["uniqueSellingPoint", "differentiators"],
      properties: {
        uniqueSellingPoint: scopedValue(),
        differentiators: scopedList(4)
      }
    },
    offering: {
      type: "object",
      additionalProperties: false,
      required: ["keyFeatures", "services", "benefits"],
      properties: {
        keyFeatures: scopedList(7),
        services: scopedList(6),
        benefits: scopedList(5)
      }
    },
    technology: {
      type: "object",
      additionalProperties: false,
      required: ["signals"],
      properties: {
        signals: scopedList(8),
        stackSummary: { type: ["string", "null"], maxLength: 160 }
      }
    },
    content: {
      type: "object",
      additionalProperties: false,
      required: ["importantPages", "keyMessages", "tone"],
      properties: {
        importantPages: {
          type: "array",
          maxItems: 6,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["path", "title", "basis", "evidence"],
            properties: {
              path: { type: "string", maxLength: 120 },
              title: { type: "string", maxLength: 140 },
              basis: { enum: ["fact", "inferred"] },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              evidence: { type: "array", items: { type: "string", maxLength: 220 }, maxItems: 4 }
            }
          }
        },
        keyMessages: scopedList(6),
        tone: scopedValue()
      }
    },
    story: {
      type: "object",
      additionalProperties: false,
      required: ["suggestedNarrative", "sectionArc"],
      properties: {
        suggestedNarrative: scopedValue(),
        sectionArc: { type: "array", maxItems: 14, items: { type: "string", maxLength: 40 } },
        watchouts: { type: "array", maxItems: 4, items: { type: "string", maxLength: 160 } }
      }
    },
    meta: {
      type: "object",
      additionalProperties: false,
      required: ["engine", "attempts", "validated", "generatedAt"],
      properties: {
        engine: { type: "string", maxLength: 60 },
        model: { type: ["string", "null"], maxLength: 60 },
        attempts: { type: "integer", minimum: 1, maximum: 5 },
        validated: { type: "boolean" },
        factShare: { type: "number", minimum: 0, maximum: 1 },
        note: { type: ["string", "null"], maxLength: 240 },
        generatedAt: { type: "string" }
      }
    }
  }
};
var schema_default = UNDERSTANDING_SCHEMA;

// server/understanding/service.js
var ajv = new Ajv({ allErrors: true, coerceTypes: false, removeAdditional: false });
var validate = ajv.compile(schema_default);
function flattenUnderstanding(u) {
  if (!u || typeof u !== "object") return null;
  if (u.schemaVersion !== "understanding.v2") return u;
  const v = (sv) => sv && typeof sv.value === "string" ? sv.value : "";
  const splitPair = (s) => {
    const i = s.indexOf(" \u2014 ");
    return i === -1 ? { name: s, desc: "" } : { name: s.slice(0, i), desc: s.slice(i + 3) };
  };
  return {
    productName: v(u.identity?.productName),
    tagline: v(u.identity?.tagline),
    category: v(u.classification?.category),
    summary: v(u.story?.suggestedNarrative),
    audience: [v(u.audience?.primary), ...(u.audience?.segments || []).map(v)].filter(Boolean),
    businessGoal: v(u.purpose?.primary),
    features: (u.offering?.keyFeatures || []).map((s) => splitPair(v(s))),
    benefits: (u.offering?.benefits || []).map((s) => ({ title: splitPair(v(s)).name, desc: splitPair(v(s)).desc || v(s), metric: "" })),
    usps: [v(u.value?.uniqueSellingPoint), ...(u.value?.differentiators || []).map(v)].filter(Boolean),
    technology: (u.technology?.signals || []).map(v).filter(Boolean),
    tone: v(u.content?.tone),
    host: u.__host || ""
  };
}

// server/engine.js
var CATEGORIES = [
  {
    key: "aiml",
    label: "AI Platform",
    words: ["ai", "artificial intelligence", "machine learning", "llm", "model", "neural", "gpt", "agent", "inference", "generative"],
    audience: ["product teams", "developers", "data teams"],
    goal: "turn AI capability into shipped product",
    problem: [["AI demos impress \u2014 production AI is brutal", "Latency, cost and quality collapse the moment real users arrive."], ["Tooling is fragmented", "Teams stitch together notebooks, scripts and vendor APIs with duct tape."], ["Stakes are invisible", "Without observability, every release is a leap of faith."]],
    workflow: [["Connect", "Plug in your data, prompts or models in minutes."], ["Compose", "Assemble pipelines visually, with evaluation at every step."], ["Ship", "Deploy behind a single endpoint with guardrails on."], ["Observe", "Watch quality, latency and cost in real time."]],
    future: [["Multi-modal support", "From text to voice, vision and video in one pipeline."], ["Agent workflows", "Long-running autonomous tasks with human checkpoints."], ["Private deployments", "Bring the platform inside customer VPCs."], ["Marketplace", "Reusable pipelines and evaluation packs."]]
  },
  {
    key: "devtool",
    label: "Developer Tool",
    words: ["developer", "api", "sdk", "code", "deploy", "git", "cli", "open source", "repository", "build", "runtime", "serverless"],
    audience: ["developers", "engineering teams", "platform teams"],
    goal: "compress the distance between idea and production",
    problem: [["Toolchains eat the week", "Engineers lose days to configuration, yak-shaving and YAML."], ["Feedback loops are glacial", "Slow builds and deploys kill flow state and morale."], ["Best practices rot in wikis", "Standards live in documents nobody opens at 2 a.m."]],
    workflow: [["Install", "One CLI command and the toolchain is live."], ["Develop", "Local-first workflow with instant feedback."], ["Review", "Ship changes through previews your whole team can see."], ["Ship", "Push to production with rollbacks built in."]],
    future: [["AI-assisted workflows", "Codegen and review woven into the CLI."], ["Deeper integrations", "First-class plugins for the tools teams already live in."], ["Team analytics", "DORA metrics without the spreadsheet theater."], ["Self-hosted tier", "Enterprise control plane behind your firewall."]]
  },
  {
    key: "commerce",
    label: "E-Commerce",
    words: ["shop", "cart", "buy", "price", "product", "order", "shipping", "collection", "store", "checkout", "sale"],
    audience: ["online shoppers", "brand loyalists", "gift buyers"],
    goal: "turn casual browsers into repeat buyers",
    problem: [["Choice paralysis is real", "Endless catalogs without guidance kill momentum."], ["Trust must be earned pixel by pixel", "One janky checkout moment and the cart is abandoned."], ["Attention is rented", "Every visit competes with a dozen open tabs."]],
    workflow: [["Discover", "Arrive through story-driven collections, not grids of SKUs."], ["Explore", "Rich product pages with honest detail and proof."], ["Commit", "A checkout so fast it feels like one thought."], ["Return", "Post-purchase care that creates regulars."]],
    future: [["Personalized storefronts", "Homepages assembled per visitor intent."], ["Social commerce", "Shoppable content where the audience already lives."], ["Subscriptions", "Replenishment and membership programs."], ["Global expansion", "Localized currencies, duties and fulfillment."]]
  },
  {
    key: "fintech",
    label: "Fintech",
    words: ["payment", "bank", "finance", "money", "card", "invoice", "billing", "crypto", "invest", "loan", "treasury"],
    audience: ["finance teams", "founders", "operators"],
    goal: "make money movement feel instant and obvious",
    problem: [["Financial ops run on spreadsheets and hope", "Reconciliation by hand guarantees errors and audits."], ["Legacy rails move like it is 1998", "Settlement delays strand working capital."], ["Compliance is a full-time fear", "Regulations shift faster than teams can adapt."]],
    workflow: [["Connect accounts", "Securely link banks, cards and ledgers."], ["Automate flows", "Rules route, approve and reconcile automatically."], ["Monitor", "Dashboards surface cash position in real time."], ["Report", "Auditable exports your accountant will frame."]],
    future: [["Embedded lending", "Underwriting powered by live cash-flow data."], ["Global treasury", "Multi-currency operations in one view."], ["Copilots for finance", "AI that drafts the month-end narrative."], ["Open banking depth", "Richer data as regulations mature."]]
  },
  {
    key: "productivity",
    label: "Productivity Platform",
    words: ["team", "project", "task", "workflow", "collaborate", "plan", "track", "workspace", "calendar", "notes", "docs"],
    audience: ["cross-functional teams", "operators", "project leads"],
    goal: "give teams one calm place where work actually ships",
    problem: [["Work is scattered across ten tabs", "Context evaporates between chat, docs and trackers."], ["Status meetings are the tax", "When tools lie, humans sync by calendar."], ["Process ossifies", "Tools force their religion instead of fitting yours."]],
    workflow: [["Capture", "Get ideas and requests in with zero friction."], ["Organize", "Structure projects your way \u2014 views, not rules."], ["Execute", "Assign, track and unblock in one place."], ["Review", "Progress reports that write themselves."]],
    future: [["AI grooming", "Backlogs triaged and deduplicated automatically."], ["Cross-workspace graph", "Dependencies visualized across teams."], ["Offline-first sync", "Full power on planes and trains."], ["Workflow marketplace", "Community-built templates and automations."]]
  },
  {
    key: "agency",
    label: "Studio & Agency",
    words: ["design", "studio", "agency", "brand", "creative", "portfolio", "case study", "clients", "craft", "award"],
    audience: ["founders", "marketing leaders", "venture-backed teams"],
    goal: "translate ambition into brands people remember",
    problem: [["Great work is invisible without framing", "Case studies must sell the thinking, not just the pixels."], ["Every pitch starts from zero", "No system means reinventing the story each time."], ["Taste is subjective until it is packaged", "Clients buy confidence, shown not claimed."]],
    workflow: [["Discover", "Immerse in the client\u2019s market and mythology."], ["Define", "Strategy and narrative before a single pixel."], ["Design", "Systems, not screens \u2014 identity, motion, voice."], ["Deliver", "Launch support and a handover that sticks."]],
    future: [["Productized services", "Fixed-scope offerings with transparent pricing."], ["Motion-first identity", "Brands built for video-native channels."], ["AI-augmented craft", "Exploration at 10x with a human filter."], ["Venture partnerships", "Skin-in-the-game engagements with startups."]]
  },
  {
    key: "edtech",
    label: "Education",
    words: ["learn", "course", "student", "teach", "class", "lesson", "academy", "school", "curriculum", "tutorial"],
    audience: ["lifelong learners", "students", "career switchers"],
    goal: "make mastery feel addictive instead of arduous",
    problem: [["Courses are where motivation goes to die", "Lecture playlists can\u2019t compete with completion rates of games."], ["Feedback arrives weeks too late", "Without tight loops, errors fossilize."], ["Credentials don\u2019t map to capability", "Employers trust proof of work, not certificates of attendance."]],
    workflow: [["Assess", "Place every learner at the right starting line."], ["Learn", "Interactive lessons with immediate feedback."], ["Practice", "Projects that mirror the real job."], ["Prove", "Portfolio-grade work and verified skill badges."]],
    future: [["Adaptive curricula", "Paths that reshape themselves per learner."], ["AI tutors", "Socratic help available at 3 a.m."], ["Cohort sync", "Live rooms that recreate classroom energy."], ["Hiring pipelines", "Direct bridges from coursework to interviews."]]
  },
  {
    key: "marketing",
    label: "Marketing Platform",
    words: ["marketing", "seo", "campaign", "audience", "growth", "email", "conversion", "analytics", "leads", "brand"],
    audience: ["growth marketers", "founders", "content teams"],
    goal: "make growth a system instead of a scramble",
    problem: [["Attribution is a beautiful lie", "Channels fight for credit while the truth hides."], ["Content velocity can\u2019t keep up", "Every campaign needs ten assets by yesterday."], ["Data lives in silos", "Analytics in one tab, spend in another, truth nowhere."]],
    workflow: [["Plan", "Campaigns mapped to goals, not vibes."], ["Produce", "Asset creation with brand guardrails on."], ["Launch", "Multi-channel publishing from one calendar."], ["Measure", "Incrementality-aware reporting that ends arguments."]],
    future: [["Predictive audiences", "Segments scored before a dollar is spent."], ["Generative variations", "On-brand creative at infinite scale."], ["Journey orchestration", "Cross-channel flows that adapt in-flight."], ["Revenue attribution", "Board-ready proof of marketing\u2019s P&L."]]
  },
  {
    key: "media",
    label: "Media & Publication",
    words: ["news", "article", "story", "magazine", "journal", "editorial", "podcast", "episode", "author", "read"],
    audience: ["curious readers", "subscribers", "industry insiders"],
    goal: "turn attention into a durable relationship",
    problem: [["Feeds devour nuance", "Algorithms reward outrage over insight."], ["Ads taught readers to bounce", "Cluttered pages train skim-and-leave behavior."], ["Loyalty is hard to measure", "Pageviews flatter; they don\u2019t predict renewal."]],
    workflow: [["Pitch", "Editorial calendars tied to audience signals."], ["Craft", "Stories edited for depth and clarity."], ["Publish", "Beautiful reading experiences on every device."], ["Grow", "Newsletters and memberships that compound."]],
    future: [["Audio editions", "Every story narrated for the commute."], ["Member communities", "From readership to fellowship."], ["Personal digests", "AI-curated briefings from trusted voices."], ["Live journalism", "Real-time coverage rooms for big events."]]
  },
  {
    key: "generic",
    label: "Digital Product",
    words: [],
    audience: ["modern teams", "ambitious builders", "discerning customers"],
    goal: "turn a strong idea into an experience people return to",
    problem: [["Attention is the scarcest currency", "Most products get three seconds to make their case."], ["Complexity compounds silently", "Every undecided detail becomes user friction."], ["Stories are told after the fact", "Value stays invisible until someone packages it."]],
    workflow: [["Discover", "Understand the landscape and the audience."], ["Design", "Shape the experience around one clear promise."], ["Build", "Ship with quality visible in every detail."], ["Grow", "Measure what matters and iterate in the open."]],
    future: [["Deeper personalization", "Experiences that adapt to each visitor."], ["Platform expansion", "Adjacent use cases invited by the core."], ["Community layer", "Users connected to each other, not just the product."], ["Intelligence everywhere", "AI quietly removing effort at every step."]]
  }
];
function firstSentence(s, max = 220) {
  if (!s) return "";
  const m = s.match(/^(.{40,}?[.!?])(\s|$)/);
  const out = m ? m[1] : s;
  return out.length > max ? out.slice(0, max).replace(/\s\S*$/, "") + "\u2026" : out;
}
async function executeOps(supabase2, projectId, ops) {
  for (const op of ops) {
    if (op.op === "noop") continue;
    if (op.op === "updateSlide") {
      await supabase2.from("slides").update(op.fields).eq("id", op.id);
    } else if (op.op === "insertSlide") {
      const { id: _omit, ...row } = op.data;
      await supabase2.from("slides").insert(row);
    } else if (op.op === "deleteSlide") {
      await supabase2.from("slides").delete().eq("id", op.id);
    } else if (op.op === "updateProject") {
      if (Object.keys(op.fields).length) await supabase2.from("projects").update(op.fields).eq("id", projectId);
    } else if (op.op === "reorder") {
      for (const u of op.updates) await supabase2.from("slides").update({ sort_order: u.sort_order }).eq("id", u.id);
    } else if (op.op === "regenerate") {
      const { data: fresh } = await supabase2.from("projects").select("*").eq("id", projectId).single();
      await supabase2.from("slides").delete().eq("project_id", projectId);
      const gen = generateSlides(fresh);
      await supabase2.from("slides").insert(gen);
      await supabase2.from("projects").update({ status: "generated" }).eq("id", projectId);
    }
  }
}
var SECTION_ORDER = ["hero", "intro", "problem", "solution", "features", "workflow", "architecture", "benefits", "technology", "future", "cta"];
var PURPOSE_ARCS = {
  college: ["hero", "intro", "problem", "solution", "features", "technology", "implementation", "future"],
  investor: ["hero", "problem", "solution", "market", "differentiation", "businessValue", "growth", "cta"],
  client: ["hero", "problem", "solution", "features", "benefits", "implementation", "cta"],
  "product-demo": ["hero", "solution", "workflow", "features", "impact", "cta"],
  portfolio: ["hero", "intro", "features", "architecture", "impact", "cta"],
  general: SECTION_ORDER
};
function resolveArc(purpose, u) {
  const base = PURPOSE_ARCS[purpose] || SECTION_ORDER;
  if (purpose === "general" && u && u.__storyArc && Array.isArray(u.__storyArc)) {
    const known = /* @__PURE__ */ new Set([...SECTION_ORDER, "market", "differentiation", "businessValue", "growth", "implementation", "impact"]);
    const allowed = u.__storyArc.filter((s) => known.has(s));
    if (allowed.length >= 6) return ["hero", ...allowed.filter((s) => s !== "hero" && s !== "cta"), "cta"];
  }
  return base;
}
function tight(s, max) {
  if (!s) return "";
  let t = String(s).replace(/\b(very|really|just|actually|basically|simply|quite)\s+/gi, "").replace(/\b(lots of|a lot of)\b/gi, "plenty of").replace(/\s{2,}/g, " ").trim();
  const cut = t.split(/(?<=[.!?])\s+/)[0] || t;
  if (cut.length <= max) return cut;
  return cut.slice(0, max).replace(/\s\S*$/, "").replace(/[,;:]$/, "") + "\u2026";
}
function fitSlide(s) {
  return {
    ...s,
    title: tight(s.title, 78),
    subtitle: tight(s.subtitle, 130),
    body: tight(s.body, 230),
    bullets: (s.bullets || []).map((b) => tight(b, 132)),
    stats: (s.stats || []).map((st) => ({ value: tight(st.value, 18), label: tight(st.label, 42) }))
  };
}
function catOf(u) {
  return CATEGORIES.find((c) => c.label === u.category) || CATEGORIES[CATEGORIES.length - 1];
}
function gradLast(title) {
  const words = (title || "").split(/\s+/);
  if (words.length < 2) return `*${title}*`;
  const last = words.pop();
  return `${words.join(" ")} *${last}*`;
}
function buildSlide(type, u, a, au, order, overrides = {}) {
  const cat = catOf(u);
  const num = (n) => String(n).padStart(2, "0");
  const base = { type, sort_order: order, title: "", subtitle: "", body: "", bullets: [], stats: [], image_url: "", layout: "left", animation: "fade", theme_override: null, ...overrides };
  switch (type) {
    case "hero":
      return {
        ...base,
        layout: a.screenshot ? "split" : "center",
        animation: "stagger",
        title: gradLast(u.productName),
        subtitle: u.tagline || `The ${u.category.toLowerCase()} built for ${u.audience[0] || "modern teams"}.`,
        body: u.summary,
        stats: [
          { value: `${au.overall}/100`, label: "Audit score" },
          { value: `${a.pages.length}`, label: "Pages analyzed" },
          { value: `${a.loadMs} ms`, label: "Response time" }
        ],
        image_url: a.screenshot || ""
      };
    case "intro":
      return {
        ...base,
        layout: "split",
        title: gradLast(`Meet ${u.productName}`),
        subtitle: u.category,
        body: u.summary,
        stats: [
          { value: u.category, label: "Category" },
          { value: u.audience.slice(0, 2).join(" & ") || "Modern teams", label: "Built for" },
          { value: u.host, label: "Home ground" }
        ],
        bullets: [`Goal \u2014 ${u.businessGoal}`, `Tone \u2014 ${u.tone}`, `Language \u2014 ${a.language || "en"}`]
      };
    case "problem":
      return {
        ...base,
        layout: "grid",
        animation: "stagger",
        title: gradLast("The problem"),
        subtitle: `Why the status quo fails ${u.audience[0] || "teams"}`,
        body: "Every friction we found in the experience traces back to three structural gaps.",
        bullets: cat.problem.map(([t, d]) => `${t} \u2014 ${d}`)
      };
    case "solution":
      return {
        ...base,
        layout: "split",
        title: gradLast(`The ${u.productName} way`),
        subtitle: firstSentence(u.tagline || "", 110),
        body: `${u.productName} reframes the experience around one promise: ${u.businessGoal}.`,
        bullets: u.usps.map((s) => s)
      };
    case "features":
      return {
        ...base,
        layout: "grid",
        animation: "stagger",
        title: gradLast("What it does"),
        subtitle: "Capabilities, extracted from the live product surface",
        bullets: u.features.slice(0, 6).map((f) => `${f.name} \u2014 ${f.desc || "Core capability of the platform."}`)
      };
    case "workflow":
      return {
        ...base,
        layout: "center",
        animation: "slide",
        title: gradLast("How it works"),
        subtitle: "From first touch to lasting habit",
        bullets: cat.workflow.map(([t, d]) => `${t} \u2014 ${d}`)
      };
    case "architecture": {
      const t = u.technology;
      const pick = (cats, fb) => {
        const m = (a.tech || []).filter((x) => cats.includes(x.category)).map((x) => x.name);
        return (m.length ? m : fb).join(" \xB7 ");
      };
      return {
        ...base,
        title: gradLast("Under the hood"),
        subtitle: "The systems carrying the experience",
        bullets: [
          `Experience layer \u2014 ${pick(["Styling", "Motion", "3D", "CMS"], ["Responsive web", "Design system"])}`,
          `Application layer \u2014 ${pick(["Framework", "Runtime"], [t[0] || "Modern web stack"])}`,
          `Data & delivery \u2014 ${pick(["Hosting", "Infra", "Server"], ["Global CDN", "Edge caching"])}`,
          `Growth & trust \u2014 ${pick(["Analytics", "Payments", "Support"], ["Privacy-first analytics"])}`
        ],
        stats: [
          { value: `${a.sizeKb} KB`, label: "Document weight" },
          { value: `${(a.tech || []).length}`, label: "Technologies detected" }
        ]
      };
    }
    case "benefits": {
      const metrics = u.benefits.filter((b) => b.metric).map((b) => ({ value: b.metric, label: b.title.slice(0, 34) }));
      const base2 = [
        { value: `${au.overall}`, label: "Composite audit score" },
        { value: `${num(a.pages.length)}`, label: "Pages in the experience" },
        { value: `${a.loadMs} ms`, label: "First response" }
      ];
      return {
        ...base,
        layout: "center",
        animation: "stagger",
        title: gradLast("Why it wins"),
        subtitle: "Outcomes, not adjectives",
        body: u.benefits[0] ? u.benefits[0].desc : `Every detail bends toward one outcome: ${u.businessGoal}.`,
        stats: [...metrics, ...base2].slice(0, 4)
      };
    }
    case "technology":
      return {
        ...base,
        title: gradLast("The stack"),
        subtitle: "Detected from the live site",
        body: `${u.productName} runs on a deliberately modern foundation.`,
        bullets: (a.tech || []).map((t) => `${t.name} \u2014 ${t.category}`)
      };
    case "future":
      return {
        ...base,
        animation: "slide",
        title: gradLast("Where it goes next"),
        subtitle: "A roadmap written by the product\u2019s own momentum",
        bullets: cat.future.map(([t, d]) => `${t} \u2014 ${d}`)
      };
    case "cta":
      return {
        ...base,
        layout: "center",
        animation: "zoom",
        title: gradLast(`Experience ${u.productName} live`),
        subtitle: "The best pitch is the product itself",
        body: `Explore ${u.host} \u2014 then bring this story to your next room.`,
        stats: [{ value: u.host, label: "Visit now" }, { value: `${au.overall}/100`, label: "Audit verdict" }]
      };
    case "market":
      return {
        ...base,
        layout: "split",
        title: gradLast("Market position"),
        subtitle: "Measured from the live surface \u2014 not projected",
        body: `${u.productName} operates as a ${(u.category || "product").toLowerCase()} serving ${u.audience.slice(0, 2).join(" and ") || "its audience"}.`,
        bullets: [
          `Primary audience \u2014 ${u.audience[0] || "modern teams"}`,
          `Category position \u2014 ${u.category || "digital product"}`,
          `Adoption surface \u2014 ${a.pages.length} public pages live, ${a.links ? (a.links.probed || []).length + " links verified" : "links verified"}`
        ],
        stats: [
          { value: `${a.pages.length}`, label: "Pages in production" },
          { value: `${(a.tech || []).length}`, label: "Stack signals detected" },
          { value: `${au.overall}/100`, label: "Measured health" }
        ]
      };
    case "differentiation":
      return {
        ...base,
        layout: "grid",
        animation: "stagger",
        title: gradLast("Why it stands apart"),
        subtitle: "Claims kept to what the site itself proves",
        bullets: u.usps.slice(0, 3).map((s2, i) => `${s2.slice(0, 60)} \u2014 ${i === 0 ? "Found on the live site." : "Stated by the product itself."}`)
      };
    case "businessValue": {
      const measured = [
        ...(u.benefits || []).filter((b) => b.metric).map((b) => ({ value: b.metric, label: tight(b.title, 30) })),
        { value: `${au.overall}/100`, label: "Measured audit score" },
        ...au.vitals && au.vitals.lcpMs ? [{ value: `${Math.round(au.vitals.lcpMs)} ms`, label: "Measured LCP (live render)" }] : [{ value: `${a.loadMs} ms`, label: "Measured response" }]
      ];
      return {
        ...base,
        layout: "center",
        animation: "stagger",
        title: gradLast("Business value"),
        subtitle: "Outcomes with receipts attached",
        body: u.benefits && u.benefits[0] ? u.benefits[0].desc : `Every section of this story traces to live measurements or copy the site itself publishes.`,
        stats: measured.slice(0, 4)
      };
    }
    case "growth":
      return {
        ...base,
        animation: "slide",
        title: gradLast("Growth trajectory"),
        subtitle: "What the measured momentum suggests next",
        bullets: cat.future.map(([t, d]) => `${t} \u2014 ${d}`),
        stats: [
          { value: `${au.overall}/100`, label: "Health today (measured)" },
          { value: `${a.pages.length}`, label: "Live pages shipping value" }
        ]
      };
    case "implementation": {
      const t = u.technology || [];
      const pick = (cats, fb) => {
        const m = (a.tech || []).filter((x2) => cats.includes(x2.category)).map((x2) => x2.name);
        return (m.length ? m : fb).join(" \xB7 ");
      };
      return {
        ...base,
        title: gradLast("How it comes together"),
        subtitle: "Implementation \u2014 stack, delivery, operations",
        bullets: [
          `01 Foundation \u2014 ${pick(["Framework", "Runtime"], [t[0] || "Modern web framework"])}`,
          `02 Experience \u2014 ${pick(["Styling", "Motion", "3D"], ["Design system", "Responsive UI"])}`,
          `03 Delivery \u2014 ${pick(["Hosting", "Infra", "Server"], ["CDN edge delivery"])}`,
          `04 Operate \u2014 ${pick(["Analytics", "Payments", "Support"], ["Measured releases"])}`
        ],
        stats: [
          { value: `${(a.tech || []).length}`, label: "Verified stack signals" },
          { value: `${a.sizeKb} KB`, label: "Measured document weight" }
        ]
      };
    }
    case "impact": {
      const nums = [
        ...(u.benefits || []).filter((b) => b.metric).map((b) => ({ value: b.metric, label: tight(b.title, 30) })),
        { value: `${au.overall}`, label: "Composite health (measured)" },
        { value: `${a.pages.length}`, label: "Pages shipped" },
        { value: `${a.loadMs} ms`, label: "First response (measured)" }
      ];
      return {
        ...base,
        layout: "center",
        animation: "stagger",
        title: gradLast("Impact on record"),
        subtitle: "Numbers the crawl could verify",
        body: u.benefits && u.benefits[0] ? u.benefits[0].desc : "",
        stats: nums.slice(0, 4)
      };
    }
    default:
      return {
        ...base,
        type: "custom",
        title: gradLast(overrides.title || "New section"),
        subtitle: overrides.subtitle || u.category,
        body: overrides.body || firstSentence(u.summary || u.tagline, 200),
        bullets: overrides.bullets || u.features.slice(0, 3).map((f) => `${f.name} \u2014 ${f.desc || "Part of the core experience."}`)
      };
  }
}
function generateSlides(project, purpose = "general") {
  const uRaw = project.understanding;
  const u = uRaw && uRaw.schemaVersion === "understanding.v2" ? flattenUnderstanding(uRaw) : uRaw;
  if (uRaw && uRaw.story && Array.isArray(uRaw.story.sectionArc)) u.__storyArc = uRaw.story.sectionArc;
  const a = project.analysis;
  const au = project.audit;
  const arc = resolveArc(purpose, u);
  return arc.map((type, i) => fitSlide(buildSlide(type, u, a, au, (i + 1) * 10, { project_id: project.id })));
}
var SECTION_SYNONYMS = {
  hero: "hero",
  cover: "hero",
  home: "hero",
  landing: "hero",
  title: "hero",
  intro: "intro",
  introduction: "intro",
  about: "intro",
  overview: "intro",
  summary: "intro",
  problem: "problem",
  pain: "problem",
  challenge: "problem",
  challenges: "problem",
  solution: "solution",
  product: "solution",
  answer: "solution",
  feature: "features",
  features: "features",
  capabilities: "features",
  workflow: "workflow",
  process: "workflow",
  steps: "workflow",
  journey: "workflow",
  architecture: "architecture",
  system: "architecture",
  infra: "architecture",
  benefit: "benefits",
  benefits: "benefits",
  value: "benefits",
  outcomes: "benefits",
  why: "benefits",
  tech: "technology",
  technology: "technology",
  stack: "technology",
  future: "future",
  roadmap: "future",
  vision: "future",
  next: "future",
  cta: "cta",
  closing: "cta",
  end: "cta",
  contact: "cta",
  action: "cta",
  testimonial: "testimonials",
  testimonials: "testimonials",
  pricing: "pricing",
  team: "team",
  faq: "faq",
  metrics: "metrics",
  numbers: "metrics",
  social: "testimonials",
  proof: "testimonials"
};
var PALETTE_WORDS = {
  lime: ["#65A30D", "#1A2E05"],
  sage: ["#6B8E5A", "#3E5C3A"],
  violet: ["#7C5CFF", "#22D3EE"],
  purple: ["#A855F7", "#22D3EE"],
  ultraviolet: ["#7C5CFF", "#22D3EE"],
  emerald: ["#10B981", "#A3E635"],
  green: ["#10B981", "#A3E635"],
  forest: ["#34D399", "#FDE68A"],
  azure: ["#3B82F6", "#22D3EE"],
  blue: ["#3B82F6", "#22D3EE"],
  ocean: ["#0EA5E9", "#6366F1"],
  cyan: ["#22D3EE", "#818CF8"],
  teal: ["#14B8A6", "#38BDF8"],
  crimson: ["#F43F5E", "#FB923C"],
  red: ["#F43F5E", "#FB923C"],
  scarlet: ["#EF4444", "#F59E0B"],
  rose: ["#FB7185", "#C084FC"],
  pink: ["#F472B6", "#A78BFA"],
  magenta: ["#E879F9", "#FB7185"],
  gold: ["#F5B453", "#FB7185"],
  amber: ["#F59E0B", "#F97316"],
  copper: ["#F97316", "#FBBF24"],
  orange: ["#FB923C", "#FDE047"],
  mono: ["#E4E4E7", "#71717A"],
  monochrome: ["#E4E4E7", "#71717A"],
  silver: ["#CBD5E1", "#64748B"],
  lime: ["#A3E635", "#34D399"],
  indigo: ["#6366F1", "#38BDF8"]
};
var FORMAL_REPL = [
  [/\bcan't\b/gi, "cannot"],
  [/\bwon't\b/gi, "will not"],
  [/\bdon't\b/gi, "do not"],
  [/\bit's\b/gi, "it is"],
  [/\blet's\b/gi, "let us"],
  [/\bget\b/gi, "obtain"],
  [/\bawesome|amazing\b/gi, "exceptional"],
  [/\bstuff\b/gi, "materials"],
  [/!+/g, "."]
];
var PUNCHY_REPL = [
  [/\b(very|really|just|actually|basically|simply)\s+/gi, ""],
  [/\s+,/g, ","],
  [/!+/g, "."]
];
function shortenText(t, max = 110) {
  if (!t) return t;
  const s = t.split(/(?<=[.!?])\s+/)[0] || t;
  return s.length > max ? s.slice(0, max).replace(/\s\S*$/, "") + "\u2026" : s;
}
function applyRepl(text, repls) {
  let t = text;
  for (const [re, to] of repls) t = (t || "").replace(re, to);
  return t.replace(/\s{2,}/g, " ").trim();
}
function findSlide(slides, kw) {
  if (!kw) return null;
  const key = SECTION_SYNONYMS[kw] || kw;
  return slides.find((s) => s.type === key) || slides.find((s) => (s.title || "").toLowerCase().replace(/\*/g, "").includes(kw.toLowerCase())) || null;
}
var cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function applyCommand(project, slidesIn, rawCmd) {
  const cmd = (rawCmd || "").trim();
  const c = cmd.toLowerCase().replace(/[?.!]+$/, "");
  const ops = [];
  const changes = [];
  let reply = "";
  const slides = [...slidesIn].sort((a, b) => a.sort_order - b.sort_order);
  const theme = { ...project.theme || {} };
  const u = { ...project.understanding || {} };
  const push = (op, msg) => {
    ops.push(op);
    changes.push(msg);
  };
  const targetMatch = c.match(/(?:the\s+)?(hero|cover|intro|introduction|about|overview|problem|pain|solution|product|features?|workflow|process|architecture|system|benefits?|value|outcomes|tech|technology|stack|future|roadmap|cta|closing|testimonials?|pricing|team|faq|metrics)\s+(?:slide|section|page)/);
  const target = targetMatch ? findSlide(slides, targetMatch[1]) : null;
  const tname = target ? (target.title || target.type).replace(/\*/g, "") : null;
  if (/\b(regenerate|start over|start fresh|rebuild|re-roll|from scratch)\b/.test(c)) {
    push({ op: "regenerate" }, "Rebuilt the entire deck from the website understanding");
    reply = "Done \u2014 I regenerated all eleven sections from the current website profile. The canvas is fresh; tell me what to sculpt next.";
    return { ops, changes, reply };
  }
  const undMatch = c.match(/^(?:the\s+)?(audience|tagline|name|product name|goal|mission|category)\s+(?:is|are|=|:)\s+(.+)$/);
  if (undMatch) {
    const key = { "product name": "productName", name: "productName", mission: "businessGoal", goal: "businessGoal" }[undMatch[1]] || undMatch[1];
    const val = cap(undMatch[2].trim());
    const next = { ...u, [key]: key === "audience" ? val.split(/,| and /).map((s) => s.trim()).filter(Boolean) : val };
    push({ op: "updateProject", fields: { understanding: next } }, `Updated ${key} to \u201C${val}\u201D`);
    push({ op: "regenerate" }, "Regenerated the deck against the new profile");
    reply = `Noted \u2014 ${key} is now \u201C${val}\u201D. I regenerated the presentation so every section speaks to that.`;
    return { ops, changes, reply };
  }
  const addMatch = c.match(/(?:^|\b)(?:add|create|insert|include)\s+(?:a\s+|an\s+|the\s+)?([a-z][a-z ]*?)(?:\s+(?:section|slide|page))?(?:\s+(before|after)\s+(?:the\s+)?([a-z]+))?$/) && !/color|colour|animation|motion|contrast|image|photo/.test(c) ? c.match(/(?:^|\b)(?:add|create|insert|include)\s+(?:a\s+|an\s+|the\s+)?([a-z][a-z ]*?)(?:\s+(?:section|slide|page))?(?:\s+(before|after)\s+(?:the\s+)?([a-z]+))?$/) : null;
  if (addMatch && addMatch[1] && addMatch[1].length >= 3) {
    const topic = addMatch[1].replace(/\s+(section|slide|page)$/, "").trim();
    const type = SECTION_SYNONYMS[topic] && !["testimonials", "pricing", "team", "faq", "metrics"].includes(SECTION_SYNONYMS[topic]) ? SECTION_SYNONYMS[topic] : ["testimonials", "pricing", "team", "faq", "metrics"].includes(SECTION_SYNONYMS[topic]) ? SECTION_SYNONYMS[topic] : "custom";
    let after = slides[slides.length - 1];
    if (addMatch[3]) {
      const ref = findSlide(slides, addMatch[3]);
      if (ref) after = ref;
    }
    let order = after ? after.sort_order + 5 : (slides.length + 1) * 10;
    if (addMatch[2] === "before" && after) {
      const prev = slides.filter((s) => s.sort_order < after.sort_order).pop();
      order = prev ? (prev.sort_order + after.sort_order) / 2 : after.sort_order - 5;
    } else if (after) {
      const next = slides.find((s) => s.sort_order > after.sort_order);
      if (next) order = (after.sort_order + next.sort_order) / 2;
    }
    let data;
    if (type === "custom" || ["testimonials", "pricing", "team", "faq", "metrics"].includes(type)) {
      const topicTitle = addMatch[1].replace(/\s+(section|slide|page)$/, "").trim();
      const extras = {
        testimonials: { title: "Loved in the *wild*", bullets: u.usps.map((s2) => s2) },
        pricing: { title: "Simple *pricing*", bullets: ["Starter \u2014 Everything to begin, free while in beta", "Pro \u2014 The full platform for growing teams", "Enterprise \u2014 Security, support and scale on your terms"] },
        team: { title: "The people behind *it*", bullets: u.audience.map((a2) => cap(a2)) },
        faq: { title: "Questions, *answered*", bullets: ["Who is it for? \u2014 " + (u.audience[0] || "Modern teams"), "Why now? \u2014 " + cap(u.businessGoal), "Where do I start? \u2014 " + u.host] },
        metrics: { title: "By the *numbers*", bullets: [] }
      }[type] || {};
      data = buildSlide("custom", u, project.analysis, project.audit, order, {
        project_id: project.id,
        title: extras.title || gradLast(cap(topicTitle)),
        bullets: extras.bullets || void 0,
        layout: type === "metrics" ? "center" : "left"
      });
      data.custom_label = cap(topicTitle);
    } else {
      data = buildSlide(type, u, project.analysis, project.audit, order, { project_id: project.id });
    }
    push({ op: "insertSlide", data }, `Added a \u201C${(data.title || "").replace(/\*/g, "")}\u201D section ${addMatch[2] ? addMatch[2] + " " + (addMatch[3] || "the end") : "at the end"}`);
    reply = `Added. The new \u201C${(data.title || "").replace(/\*/g, "")}\u201D section is live on the canvas \u2014 drag through the rail to review it, or tell me to rewrite any line.`;
    return { ops, changes, reply };
  }
  const rmMatch = c.match(/(?:remove|delete|drop|cut)\s+(?:the\s+)?([a-z]+)(?:\s+(?:section|slide|page))?/);
  if (rmMatch && !/image|photo|picture|color|animation/.test(c)) {
    const slide = findSlide(slides, rmMatch[1]);
    if (slide) {
      push({ op: "deleteSlide", id: slide.id }, `Removed the \u201C${(slide.title || slide.type).replace(/\*/g, "")}\u201D section`);
      reply = `Gone. The \u201C${(slide.title || slide.type).replace(/\*/g, "")}\u201D section has been removed from the deck.`;
      return { ops, changes, reply };
    }
  }
  const mvMatch = c.match(/move\s+(?:the\s+)?([a-z]+)(?:\s+(?:section|slide|page))?\s+(before|after)\s+(?:the\s+)?([a-z]+)/);
  if (mvMatch) {
    const a2 = findSlide(slides, mvMatch[1]);
    const b2 = findSlide(slides, mvMatch[3]);
    if (a2 && b2 && a2.id !== b2.id) {
      const others = slides.filter((s) => s.id !== a2.id);
      const idx = others.findIndex((s) => s.id === b2.id);
      const insertAt = mvMatch[2] === "before" ? idx : idx + 1;
      others.splice(insertAt, 0, a2);
      const updates = others.map((s, i) => ({ id: s.id, sort_order: (i + 1) * 10 }));
      push({ op: "reorder", updates }, `Moved \u201C${(a2.title || a2.type).replace(/\*/g, "")}\u201D ${mvMatch[2]} \u201C${(b2.title || b2.type).replace(/\*/g, "")}\u201D`);
      reply = "Reorder complete \u2014 the narrative now flows the way you asked.";
      return { ops, changes, reply };
    }
  }
  const renMatch = c.match(/(?:rename|retitle)\s+(?:the\s+)?([a-z]+)(?:\s+(?:section|slide|page))?\s+(?:to|as)\s+["']?(.+?)["']?$/) || c.match(/change\s+(?:the\s+)?([a-z]+)(?:\s+(?:section|slide))?\s+title\s+to\s+["']?(.+?)["']?$/);
  if (renMatch) {
    const slide = findSlide(slides, renMatch[1]);
    if (slide) {
      const newTitle = cap(renMatch[2].replace(/\*$/, ""));
      push({ op: "updateSlide", id: slide.id, fields: { title: gradLast(newTitle) } }, `Retitled \u201C${(slide.title || "").replace(/\*/g, "")}\u201D \u2192 \u201C${newTitle}\u201D`);
      reply = `Retitled. It now reads \u201C${newTitle}\u201D \u2014 with the gradient accent on the final word, as always.`;
      return { ops, changes, reply };
    }
  }
  const bag = " " + c.toLowerCase().replace(/[^a-z0-9#]+/g, " ") + " ";
  const hasWord = (...words) => words.some((w) => bag.includes(" " + w + " "));
  const sigPalette = Object.keys(PALETTE_WORDS).find((w) => bag.includes(" " + w + " "));
  const sigHex = c.match(/#(?:[0-9a-f]{3}){1,2}/i);
  const sigFont = hasWord("serif", "editorial") ? "Instrument Serif" : hasWord("mono", "monospace", "terminal") ? "JetBrains Mono" : hasWord("grotesk", "geometric") ? "Space Grotesk" : hasWord("tight", "condensed") ? "Inter Tight" : hasWord("clean", "neutral", "swiss") ? "Inter" : null;
  const sigDark = hasWord("dark", "darker", "midnight", "amoled", "noir");
  const sigLight = hasWord("light", "lighter", "bright", "white", "paper", "daylight", "airy");
  const sigZoom = hasWord("cinematic", "dramatic", "zoom", "theatrical") ? "zoom" : null;
  const sigSnappy = hasWord("snappy", "snappier", "energetic") ? "slide" : null;
  const sigCalm = hasWord("sophisticated", "calm", "gentle", "soft", "subtle") ? "stagger" : null;
  const sweepCount = [sigPalette, sigHex, sigFont, sigDark, sigLight, sigZoom, sigCalm, sigSnappy].filter(Boolean).length;
  if (sweepCount >= 2) {
    const applied = [];
    if (sigPalette) {
      theme.accent = PALETTE_WORDS[sigPalette][0];
      theme.accent2 = PALETTE_WORDS[sigPalette][1];
      applied.push(sigPalette + " palette");
    } else if (sigHex) {
      theme.accent = sigHex[0];
      applied.push("accent " + sigHex[0]);
    }
    if (sigFont) {
      theme.headingFont = sigFont;
      applied.push(sigFont + " headlines");
    }
    const skinTo = sigDark && !sigLight ? "dark" : sigLight ? "light" : null;
    if (skinTo) {
      theme.skin = skinTo;
      applied.push(skinTo === "dark" ? "ink skin" : "paper skin");
    }
    const animTo = sigZoom || sigSnappy || sigCalm;
    if (animTo) {
      theme.motion = sigSnappy && !sigZoom ? "snappy" : "smooth";
      applied.push(animTo === "zoom" ? "cinematic entrances" : animTo === "slide" ? "snappy entrances" : "graceful staggers");
    }
    push({ op: "updateProject", fields: { theme } }, null);
    if (animTo) {
      for (const s of slides) if (s.animation !== "none") push({ op: "updateSlide", id: s.id, fields: { animation: animTo } }, null);
    }
    push({ op: "noop" }, "Restyled deck \u2014 " + applied.join(", "));
    reply = "Full restyle applied: " + applied.join(", ") + ". Take it to Present mode to feel the whole system move together.";
    return { ops, changes, reply };
  }
  if (/\b(darker|dark mode|midnight|black|amoled|noir|dim)\b/.test(c) || /\bdark\b/.test(c) && !/darken/.test(c)) {
    theme.skin = "dark";
    push({ op: "updateProject", fields: { theme } }, "Shifted the deck to a dark skin");
    reply = "Lights off. The deck now sits on deep obsidian with the accent doing all the talking.";
    return { ops, changes, reply };
  }
  if (/\b(light|lighter|bright|white|paper|daylight|light mode)\b/.test(c)) {
    theme.skin = "light";
    push({ op: "updateProject", fields: { theme } }, "Shifted the deck to a light skin");
    reply = "Paper mode. Light surfaces, ink-dark type, same gradient soul.";
    return { ops, changes, reply };
  }
  const hexMatch = c.match(/#([0-9a-f]{6}|[0-9a-f]{3})\b/i);
  const wordMatch = Object.keys(PALETTE_WORDS).find((w) => new RegExp(`\\b${w}\\b`).test(c));
  if (hexMatch || (wordMatch && /color|colour|palette|accent|theme|brand|paint|make it|switch|use|go/.test(c) || Object.keys(PALETTE_WORDS).some((w) => c === w))) {
    const accent = hexMatch ? "#" + hexMatch[1] : PALETTE_WORDS[wordMatch][0];
    const accent2 = hexMatch ? theme.accent2 || "#22D3EE" : PALETTE_WORDS[wordMatch][1];
    theme.accent = accent;
    theme.accent2 = accent2;
    const slideTarget = target;
    if (slideTarget && /only|just|slide|section/.test(c) && /slide|section/.test(c)) {
      push({ op: "updateSlide", id: slideTarget.id, fields: { theme_override: { accent, accent2 } } }, `Painted \u201C${tname}\u201D with accent ${accent}`);
      reply = `Done \u2014 only \u201C${tname}\u201D wears the new accent. The rest of the deck keeps its palette.`;
    } else {
      push({ op: "updateProject", fields: { theme } }, `Recolored the deck around ${accent}`);
      reply = `New palette locked in around ${accent}${hexMatch ? "" : ` with ${accent2} as its duet partner`}. Every gradient, glow and highlight just changed key.`;
    }
    return { ops, changes, reply };
  }
  {
    const bag2 = " " + c.toLowerCase().replace(/[^a-z0-9#]+/g, " ") + " ";
    const PRESET_WORDS = ["cinematic", "futuristic", "corporate", "energetic", "elegant", "minimal", "minimalist"];
    const found = PRESET_WORDS.find((w) => bag2.includes(" " + w + " "));
    const soft = !found && /(like a movie|hollywood|blockbuster|film-like)/.test(bag2) ? "cinematic" : null;
    const presetId = (found === "minimalist" ? "minimal" : found) || soft;
    const hasMotionContext = /motion|anim|transition|preset|entrance|tempo|pace|vibe|energy|cinematic|futuristic|corporate|energetic|minimal|minimalist/.test(bag2);
    if (presetId && hasMotionContext && !/serif|font|typeface|typography|headline/.test(bag2)) {
      const PRESET_CHOICE = {
        cinematic: { entrance: "blur", motion: "cinematic", transition: "morph", dur: 900, stagger: 130 },
        elegant: { entrance: "rise", motion: "elegant", transition: "fade", dur: 780, stagger: 110 },
        minimal: { entrance: "fade", motion: "minimal", transition: "fade", dur: 340, stagger: 60 },
        futuristic: { entrance: "slide", motion: "futuristic", transition: "slide", dur: 460, stagger: 70 },
        energetic: { entrance: "scale", motion: "energetic", transition: "zoom", dur: 320, stagger: 65 },
        corporate: { entrance: "fade", motion: "corporate", transition: "fade", dur: 520, stagger: 90 }
      }[presetId];
      theme.motion = PRESET_CHOICE.motion;
      theme.motionPreset = presetId;
      changes.length = 0;
      push({ op: "updateProject", fields: { theme } }, `Motion preset \u201C${presetId}\u201D applied end to end`);
      for (const s of slides) push({ op: "updateSlide", id: s.id, fields: { animation: PRESET_CHOICE.entrance } }, null);
      reply = `Motion is now ${presetId}: ${PRESET_CHOICE.dur}ms entrances, ${PRESET_CHOICE.stagger}ms cadence, ${PRESET_CHOICE.transition === "morph" ? "morph-like" : PRESET_CHOICE.transition} section transitions. Present mode will feel it immediately.`;
      return { ops, changes, reply };
    }
  }
  if (/\b(serif|editorial|elegant|fashion|luxury)\b/.test(c)) {
    theme.headingFont = "Instrument Serif";
    push({ op: "updateProject", fields: { theme } }, "Set headlines in Instrument Serif");
    reply = "Headlines now carry an editorial serif \u2014 sharp, literary, expensive. Body copy stays neutral for contrast.";
    return { ops, changes, reply };
  }
  if (/\b(grotesk|modern|bold|brutal|swiss|space)\b/.test(c) && /font|type|headline|typography|make it/.test(c)) {
    theme.headingFont = "Space Grotesk";
    push({ op: "updateProject", fields: { theme } }, "Set headlines in Space Grotesk");
    reply = "Space Grotesk is back on headlines \u2014 engineered, geometric, confident.";
    return { ops, changes, reply };
  }
  if (/\b(mono|monospace|terminal|code|hacker)\b/.test(c) && /font|type|headline|typography|make it/.test(c)) {
    theme.headingFont = "JetBrains Mono";
    push({ op: "updateProject", fields: { theme } }, "Set headlines in JetBrains Mono");
    reply = "Monospace headlines engaged. The deck now reads like a beautifully typeset terminal.";
    return { ops, changes, reply };
  }
  if (/\b(clean|neutral|inter|minimal)\b/.test(c) && /font|type|headline|typography|make it/.test(c)) {
    theme.headingFont = "Inter";
    push({ op: "updateProject", fields: { theme } }, "Set headlines in Inter");
    reply = "Inter everywhere \u2014 quiet, neutral, lets the content hold the room.";
    return { ops, changes, reply };
  }
  if (/no animation|disable animation|remove animation|stop animation|static/.test(c)) {
    for (const s of slides) push({ op: "updateSlide", id: s.id, fields: { animation: "none" } }, null);
    push({ op: "updateProject", fields: { theme: { ...theme, motion: "calm" } } }, "Disabled all slide animations");
    changes.pop();
    changes.push("Disabled all slide animations");
    reply = "Motion off. The deck now presents itself with pure stillness.";
    return { ops, changes, reply };
  }
  if (/\b(snappy|snappier|faster|quick|energetic)\b/.test(c) && /anim|motion|transition|feel|make it/.test(c)) {
    theme.motion = "snappy";
    for (const s of slides) if (s.animation !== "none") push({ op: "updateSlide", id: s.id, fields: { animation: "slide" } }, null);
    push({ op: "updateProject", fields: { theme } }, "Motion tuned to snappy slide-ins");
    reply = "Snappy mode: every section now enters with a quick lateral glide. Present to feel it.";
    return { ops, changes, reply };
  }
  if (/\b(calm|gentle|slow|soft|subtle|elegant motion)\b/.test(c) && /anim|motion|transition|feel|make it/.test(c)) {
    theme.motion = "calm";
    for (const s of slides) if (s.animation !== "none") push({ op: "updateSlide", id: s.id, fields: { animation: "fade" } }, null);
    push({ op: "updateProject", fields: { theme } }, "Motion slowed to calm fades");
    reply = "Calm fades throughout. Nothing arrives loudly anymore \u2014 it simply appears, sure of itself.";
    return { ops, changes, reply };
  }
  if (/\b(dramatic|cinematic|zoom)\b/.test(c) && /anim|motion|transition|feel|make it/.test(c)) {
    theme.motion = "smooth";
    for (const s of slides) if (s.animation !== "none") push({ op: "updateSlide", id: s.id, fields: { animation: "zoom" } }, null);
    push({ op: "updateProject", fields: { theme } }, "Motion set to dramatic zoom entrances");
    reply = "Cinematic zoom on every entrance. Present mode is where this shines \u2014 take it for a spin.";
    return { ops, changes, reply };
  }
  const layMatch = c.match(/\b(center|centered|centred|split|grid|left|magazine)\b.*\b(layout|align|arrange|compose)/) || c.match(/\b(?:layout|align)\s+(?:to\s+)?(center|centered|centred|split|grid|left)/);
  if (layMatch) {
    let layout = layMatch[1].replace(/centered|centred/, "center").replace("magazine", "split");
    const scopeAll = /\ball\b|every|each/.test(c);
    const slide = target;
    if (slide && !scopeAll) {
      push({ op: "updateSlide", id: slide.id, fields: { layout } }, `Set \u201C${tname}\u201D to a ${layout} layout`);
      reply = `\u201C${tname}\u201D now uses the ${layout} composition.`;
    } else {
      for (const s of slides) if (s.type !== "hero" && s.type !== "cta") push({ op: "updateSlide", id: s.id, fields: { layout } }, null);
      push({ op: "updateProject", fields: {} }, `Applied ${layout} layouts across the deck`);
      ops.pop();
      ops.push({ op: "noop" });
      reply = `The whole deck now breathes in ${layout} compositions (hero and closer keep their stage).`;
    }
    return { ops, changes, reply };
  }
  if (/\b(shorten|condense|simplify|tighten|trim|shorter|less text|tl;dr)\b/.test(c)) {
    const scope = target ? [target] : slides;
    for (const s of scope) {
      const fields = {};
      if (s.body) fields.body = shortenText(s.body, 120);
      if (s.subtitle) fields.subtitle = shortenText(s.subtitle, 80);
      if (Array.isArray(s.bullets) && s.bullets.length > 4) fields.bullets = s.bullets.slice(0, 4);
      if (Array.isArray(s.bullets)) {
        fields.bullets = (fields.bullets || s.bullets).map((b) => {
          const [t1, d1] = b.split(" \u2014 ");
          return d1 ? `${shortenText(t1, 40)} \u2014 ${shortenText(d1, 70)}` : shortenText(b, 72);
        });
      }
      push({ op: "updateSlide", id: s.id, fields }, null);
    }
    push({ op: "noop" }, target ? `Condensed \u201C${tname}\u201D` : "Condensed copy across the deck");
    reply = target ? `\u201C${tname}\u201D is now espresso-strength \u2014 same flavor, none of the water.` : "I tightened every section: one-sentence bodies, four-bullet ceilings, no filler.";
    return { ops, changes, reply };
  }
  if (/\b(expand|elaborate|longer|more detail|flesh out|richer)\b/.test(c)) {
    const scope = target ? [target] : slides.filter((s) => ["intro", "solution", "custom"].includes(s.type));
    for (const s of scope) {
      const add = firstSentence(u.benefits[0]?.desc || u.summary || u.tagline, 160);
      const fields = { body: [s.body, !s.body || !s.body.includes(add) ? add : ""].filter(Boolean).join(" ") };
      push({ op: "updateSlide", id: s.id, fields }, null);
    }
    push({ op: "noop" }, target ? `Expanded \u201C${tname}\u201D with supporting detail` : "Deepened the narrative sections");
    reply = "Expanded. I wove the product\u2019s strongest outcome statements into the narrative for substance over acreage.";
    return { ops, changes, reply };
  }
  if (/\b(more formal|professional|boardroom|executive|corporate)\b/.test(c)) {
    for (const s of slides) {
      push({ op: "updateSlide", id: s.id, fields: { title: applyRepl(s.title, FORMAL_REPL), subtitle: applyRepl(s.subtitle, FORMAL_REPL), body: applyRepl(s.body, FORMAL_REPL) } }, null);
    }
    push({ op: "noop" }, "Rewrote copy in an executive register");
    reply = "Suited up. Contractions resolved, exclamation points dismissed \u2014 the deck now speaks boardroom.";
    return { ops, changes, reply };
  }
  if (/\b(punchy|punchier|bolder|louder|aggressive|edgier)\b/.test(c)) {
    for (const s of slides) {
      const fields = { body: applyRepl(s.body ? shortenText(s.body, 140) : s.body, PUNCHY_REPL), subtitle: applyRepl(s.subtitle, PUNCHY_REPL) };
      push({ op: "updateSlide", id: s.id, fields }, null);
    }
    push({ op: "noop" }, "Punched up the copy");
    reply = "Sharpened. Qualifiers deleted, sentences cut to fighting weight. The deck hits first and explains later.";
    return { ops, changes, reply };
  }
  const imgMatch = c.match(/(https?:\/\/\S+\.(?:png|jpe?g|webp|gif)(?:\?\S*)?)/i);
  if (imgMatch && /image|photo|picture|screenshot|visual/.test(c)) {
    const slide = target || findSlide(slides, "hero");
    if (slide) {
      push({ op: "updateSlide", id: slide.id, fields: { image_url: imgMatch[1], layout: slide.type === "hero" ? "split" : slide.layout } }, `Set a new image on \u201C${(slide.title || slide.type).replace(/\*/g, "")}\u201D`);
      reply = `Image placed on \u201C${(slide.title || slide.type).replace(/\*/g, "")}\u201D.`;
      return { ops, changes, reply };
    }
  }
  if (/remove (the )?image/.test(c)) {
    const slide = target || findSlide(slides, "hero");
    if (slide) {
      push({ op: "updateSlide", id: slide.id, fields: { image_url: "" } }, `Removed the image from \u201C${(slide.title || slide.type).replace(/\*/g, "")}\u201D`);
      reply = "Image removed \u2014 typography carries the section now.";
      return { ops, changes, reply };
    }
  }
  if (/use (the )?screenshot/.test(c) && target) {
    push({ op: "updateSlide", id: target.id, fields: { image_url: (project.analysis || {}).screenshot || "" } }, `Placed the site screenshot on \u201C${tname}\u201D`);
    reply = `The captured screenshot now anchors \u201C${tname}\u201D.`;
    return { ops, changes, reply };
  }
  reply = [
    "I can reshape this deck however you like. Try:",
    "\xB7 \u201CSwitch to an emerald palette\u201D or \u201Cmake it paper light\u201D",
    "\xB7 \u201CSerif headlines\u201D \xB7 \u201Csnappier motion\u201D",
    "\xB7 \u201CAdd a pricing section after benefits\u201D \xB7 \u201CRemove the workflow slide\u201D",
    "\xB7 \u201CShorten the problem slide\u201D \xB7 \u201CMake the copy more formal\u201D",
    "\xB7 \u201CMove technology before features\u201D \xB7 \u201CRename cta to Let\u2019s build\u201D"
  ].join("\n");
  return { ops, changes, reply };
}

// server/aiDirector.js
var ALLOWED_SLIDE_FIELDS = /* @__PURE__ */ new Set(["title", "subtitle", "body", "bullets", "stats", "image_url", "layout", "animation", "theme_override", "sort_order", "custom_label"]);
var ALLOWED_THEME_FIELDS = /* @__PURE__ */ new Set(["skin", "accent", "accent2", "headingFont", "bodyFont", "motion", "radius"]);
function validateOps(ops, slides) {
  const valid = [];
  const dropped = [];
  const ids = new Set(slides.map((s) => s.id));
  let slideWrites = 0;
  let themeWrites = 0;
  for (const op of ops) {
    const out = { ...op };
    if (out.op === "noop") continue;
    if (out.op === "updateSlide" || out.op === "deleteSlide") {
      if (!ids.has(out.id)) {
        dropped.push({ op: out.op, reason: "target slide missing" });
        continue;
      }
      if (out.op === "updateSlide") {
        const fields = Object.keys(out.fields || {});
        const bad = fields.filter((f) => !ALLOWED_SLIDE_FIELDS.has(f));
        if (bad.length) {
          dropped.push({ op: out.op, reason: "outside editable contract", fields: bad });
          for (const f of bad) delete out.fields[f];
        }
        if (out.fields && typeof out.fields.layout === "string" && !["left", "center", "split", "grid"].includes(out.fields.layout)) {
          dropped.push({ op: out.op, reason: "unknown layout", value: out.fields.layout });
          out.fields.layout = "left";
        }
        if (out.fields && typeof out.fields.animation === "string" && !["fade", "stagger", "slide", "zoom", "none"].includes(out.fields.animation)) {
          dropped.push({ op: out.op, reason: "unknown animation", value: out.fields.animation });
          out.fields.animation = "fade";
        }
        slideWrites++;
      }
    }
    if (out.op === "insertSlide") {
      if (slideWrites > 4) {
        dropped.push({ op: out.op, reason: "turn budget exceeded (max 4 section writes)" });
        continue;
      }
      slideWrites++;
    }
    if (out.op === "updateProject" && out.fields?.theme) {
      themeWrites++;
      if (themeWrites > 1) {
        dropped.push({ op: out.op, reason: "duplicate theme write collapsed" });
        continue;
      }
      const theme = { ...out.fields.theme };
      for (const k of Object.keys(theme)) if (!ALLOWED_THEME_FIELDS.has(k)) delete theme[k];
      out.fields = { ...out.fields, theme };
    }
    if (out.op === "reorder" && Array.isArray(out.updates)) {
      out.updates = out.updates.filter((u) => ids.has(u.id) && typeof u.sort_order === "number");
      if (!out.updates.length) {
        dropped.push({ op: out.op, reason: "nothing left to reorder" });
        continue;
      }
    }
    valid.push(out);
  }
  return { valid, dropped };
}
function describeOp(op, slides, project) {
  const titleOf = (id) => {
    const s = slides.find((x) => x.id === id);
    const t = (s?.title || s?.custom_label || s?.type || "").replace(/\*/g, "");
    return t ? `"${t.slice(0, 46)}"` : "section";
  };
  switch (op.op) {
    case "updateProject": {
      if (op.fields?.theme) {
        const t = op.fields.theme;
        const parts = [];
        if (t.accent) parts.push(`accent ${t.accent}`);
        if (t.skin) parts.push(`${t.skin} skin`);
        if (t.headingFont) parts.push(`${t.headingFont} headlines`);
        if (t.motion) parts.push(`${t.motion} motion`);
        return { icon: "palette", label: "Restyled theme", detail: parts.join(" \xB7 ") || "theme tokens updated" };
      }
      if (op.fields?.understanding) return { icon: "brain", label: "Rewrote the brief", detail: "audience, tone or story corrected" };
      return { icon: "settings", label: "Project updated", detail: Object.keys(op.fields || {}).join(", ") };
    }
    case "updateSlide":
      return { icon: "edit", label: `Edited ${titleOf(op.id)}`, detail: Object.keys(op.fields || {}).join(", ") };
    case "insertSlide":
      return { icon: "plus", label: `Added ${titleOf(op.data?.id) || op.data?.type || "section"}`, detail: "inserted in sequence" };
    case "deleteSlide":
      return { icon: "trash", label: `Removed ${titleOf(op.id)}`, detail: "" };
    case "reorder":
      return { icon: "layers", label: "Reordered narrative", detail: `${op.updates?.length ?? 0} sections re-sequenced` };
    case "regenerate":
      return { icon: "refresh", label: "Regenerated the deck", detail: `rebuilt from the brief for ${project.name}` };
    default:
      return null;
  }
}
function directorTurn(project, slides, command, ctx = {}) {
  const { ops, changes, reply } = applyCommand(project, slides, command);
  const { valid, dropped } = validateOps(ops, slides);
  const plan = valid.map((op) => describeOp(op, slides, project)).filter(Boolean);
  const scan = project.analysis;
  const audit = project.audit;
  const context = [
    scan ? `${scan.pages?.length ?? 0} pages crawled` : null,
    audit ? `health ${audit.overall}/100` : null,
    ctx.purpose && ctx.purpose !== "general" ? `purpose: ${ctx.purpose}` : null,
    project.theme ? `theme: ${project.theme.accent || "studio lime"} / ${project.theme.skin || "light"}` : null,
    `${slides.length} sections live`
  ].filter(Boolean);
  const summary = {
    reply,
    changes,
    ops: valid,
    plan,
    dropped,
    context,
    hasEdits: valid.length > 0
  };
  if (!valid.length && !changes.length) {
    summary.plan = [{ icon: "sparkle", label: "Listening", detail: "no structural change \u2014 suggestions in reply" }];
  }
  return summary;
}

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

// api/_lib/specSync.js
async function rebuildSpec(projectId, source) {
  const [{ data: project }, { data: slides }, { data: intake }] = await Promise.all([
    db_client_default.from("projects").select("*").eq("id", projectId).single(),
    db_client_default.from("slides").select("*").eq("project_id", projectId).order("sort_order", { ascending: true }),
    db_client_default.from("project_intake").select("purpose").eq("project_id", projectId).maybeSingle()
  ]);
  if (!project || !slides || slides.length === 0) return null;
  const spec = buildSpecFromSlides(project, slides, source, intake?.purpose || "general");
  const check = validatePresentation(spec);
  if (!check.valid) {
    console.error("spec rebuild produced invalid document:", check.errors.slice(0, 3));
    return null;
  }
  const { data: existing } = await db_client_default.from("project_specs").select("version").eq("project_id", projectId).maybeSingle();
  const version = existing ? (existing.version || 1) + 1 : 1;
  if (existing) {
    await db_client_default.from("project_specs").update({ spec, version, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("project_id", projectId);
  } else {
    await db_client_default.from("project_specs").insert({ project_id: projectId, spec, version });
  }
  return { version, slideCount: spec.slides.length };
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

// api/ai.js
var maxDuration = 30;
var cors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
};
var logEvent = (project_id, kind) => db_client_default.from("project_events").insert({ project_id, kind }).then(({ error }) => {
  if (error) console.warn("event log failed:", error.message);
});
async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!enforceRateLimit(req, res, "ai", 20, 36e5)) return;
  const { projectId, command } = req.body || {};
  if (!projectId || !command || !String(command).trim())
    return res.status(400).json({ error: "projectId and command required" });
  const directive = String(command).trim().slice(0, 800);
  try {
    const [{ data: project }, { data: slides }, { data: intake }] = await Promise.all([
      db_client_default.from("projects").select("*").eq("id", projectId).single(),
      db_client_default.from("slides").select("*").eq("project_id", projectId).order("sort_order", { ascending: true }),
      db_client_default.from("project_intake").select("purpose, design_prompt").eq("project_id", projectId).maybeSingle()
    ]);
    if (!project) return res.status(404).json({ error: "Project not found." });
    if (!project.understanding || !project.analysis) {
      return res.status(422).json({ error: "Run the website analysis first \u2014 I direct better with a scanned brief." });
    }
    await db_client_default.from("chat_messages").insert({ project_id: projectId, role: "user", content: directive });
    const turn = directorTurn(project, slides || [], directive, {
      purpose: intake?.purpose || "general",
      designPrompt: intake?.design_prompt || ""
    });
    await executeOps(db_client_default, projectId, turn.ops);
    let specVersion = null;
    if (turn.hasEdits) {
      void logEvent(projectId, "ai_edit");
      const rebuilt = await rebuildSpec(projectId, "ai-edit").catch(() => null);
      specVersion = rebuilt ? rebuilt.version : null;
    }
    const [{ data: freshSlides }, { data: freshProject }] = await Promise.all([
      db_client_default.from("slides").select("*").eq("project_id", projectId).order("sort_order", { ascending: true }),
      db_client_default.from("projects").select("*").eq("id", projectId).single()
    ]);
    await db_client_default.from("chat_messages").insert({ project_id: projectId, role: "assistant", content: turn.reply });
    return res.status(200).json({
      reply: turn.reply,
      plan: turn.plan,
      context: turn.context,
      dropped: turn.dropped,
      changes: turn.changes,
      slides: freshSlides || [],
      theme: freshProject ? freshProject.theme : null,
      understanding: freshProject ? freshProject.understanding : null,
      projectStatus: freshProject ? freshProject.status : null,
      specVersion
    });
  } catch (err2) {
    console.error("ai api error:", err2);
    return res.status(500).json({ error: err2.message || "Server error" });
  }
}
export {
  handler as default,
  maxDuration
};
