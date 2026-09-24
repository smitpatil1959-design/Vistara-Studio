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

// server/assets.js
var ASSET_BUCKET = "assets";
var ASSET_MAX_INPUT_BYTES = 6 * 1024 * 1024;
var ASSET_MAIN_MAX_W = 1920;
var ASSET_THUMB_W = 480;
var ASSET_MAIN_QUALITY = 82;
var ASSET_THUMB_QUALITY = 68;
var _sharp = null;
var sharpFailed = false;
async function loadSharp() {
  if (sharpFailed) return null;
  if (_sharp) return _sharp;
  try {
    const mod = await import("sharp");
    _sharp = mod.default || mod;
    return _sharp;
  } catch (e) {
    console.warn("[assets] sharp unavailable, storing originals:", e.message);
    sharpFailed = true;
    return null;
  }
}
var extFor = (mime) => mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "jpg";
async function optimizeImage(input, { crop = null } = {}) {
  const sharpInst = await loadSharp();
  if (!sharpInst) {
    return { main: input, thumb: null, width: null, height: null, mime: "image/jpeg", optimized: false };
  }
  try {
    let pipe = sharpInst(input, { failOn: "none" }).rotate();
    if (crop && crop.w > 8 && crop.h > 8) pipe = pipe.extract({ left: Math.max(0, Math.round(crop.x)), top: Math.max(0, Math.round(crop.y)), width: Math.round(crop.w), height: Math.round(crop.h) });
    const meta = await pipe.metadata();
    const main = await sharpInst(await pipe.toBuffer()).resize({ width: ASSET_MAIN_MAX_W, withoutEnlargement: true }).jpeg({ quality: ASSET_MAIN_QUALITY, mozjpeg: true }).toBuffer();
    const thumb = await sharpInst(await pipe.toBuffer()).resize({ width: ASSET_THUMB_W, withoutEnlargement: true }).jpeg({ quality: ASSET_THUMB_QUALITY, mozjpeg: true }).toBuffer();
    return { main, thumb, width: meta.width ?? null, height: meta.height ?? null, mime: "image/jpeg", optimized: true };
  } catch (e) {
    console.warn("[assets] optimize failed:", e.message);
    return { main: input, thumb: null, width: null, height: null, mime: null, optimized: false };
  }
}
function assetPath(projectId, name, variant = "main", mime = "image/jpeg") {
  const clean = String(name || "asset").toLowerCase().replace(/[^a-z0-9.-]+/g, "-").slice(0, 60) || "asset";
  const rand = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `${projectId}/${variant}-${rand}-${clean}.${extFor(mime)}`;
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
function sniffImageMime(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 255 && buf[1] === 216 && buf[2] === 255) return "image/jpeg";
  if (buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71) return "image/png";
  if (buf[0] === 82 && buf[1] === 73 && buf[2] === 70 && buf[3] === 70 && buf.slice(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (buf.slice(0, 6).toString("latin1") === "GIF87a" || buf.slice(0, 6).toString("latin1") === "GIF89a") return "image/gif";
  if (buf.slice(4, 8).toString("latin1") === "ftyp" && buf.slice(8, 12).toString("latin1") === "avif") return "image/avif";
  return null;
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

// api/assets.js
var maxDuration = 30;
var cors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
};
var ALLOWED_MIME = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);
async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    if (req.method === "GET") {
      const { projectId } = req.query;
      if (!projectId) return res.status(400).json({ error: "projectId required" });
      const access = await ensureDeckAccess(db_client_default, req, projectId);
      if (!access.allowed) return res.status(404).json({ error: "Not found." });
      const { data, error } = await db_client_default.from("assets").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(120);
      if (error) throw error;
      return res.status(200).json(data || []);
    }
    if (req.method === "POST") {
      const { projectId, name, mime, dataBase64, kind, sourcePage } = req.body || {};
      if (!projectId || !dataBase64) return res.status(400).json({ error: "projectId and dataBase64 required" });
      const { data: proj } = await db_client_default.from("projects").select("id").eq("id", projectId).single();
      if (!proj) return res.status(404).json({ error: "Project not found." });
      if (!enforceRateLimit(req, res, "asset-upload", 40, 36e5)) return;
      const owner = await requireSignedIn(db_client_default, req);
      if (!owner) return res.status(401).json({ error: "Sign in to upload assets." });
      const raw = Buffer.from(String(dataBase64), "base64");
      if (raw.length > ASSET_MAX_INPUT_BYTES) return res.status(413).json({ error: "Image too large (max 6MB)." });
      const sniffed = sniffImageMime(raw);
      if (!sniffed) return res.status(415).json({ error: "File is not a supported image (malformed header)." });
      const cleanMime = ALLOWED_MIME.has(mime) && sniffed === mime ? mime : sniffed;
      const opt = await optimizeImage(raw);
      const params = { contentType: opt.mime || cleanMime, upsert: true };
      const mainPath = assetPath(projectId, name || "image", "main", sniffed);
      const { error: upErr } = await db_client_default.storage.from(ASSET_BUCKET).upload(mainPath, opt.main, params);
      if (upErr) throw upErr;
      let thumbPath = null;
      if (opt.thumb) {
        thumbPath = assetPath(projectId, name || "image", "thumb");
        await db_client_default.storage.from(ASSET_BUCKET).upload(thumbPath, opt.thumb, params);
      }
      const { data: pub } = db_client_default.storage.from(ASSET_BUCKET).getPublicUrl(mainPath);
      const { data: pubT } = thumbPath ? db_client_default.storage.from(ASSET_BUCKET).getPublicUrl(thumbPath) : { data: { publicUrl: null } };
      const { data: row, error: rowErr } = await db_client_default.from("assets").insert({
        project_id: projectId,
        kind: kind === "scan" ? "scan" : "upload",
        name: String(name || "image").slice(0, 120),
        path: mainPath,
        thumb_path: thumbPath,
        url: pub.publicUrl,
        thumb_url: pubT.publicUrl,
        width: opt.width,
        height: opt.height,
        bytes: opt.main.length,
        mime: opt.mime || cleanMime,
        source_page: sourcePage || null
      }).select().single();
      if (rowErr) throw rowErr;
      return res.status(201).json(row);
    }
    if (req.method === "PUT") {
      if (!await requireSignedIn(db_client_default, req)) return res.status(401).json({ error: "Sign in to edit assets." });
      const { id, crop } = req.body || {};
      if (!id || !crop) return res.status(400).json({ error: "id and crop required" });
      const c = {
        x: Math.max(0, Math.round(Number(crop.x) || 0)),
        y: Math.max(0, Math.round(Number(crop.y) || 0)),
        w: Math.min(8e3, Math.max(0, Math.round(Number(crop.w) || 0))),
        h: Math.min(8e3, Math.max(0, Math.round(Number(crop.h) || 0)))
      };
      if (c.w < 8 || c.h < 8) return res.status(422).json({ error: "Crop region too small." });
      crop.x = c.x;
      crop.y = c.y;
      crop.w = c.w;
      crop.h = c.h;
      const { data: asset } = await db_client_default.from("assets").select("*").eq("id", id).single();
      if (!asset) return res.status(404).json({ error: "Asset not found." });
      const { data: file, error: dlErr } = await db_client_default.storage.from(ASSET_BUCKET).download(asset.path);
      if (dlErr) throw dlErr;
      const buf = Buffer.from(await file.arrayBuffer());
      const opt = await optimizeImage(buf, { crop });
      await db_client_default.storage.from(ASSET_BUCKET).upload(asset.path, opt.main, { contentType: opt.mime || asset.mime || "image/jpeg", upsert: true });
      if (asset.thumb_path && opt.thumb) {
        await db_client_default.storage.from(ASSET_BUCKET).upload(asset.thumb_path, opt.thumb, { contentType: "image/jpeg", upsert: true });
      }
      const stamp = `?t=${Date.now()}`;
      const { data: updated, error } = await db_client_default.from("assets").update({ width: opt.width, height: opt.height, bytes: opt.main.length, url: asset.url.split("?")[0] + stamp, thumb_url: asset.thumb_url ? asset.thumb_url.split("?")[0] + stamp : null }).eq("id", id).select().single();
      if (error) throw error;
      return res.status(200).json(updated);
    }
    if (req.method === "DELETE") {
      if (!await requireSignedIn(db_client_default, req)) return res.status(401).json({ error: "Sign in to delete assets." });
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: "id required" });
      const { data: asset } = await db_client_default.from("assets").select("*").eq("id", id).single();
      if (asset) {
        await db_client_default.storage.from(ASSET_BUCKET).remove([asset.path, asset.thumb_path].filter(Boolean));
        await db_client_default.from("assets").delete().eq("id", id);
      }
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("assets api error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
export {
  handler as default,
  maxDuration
};
