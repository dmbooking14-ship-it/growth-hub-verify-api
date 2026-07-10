// ============================================================
// api/providers/zeroBounce.js
//
// Adapter for ZeroBounce's API. Same job as myEmailVerifier.js:
// speak ZeroBounce's specific format, return OUR normalized shape.
// This is the FALLBACK provider — only called if MyEmailVerifier
// fails or errors.
//
// >>> PLACEHOLDER TO REPLACE: ZEROBOUNCE_API_KEY <<<
// Reads from process.env.ZEROBOUNCE_API_KEY — set in Vercel's
// dashboard, never hardcoded here.
//
// Docs: https://www.zerobounce.net/docs/email-validation-api-quickstart
// (verify exact response field names against current docs)
// ============================================================

const API_KEY = process.env.ZEROBOUNCE_API_KEY;
const BASE_URL = 'https://api.zerobounce.net/v2/validate';

/**
 * Calls ZeroBounce for one email address.
 * @param {string} email
 * @returns {Promise<object>} normalized verification result
 * @throws if the API call fails or the key is missing/invalid
 */
export async function verifyWithZeroBounce(email) {
  if (!API_KEY) {
    throw new Error('ZEROBOUNCE_API_KEY is not set');
  }

  const url = `${BASE_URL}?api_key=${API_KEY}&email=${encodeURIComponent(email)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`ZeroBounce HTTP ${response.status}`);
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
}

function normalizeStatus(providerStatus) {
  const s = (providerStatus || '').toLowerCase();
  if (s === 'valid') return 'safe';
  if (s === 'invalid') return 'invalid';
  if (s === 'catch-all' || s === 'unknown' || s === 'spamtrap' || s === 'abuse') return 'risky';
  if (s === 'do_not_mail') return 'invalid';
  return 'risky';
}
