import { sessionCookie } from '../assetAccess.js';

export default function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Set-Cookie', sessionCookie(req));
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true });
}
