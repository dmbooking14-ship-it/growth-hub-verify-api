// ============================================================
// api/providers/abstractApi.js
//
// Abstract API email validation (https://www.abstractapi.com).
// Free tier: 100 requests/month, no credit card, 1 request/second.
// Confirmed against Abstract's live docs (docs.abstractapi.com/api/email-validation)
// at integration time — re-check if this ever stops matching what
// they actually return.
//
// IMPORTANT: on the FREE plan, is_mx_found always returns null (text
// "UNKNOWN") — MX checking is a paid-plan-only field. mxValid below
// will be null on free plans; don't treat that as a failure.
//
// Supports TWO accounts/keys, same pattern as the other providers —
// tries key 1 first (ABSTRACTAPI_EMAIL_KEY), falls back to key 2
// (ABSTRACTAPI_EMAIL_KEY_2) if it fails/hits its rate limit, before
// the manager one level up (emailVerificationManager.js) falls
// through to a different provider entirely.
//
// >>> PLACEHOLDERS TO REPLACE: ABSTRACTAPI_EMAIL_KEY, ABSTRACTAPI_EMAIL_KEY_2 <<<
// Set in Vercel's dashboard (Project Settings -> Environment
// Variables), never in this file.
// ============================================================

const BASE_URL = 'https://emailvalidation.abstractapi.com/v1/';

const KEYS = [
  process.env.ABSTRACTAPI_EMAIL_KEY,
  process.env.ABSTRACTAPI_EMAIL_KEY_2
].filter(Boolean); // skips any key that isn't set, so partial setup doesn't crash

/**
 * Calls Abstract API for one email address, trying each configured
 * key/account in order.
 * @param {string} email
 * @returns {Promise<object>} normalized verification result
 * @throws if all configured keys fail
 */
export async function verifyWithAbstractApi(email) {
  if (KEYS.length === 0) {
    throw new Error('No Abstract API keys configured');
  }

  const errors = [];

  for (let i = 0; i < KEYS.length; i++) {
    const key = KEYS[i];
    try {
      const url = `${BASE_URL}?api_key=${key}&email=${encodeURIComponent(email)}`;
      const response = await fetch(url);

      if (response.status === 429 || response.status === 422) {
        // 429 = rate limited, 422 = free-plan quota reached — both
        // mean "try the next key/account", not "this email is bad".
        errors.push(`Abstract API key ${i + 1}: quota/rate limited (${response.status})`);
        continue;
      }

      if (!response.ok) {
        errors.push(`Abstract API key ${i + 1}: HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();

      // Free-plan responses return booleans directly; some plan
      // tiers wrap them as { value, text } — handle both shapes
      // rather than assume one.
      const boolField = (field) => {
        if (typeof field === 'boolean') return field;
        if (field && typeof field === 'object') return field.value;
        return null;
      };

      return {
        provider: 'abstractapi',
        email,
        status: normalizeStatus(data.deliverability),
        syntaxValid: boolField(data.is_valid_format),
        domainValid: boolField(data.is_mx_found), // null on free plan — see file header note
        mxValid: boolField(data.is_mx_found),
        disposable: boolField(data.is_disposable_email),
        roleAddress: boolField(data.is_role_email),
        score: typeof data.quality_score === 'number' ? Math.round(data.quality_score * 100) : null,
        raw: data
      };

    } catch (err) {
      errors.push(`Abstract API key ${i + 1}: ${err.message}`);
      continue;
    }
  }

  throw new Error(`All Abstract API keys failed: ${errors.join('; ')}`);
}

function normalizeStatus(deliverability) {
  const s = (deliverability || '').toUpperCase();
  if (s === 'DELIVERABLE') return 'safe';
  if (s === 'UNDELIVERABLE') return 'invalid';
  if (s === 'UNKNOWN') return 'risky';
  return 'risky'; // safest default for anything unrecognized
}
