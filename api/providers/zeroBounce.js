// ============================================================
// api/providers/zeroBounce.js
//
// Adapter for ZeroBounce's API. Same job as myEmailVerifier.js:
// speak ZeroBounce's specific format, return OUR normalized shape.
//
// Supports TWO accounts/keys for this provider, tried in order —
// same pattern as myEmailVerifier.js.
//
// >>> PLACEHOLDERS TO REPLACE: ZEROBOUNCE_API_KEY_1, ZEROBOUNCE_API_KEY_2 <<<
// Set in Vercel's dashboard, never hardcoded here.
//
// Docs: https://www.zerobounce.net/docs/email-validation-api-quickstart
// (verify exact response field names against current docs)
// ============================================================

const KEYS = [
  process.env.ZEROBOUNCE_API_KEY_1,
  process.env.ZEROBOUNCE_API_KEY_2
].filter(Boolean);

const BASE_URL = 'https://api.zerobounce.net/v2/validate';

/**
 * Calls ZeroBounce for one email address, trying each configured
 * key/account in order.
 * @param {string} email
 * @returns {Promise<object>} normalized verification result
 * @throws if all configured keys fail
 */
export async function verifyWithZeroBounce(email) {
  if (KEYS.length === 0) {
    throw new Error('No ZeroBounce API keys configured');
  }

  const errors = [];

  for (let i = 0; i < KEYS.length; i++) {
    const key = KEYS[i];
    try {
      const url = `${BASE_URL}?api_key=${key}&email=${encodeURIComponent(email)}`;
      const response = await fetch(url);

      if (response.status === 429) {
        errors.push(`ZeroBounce key ${i + 1}: rate limited (429)`);
        continue;
      }

      if (!response.ok) {
        errors.push(`ZeroBounce key ${i + 1}: HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();

      // Normalize ZeroBounce's response into our shared shape.
      return {
        provider: 'zerobounce',
        email,
        status: normalizeStatus(data.status),
        syntaxValid: data.status !== 'invalid' || data.sub_status !== 'failed_syntax_check',
        domainValid: data.sub_status !== 'invalid_domain',
        mxValid: data.mx_found === 'true' || data.mx_found === true,
        disposable: data.status === 'do_not_mail' && data.sub_status === 'disposable',
        roleAddress: data.sub_status === 'role_based' || data.sub_status === 'role_based_catch_all',
        score: data.status === 'valid' ? 95 : (data.status === 'catch-all' ? 55 : 20),
        raw: data
      };

    } catch (err) {
      errors.push(`ZeroBounce key ${i + 1}: ${err.message}`);
      continue;
    }
  }

  throw new Error(`All ZeroBounce keys failed: ${errors.join('; ')}`);
}

function normalizeStatus(providerStatus) {
  const s = (providerStatus || '').toLowerCase();
  if (s === 'valid') return 'safe';
  if (s === 'invalid') return 'invalid';
  if (s === 'catch-all' || s === 'unknown' || s === 'spamtrap' || s === 'abuse') return 'risky';
  if (s === 'do_not_mail') return 'invalid';
  return 'risky';
}
