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

// api/chat.js
var cors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
};
async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    if (req.method === "GET") {
      const { projectId } = req.query;
      if (!projectId) return res.status(400).json({ error: "projectId required" });
      const access = await ensureDeckAccess(db_client_default, req, projectId);
      if (!access.allowed) return res.status(404).json({ error: "Not found." });
      const { data, error } = await db_client_default.from("chat_messages").select("*").eq("project_id", projectId).order("created_at", { ascending: true }).limit(200);
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === "POST") {
      if (!enforceRateLimit(req, res, "chat", 90, 36e5)) return;
      const { project_id, role, content } = req.body || {};
      if (!project_id || !role || !content) return res.status(400).json({ error: "project_id, role and content required" });
      if (String(content).length > 4e3) return res.status(422).json({ error: "Message too long." });
      const { data, error } = await db_client_default.from("chat_messages").insert({ project_id, role, content }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("chat api error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
export {
  handler as default
};
