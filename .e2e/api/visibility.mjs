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
async function setVisibility(supabase2, projectId, visibility) {
  if (!VISIBILITIES.includes(visibility)) throw new Error("unknown visibility");
  await supabase2.from("project_visibility").upsert({ project_id: projectId, visibility, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
  return visibility;
}

// api/visibility.js
var cors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
};
async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    const projectId = req.method === "GET" ? req.query.projectId : req.body?.projectId;
    if (!projectId) return res.status(400).json({ error: "projectId required" });
    const { data: project } = await db_client_default.from("projects").select("id").eq("id", projectId).single();
    if (!project) return res.status(404).json({ error: "Project not found." });
    if (req.method === "GET") {
      return res.status(200).json({ visibility: await getVisibility(db_client_default, projectId) });
    }
    if (req.method === "PUT") {
      const v = req.body?.visibility;
      if (!VISIBILITIES.includes(v)) return res.status(400).json({ error: `visibility must be one of: ${VISIBILITIES.join(", ")}` });
      const out = await setVisibility(db_client_default, projectId, v);
      await db_client_default.from("project_events").insert({ project_id: projectId, kind: "updated" });
      return res.status(200).json({ visibility: out });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("visibility api error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
export {
  handler as default
};
