import supabase from './db-client.js';
import { enforceRateLimit } from '../ratelimit.js';

export const maxDuration = 15;

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!enforceRateLimit(req, res, 'auth-signup', 20, 3600_000)) return;

  const { email, password } = req.body || {};

  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Enter a valid email address.', code: 'invalid' });
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.', code: 'invalid' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
    });

    if (error) {
      const msg = error.message || '';
      if (/already|duplicate|exists/i.test(msg)) {
        return res.status(409).json({
          error: 'An account with this email already exists — sign in instead.',
          code: 'duplicate',
        });
      }
      return res.status(400).json({ error: msg || 'Failed to create account.', code: error.code || 'unknown' });
    }

    return res.status(201).json({
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch (err) {
    console.error('[api/auth-signup] error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error', code: 'server' });
  }
}
