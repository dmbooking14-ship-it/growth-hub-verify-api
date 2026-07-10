// ============================================================
// api/verify-email.js
//
// This IS the endpoint. Deployed by Vercel automatically at:
//   https://<your-project-name>.vercel.app/api/verify-email
//
// Your frontend (leadService.js, later) calls this URL with a
// POST body of { "email": "someone@example.com" } and gets back
// the normalized verification result. It never sees which
// provider answered or any API key.
// ============================================================

import { verifyEmail } from './emailVerificationManager.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Use POST' });
  }

  const { email } = request.body || {};

  if (!email || typeof email !== 'string') {
    return response.status(400).json({ error: 'Missing "email" in request body' });
  }

  try {
    const result = await verifyEmail(email);
    return response.status(200).json(result);
  } catch (err) {
    console.error('verify-email handler error:', err);
    return response.status(500).json({ error: 'Verification failed unexpectedly' });
  }
}

