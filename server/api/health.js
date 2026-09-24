const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

let bootedAt = Date.now();

/** Public liveness probe — distinguishes "API down" from "resource missing". */
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } });
  return res.status(200).json({
    ok: true,
    service: 'vistara-api',
    uptimeSec: Math.round((Date.now() - bootedAt) / 1000),
    ts: new Date().toISOString(),
  });
}
