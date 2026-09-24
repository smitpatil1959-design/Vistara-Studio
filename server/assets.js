/**
 * Asset pipeline — image optimization + thumbnails, resilient to sharp absence.
 * Policy: max 1920px main @ ~80 quality; 480px thumbs. Originals are processed
 * in memory; only optimized derivatives persist.
 */

export const ASSET_BUCKET = 'assets';
export const ASSET_MAX_INPUT_BYTES = 6 * 1024 * 1024; // 6MB upload guard (api body → base64)
export const ASSET_MAIN_MAX_W = 1920;
export const ASSET_THUMB_W = 480;
export const ASSET_MAIN_QUALITY = 82;
export const ASSET_THUMB_QUALITY = 68;

let _sharp = null;
let sharpFailed = false;

export async function loadSharp() {
  if (sharpFailed) return null;
  if (_sharp) return _sharp;
  try {
    const mod = await import('sharp');
    _sharp = mod.default || mod;
    return _sharp;
  } catch (e) {
    console.warn('[assets] sharp unavailable, storing originals:', e.message);
    sharpFailed = true;
    return null;
  }
}

const extFor = (mime) => (mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : mime === 'image/gif' ? 'gif' : 'jpg');

/** Normalize an input frame → { main: Buffer, thumb: Buffer, width, height } — never throws. */
export async function optimizeImage(input, { crop = null } = {}) {
  const sharpInst = await loadSharp();
  if (!sharpInst) {
    return { main: input, thumb: null, width: null, height: null, mime: 'image/jpeg', optimized: false };
  }
  try {
    let pipe = sharpInst(input, { failOn: 'none' }).rotate(); // respects EXIF orientation
    if (crop && crop.w > 8 && crop.h > 8) pipe = pipe.extract({ left: Math.max(0, Math.round(crop.x)), top: Math.max(0, Math.round(crop.y)), width: Math.round(crop.w), height: Math.round(crop.h) });
    const meta = await pipe.metadata();
    const main = await sharpInst(await pipe.toBuffer()).resize({ width: ASSET_MAIN_MAX_W, withoutEnlargement: true }).jpeg({ quality: ASSET_MAIN_QUALITY, mozjpeg: true }).toBuffer();
    const thumb = await sharpInst(await pipe.toBuffer()).resize({ width: ASSET_THUMB_W, withoutEnlargement: true }).jpeg({ quality: ASSET_THUMB_QUALITY, mozjpeg: true }).toBuffer();
    return { main, thumb, width: meta.width ?? null, height: meta.height ?? null, mime: 'image/jpeg', optimized: true };
  } catch (e) {
    console.warn('[assets] optimize failed:', e.message);
    return { main: input, thumb: null, width: null, height: null, mime: null, optimized: false };
  }
}

export function assetPath(projectId, name, variant = 'main', mime = 'image/jpeg') {
  const clean = String(name || 'asset').toLowerCase().replace(/[^a-z0-9.-]+/g, '-').slice(0, 60) || 'asset';
  const rand = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `${projectId}/${variant}-${rand}-${clean}.${extFor(mime)}`;
}

export { extFor };
