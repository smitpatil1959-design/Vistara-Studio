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

// api/gallery.js
var cors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
};
async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { data: vis } = await db_client_default.from("project_visibility").select("project_id").eq("visibility", "public");
    const ids = (vis || []).map((v) => v.project_id);
    if (!ids.length) return res.status(200).json([]);
    const { data: projects, error } = await db_client_default.from("projects").select("id, name, url, status, analysis, audit, theme, created_at").in("id", ids).order("created_at", { ascending: false }).limit(24);
    if (error) throw error;
    return res.status(200).json(
      (projects || []).map((p) => ({
        id: p.id,
        name: p.name,
        url: p.url,
        screenshot: p.analysis?.screenshot || null,
        health: p.audit?.overall ?? null,
        sectionsReady: p.status === "generated",
        purpose: null,
        createdAt: p.created_at
      }))
    );
  } catch (err) {
    console.error("gallery api error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
export {
  handler as default
};
