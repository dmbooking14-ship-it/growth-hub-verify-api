// ============================================================
// api/providers/myEmailVerifier.js
//
// Adapter for MyEmailVerifier's API. Its job: speak
// MyEmailVerifier's specific request/response format, and return
// results in OUR normalized shape so the rest of the app never
// needs to know which provider actually answered.
//
// >>> PLACEHOLDER TO REPLACE: MYEMAILVERIFIER_API_KEY <<<
// This file does NOT contain the key directly — it reads it from
// process.env.MYEMAILVERIFIER_API_KEY, which you set in Vercel's
// dashboard (Project Settings -> Environment Variables), never in
// this file. See the README section "Environment Variables" for
// exactly where to paste your real key.
//
// Docs: https://myemailverifier.com (verify exact endpoint/response
// shape against their current docs when you sign up — API responses
// occasionally change field names between provider versions).
// ============================================================

const API_KEY = process.env.MYEMAILVERIFIER_API_KEY;
const BASE_URL = 'https://client.myemailverifier.com/verifier/validate_single';

/**
 * Calls MyEmailVerifier for one email address.
 * @param {string} email
 * @returns {Promise<object>} normalized verification result
 * @throws if the API call fails or the key is missing/invalid
 */
export async function verifyWithMyEmailVerifier(email) {
  if (!API_KEY) {
    throw new Error('MYEMAILVERIFIER_API_KEY is not set');
  }

  const url = `${BASE_URL}/${encodeURIComponent(email)}/${API_KEY}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`MyEmailVerifier HTTP ${response.status}`);
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
}

function normalizeStatus(providerStatus) {
  const s = (providerStatus || '').toLowerCase();
  if (s === 'valid') return 'safe';
  if (s === 'invalid') return 'invalid';
  if (s === 'catch-all' || s === 'greylisted' || s === 'unknown') return 'risky';
  return 'risky'; // safest default for anything unrecognized
}
