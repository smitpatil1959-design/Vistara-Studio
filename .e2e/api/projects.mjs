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
async function requireSignedIn(supabase2, req) {
  const token = (req.headers.authorization || "").replace(/^Bearer /i, "");
  if (!token) return null;
  const { data, error } = await supabase2.auth.getUser(token).catch(() => ({ data: null, error: new Error("auth") }));
  if (error || !data?.user) return null;
  return data.user;
}

// api/projects.js
var logEvent = (project_id, kind) => db_client_default.from("project_events").insert({ project_id, kind }).then(({ error }) => {
  if (error) console.warn("event log failed:", error.message);
});
var cors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
};
async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    if (req.method === "GET") {
      const { id } = req.query;
      if (id) {
        const access = await ensureDeckAccess(db_client_default, req, id);
        if (!access.allowed) return res.status(404).json({ error: "This presentation is private \u2014 sign in to view it." });
        const { data: data2, error: error2 } = await db_client_default.from("projects").select("*").eq("id", id).single();
        if (error2) throw error2;
        const { data: intake } = await db_client_default.from("project_intake").select("purpose, design_prompt").eq("project_id", id).maybeSingle();
        return res.status(200).json({ ...data2, intake: intake || null, visibility: access.visibility });
      }
      const { data, error } = await db_client_default.from("projects").select("*").order("created_at", { ascending: false }).limit(60);
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === "POST") {
      const { url, name, theme, purpose, designPrompt } = req.body || {};
      if (!url || !String(url).trim()) return res.status(400).json({ error: "A website URL is required." });
      let clean = String(url).trim();
      if (!/^https?:\/\//i.test(clean)) clean = "https://" + clean;
      let host = "";
      try {
        const parsed = new URL(clean);
        host = parsed.hostname.replace(/^www\./, "");
        if (!host.includes(".")) return res.status(400).json({ error: "Enter a full domain like linear.app." });
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
          return res.status(400).json({ error: "Only http/https websites can be analyzed." });
        if (host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host))
          return res.status(400).json({ error: "Local or IP addresses are not reachable by the crawl engine." });
      } catch {
        return res.status(400).json({ error: "That URL does not look valid." });
      }
      const PURPOSES = /* @__PURE__ */ new Set(["college", "investor", "client", "product-demo", "portfolio", "general"]);
      const cleanPurpose = PURPOSES.has(purpose) ? purpose : "general";
      const { data, error } = await db_client_default.from("projects").insert({ url: clean, name: name || host, status: "queued", theme: theme || null }).select().single();
      if (error) throw error;
      await db_client_default.from("project_intake").insert({ project_id: data.id, purpose: cleanPurpose, design_prompt: (designPrompt || "").slice(0, 600) || null });
      void logEvent(data.id, "created");
      return res.status(201).json({ ...data, purpose: cleanPurpose });
    }
    if (req.method === "PUT") {
      if (!await requireSignedIn(db_client_default, req)) return res.status(401).json({ error: "Sign in to edit studies." });
      const { id, name, url, status, analysis, audit, understanding, theme } = req.body || {};
      if (!id) return res.status(400).json({ error: "id required" });
      const fields = {};
      if (name !== void 0) fields.name = name;
      if (url !== void 0) fields.url = url;
      if (status !== void 0) fields.status = status;
      if (analysis !== void 0) fields.analysis = analysis;
      if (audit !== void 0) fields.audit = audit;
      if (understanding !== void 0) fields.understanding = understanding;
      if (theme !== void 0) fields.theme = theme;
      const { data, error } = await db_client_default.from("projects").update(fields).eq("id", id).select().single();
      if (error) throw error;
      void logEvent(id, "updated");
      return res.status(200).json(data);
    }
    if (req.method === "DELETE") {
      if (!await requireSignedIn(db_client_default, req)) return res.status(401).json({ error: "Sign in to delete studies." });
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: "id required" });
      await db_client_default.from("chat_messages").delete().eq("project_id", id);
      await db_client_default.from("slides").delete().eq("project_id", id);
      await db_client_default.from("project_events").delete().eq("project_id", id);
      await db_client_default.from("project_intake").delete().eq("project_id", id);
      await db_client_default.from("project_specs").delete().eq("project_id", id);
      const { data: rows } = await db_client_default.from("assets").select("path, thumb_path").eq("project_id", id);
      await db_client_default.from("assets").delete().eq("project_id", id);
      if (rows && rows.length) {
        const files = rows.flatMap((r) => [r.path, r.thumb_path].filter(Boolean));
        if (files.length) await db_client_default.storage.from("assets").remove(files);
      }
      await db_client_default.storage.from("screenshots").remove([`${id}/home.jpg`]);
      const { error } = await db_client_default.from("projects").delete().eq("id", id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("projects api error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
export {
  handler as default
};
