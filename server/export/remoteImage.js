import { validateTarget, safeDispatcher } from '../security.js';
import { managedAsset, validAssetTarget } from '../assetAccess.js';

// Export images have the same redirect, DNS and streaming limits as crawls.
// The byte cap applies while reading, rather than after buffering a download.
export async function fetchExportImage(url, { maxBytes = 4 * 1024 * 1024, timeoutMs = 9000, projectId } = {}) {
  const asset = managedAsset(url);
  if (asset) {
    if (!projectId || !validAssetTarget(asset, projectId)) throw new Error('Image does not belong to this presentation.');
    const { default: db } = await import('../db-client.js');
    const { data, error } = await db.storage.from(asset.bucket).download(asset.path);
    if (error || !data || !data.type.startsWith('image/')) throw new Error('Image unavailable.');
    if (data.size > maxBytes) throw new Error('Image exceeds export size limit.');
    return { buffer: Buffer.from(await data.arrayBuffer()), mime: data.type, status: 200 };
  }
  const signal = AbortSignal.timeout(timeoutMs);
  let current = url;
  for (let hop = 0; hop <= 5; hop++) {
    const target = await validateTarget(current);
    const response = await fetch(target.url, { redirect: 'manual', signal, dispatcher: safeDispatcher });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw new Error('Image redirect has no destination.');
      current = new URL(location, target.url).href;
      continue;
    }
    const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!response.ok || !mime.startsWith('image/')) {
      await response.body?.cancel();
      throw new Error(`Image unavailable (${response.status}).`);
    }
    if (Number(response.headers.get('content-length')) > maxBytes) {
      await response.body?.cancel();
      throw new Error('Image exceeds export size limit.');
    }
    if (!response.body) throw new Error('Image response is empty.');
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > maxBytes) throw new Error('Image exceeds export size limit.');
        chunks.push(value);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally { reader.releaseLock(); }
    if (!bytes) throw new Error('Image response is empty.');
    return { buffer: Buffer.concat(chunks), mime, status: response.status };
  }
  throw new Error('Too many image redirects.');
}
