// ============================================================
// api/providers/quickEmailVerification.js
//
// Adapter for QuickEmailVerification's API. Third provider in the
// fallback chain. Same job as the other provider files: speak this
// provider's specific format, return OUR normalized shape.
//
// Supports TWO accounts/keys for this provider, tried in order —
// same pattern as the other two provider files.
//
// >>> PLACEHOLDERS TO REPLACE: QUICKEMAILVERIFICATION_API_KEY_1, QUICKEMAILVERIFICATION_API_KEY_2 <<<
// Set in Vercel's dashboard, never hardcoded here.
//
// Docs: https://quickemailverification.com/email-verification-api
// (verify exact response field names against current docs)
// ============================================================

const KEYS = [
  process.env.QUICKEMAILVERIFICATION_API_KEY_1,
  process.env.QUICKEMAILVERIFICATION_API_KEY_2
].filter(Boolean);

const BASE_URL = 'https://api.quickemailverification.com/v1/verify';

/**
 * Calls QuickEmailVerification for one email address, trying each
 * configured key/account in order.
 * @param {string} email
 * @returns {Promise<object>} normalized verification result
 * @throws if all configured keys fail
 */
export async function verifyWithQuickEmailVerification(email) {
  if (KEYS.length === 0) {
    throw new Error('No QuickEmailVerification API keys configured');
  }

  const errors = [];

  for (let i = 0; i < KEYS.length; i++) {
    const key = KEYS[i];
    try {
      const url = `${BASE_URL}?email=${encodeURIComponent(email)}&apikey=${key}`;
      const response = await fetch(url);

      if (response.status === 429) {
        errors.push(`QuickEmailVerification key ${i + 1}: rate limited (429)`);
        continue;
      }

      if (!response.ok) {
        errors.push(`QuickEmailVerification key ${i + 1}: HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();

      // Normalize QuickEmailVerification's response into our shared shape.
      return {
        provider: 'quickemailverification',
        email,
        status: normalizeStatus(data.result),
        syntaxValid: data.valid_syntax === 'true' || data.valid_syntax === true,
        domainValid: data.valid_domain === 'true' || data.valid_domain === true,
        mxValid: data.valid_mx === 'true' || data.valid_mx === true,
        disposable: data.disposable === 'true' || data.disposable === true,
        roleAddress: data.role === 'true' || data.role === true,
        score: data.result === 'valid' ? 95 : (data.result === 'unknown' ? 50 : 20),
        raw: data
      };

    } catch (err) {
      errors.push(`QuickEmailVerification key ${i + 1}: ${err.message}`);
      continue;
    }
  }

  throw new Error(`All QuickEmailVerification keys failed: ${errors.join('; ')}`);
}

function normalizeStatus(providerResult) {
  const s = (providerResult || '').toLowerCase();
  if (s === 'valid') return 'safe';
  if (s === 'invalid') return 'invalid';
  if (s === 'unknown' || s === 'accept_all') return 'risky';
  return 'risky';
}
