// ============================================================
// api/providers/myEmailVerifier.js
//
// Adapter for MyEmailVerifier's API. Its job: speak
// MyEmailVerifier's specific request/response format, and return
// results in OUR normalized shape so the rest of the app never
// needs to know which provider actually answered.
//
// Supports TWO accounts/keys for this provider (same pattern as
// gemini.js's multi-key rotation) — tries key 1 first, falls back
// to key 2 if it fails/hits its rate limit, before the manager one
// level up (emailVerificationManager.js) falls through to a
// different provider entirely.
//
// >>> PLACEHOLDERS TO REPLACE: MYEMAILVERIFIER_API_KEY, MYEMAILVERIFIER_API_KEY_2 <<<
// Set in Vercel's dashboard (Project Settings -> Environment
// Variables), never in this file.
//
// Docs: https://myemailverifier.com (verify exact endpoint/response
// shape against their current docs when you sign up — API responses
// occasionally change field names between provider versions).
// ============================================================

const KEYS = [
  process.env.MYEMAILVERIFIER_API_KEY,
  process.env.MYEMAILVERIFIER_API_KEY_2
].filter(Boolean); // skips any key that isn't set, so partial setup doesn't crash

const BASE_URL = 'https://client.myemailverifier.com/verifier/validate_single';

/**
 * Calls MyEmailVerifier for one email address, trying each
 * configured key/account in order.
 * @param {string} email
 * @returns {Promise<object>} normalized verification result
 * @throws if all configured keys fail
 */
export async function verifyWithMyEmailVerifier(email) {
  if (KEYS.length === 0) {
    throw new Error('No MyEmailVerifier API keys configured');
  }

  const errors = [];

  for (let i = 0; i < KEYS.length; i++) {
    const key = KEYS[i];
    try {
      const url = `${BASE_URL}/${encodeURIComponent(email)}/${key}`;
      const response = await fetch(url);

      if (response.status === 429) {
        errors.push(`MyEmailVerifier key ${i + 1}: rate limited (429)`);
        continue;
      }

      if (!response.ok) {
        errors.push(`MyEmailVerifier key ${i + 1}: HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();

      // Normalize MyEmailVerifier's response into our shared shape.
      // (Field names below match MyEmailVerifier's documented response
      // as of integration time — re-check against live docs if this
      // ever stops matching what they actually return.)
      return {
        provider: 'myemailverifier',
        email,
        status: normalizeStatus(data.Status),
        syntaxValid: data.Syntax_Error === 'false' || data.Syntax_Error === false,
        domainValid: data.Domain !== undefined && data['Do_You_Want_To_Continue'] !== 'no',
        mxValid: data.MX_Record === 'true' || data.MX_Record === true,
        disposable: data.Disposable_Domain === 'true' || data.Disposable_Domain === true,
        roleAddress: data.Role_Based === 'true' || data.Role_Based === true,
        score: data.Greylisted ? 50 : (data.Status === 'Valid' ? 95 : 20),
        raw: data
      };

    } catch (err) {
      errors.push(`MyEmailVerifier key ${i + 1}: ${err.message}`);
      continue;
    }
  }

  throw new Error(`All MyEmailVerifier keys failed: ${errors.join('; ')}`);
}

function normalizeStatus(providerStatus) {
  const s = (providerStatus || '').toLowerCase();
  if (s === 'valid') return 'safe';
  if (s === 'invalid') return 'invalid';
  if (s === 'catch-all' || s === 'greylisted' || s === 'unknown') return 'risky';
  return 'risky'; // safest default for anything unrecognized
}
