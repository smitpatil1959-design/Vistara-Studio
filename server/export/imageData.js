import sharp from 'sharp';
import { fetchExportImage } from './remoteImage.js';

export async function exportImageData(url, options) {
  const { buffer, mime, status } = await fetchExportImage(url, options);
  if (mime.includes('svg') && /<!doctype|<!entity|<script|<foreignObject|(?:href|src)\s*=\s*["'](?!#)|url\(\s*["']?(?!#)/i.test(buffer.toString('utf8'))) throw new Error('SVG references external or active content.');
  const image = sharp(buffer, { limitInputPixels: 30_000_000 });
  const meta = await image.metadata();
  if (!meta.width || !meta.height) throw new Error('Image dimensions unavailable.');
  // Office supports PNG and JPEG consistently. Decode other image formats before embedding.
  const optimized = image.rotate().resize({ width: 1920, height: 1440, fit: 'inside', withoutEnlargement: true });
  const output = meta.hasAlpha || mime.includes('svg') ? await optimized.png().toBuffer({ resolveWithObject: true }) : await optimized.jpeg({ quality: 88 }).toBuffer({ resolveWithObject: true });
  return { data: `data:image/${output.info.format};base64,${output.data.toString('base64')}`, width: output.info.width, height: output.info.height, status };
}
