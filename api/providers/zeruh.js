// ============================================================
// api/providers/zeruh.js
//
// Zeruh email verification (https://zeruh.com), a Maileroo product.
// Free, no credit card required (per Zeruh's marketing pages at
// integration time — verify current terms on their pricing page
// before relying on this at volume, since free-tier limits can
// change without notice).
// Confirmed against Zeruh's live API docs (zeruh.com/api-docs) at
// integration time — re-check if this ever stops matching what
// they actually return.
//
// Supports TWO accounts/keys, same pattern as the other providers —
// tries key 1 first (ZERUH_API_KEY), falls back to key 2
// (ZERUH_API_KEY_2) if it fails/hits its rate limit, before the
// manager one level up (emailVerificationManager.js) falls through
// to a different provider entirely.
//
// >>> PLACEHOLDERS TO REPLACE: ZERUH_API_KEY, ZERUH_API_KEY_2 <<<
// Set in Vercel's dashboard (Project Settings -> Environment
// Variables), never in this file.
// ============================================================

const BASE_URL = 'https://api.zeruh.com/v1/verify';

const KEYS = [
  process.env.ZERUH_API_KEY,
  process.env.ZERUH_API_KEY_2
].filter(Boolean); // skips any key that isn't set, so partial setup doesn't crash

/**
 * Calls Zeruh for one email address, trying each configured
 * key/account in order.
 * @param {string} email
 * @returns {Promise<object>} normalized verification result
 * @throws if all configured keys fail
 */
export async function verifyWithZeruh(email) {
  if (KEYS.length === 0) {
    throw new Error('No Zeruh API keys configured');
  }

  const errors = [];

  for (let i = 0; i < KEYS.length; i++) {
    const key = KEYS[i];
    try {
      const url = `${BASE_URL}?email_address=${encodeURIComponent(email)}`;
      const response = await fetch(url, {
        headers: { 'X-Api-Key': key }
      });

      if (response.status === 429) {
        errors.push(`Zeruh key ${i + 1}: rate limited (429)`);
        continue;
      }

      if (response.status === 403) {
        errors.push(`Zeruh key ${i + 1}: invalid key or IP not allowed (403)`);
        continue;
      }

      if (!response.ok) {
        errors.push(`Zeruh key ${i + 1}: HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (!data.success || !data.result) {
        errors.push(`Zeruh key ${i + 1}: unexpected response shape`);
        continue;
      }

      const result = data.result;
      const details = result.validation_details || {};

      // Zeruh's "unknown" status means the verification itself
      // failed (server timeout, greylisting, etc.), not that the
      // email is confirmed bad — credits are refunded for these
      // per their docs. Treat as risky rather than invalid, since
      // we don't actually know it's bad.
      return {
        provider: 'zeruh',
        email,
        status: normalizeStatus(result.status),
        syntaxValid: details.format_valid ?? null,
        domainValid: details.mx_found ?? null,
        mxValid: details.mx_found ?? null,
        disposable: details.disposable ?? null,
        roleAddress: details.role ?? null,
        score: typeof result.score === 'number' ? result.score : null,
        raw: result
      };

    } catch (err) {
      errors.push(`Zeruh key ${i + 1}: ${err.message}`);
      continue;
    }
  }

  throw new Error(`All Zeruh keys failed: ${errors.join('; ')}`);
}

function normalizeStatus(zeruhStatus) {
  const s = (zeruhStatus || '').toLowerCase();
  if (s === 'deliverable') return 'safe';
  if (s === 'undeliverable') return 'invalid';
  if (s === 'risky' || s === 'unknown') return 'risky';
  return 'risky'; // safest default for anything unrecognized
}
