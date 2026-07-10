// ============================================================
// api/emailVerificationManager.js
//
// The ONLY file that knows the provider fallback order. Mirrors
// the AI Manager pattern from the engineering spec (Gemini Key 1
// -> Key 2 -> Key 3 -> OpenRouter): try primary, if it fails for
// any reason, try the next one, and so on. Adding a 3rd provider
// later means: write providers/newProvider.js in the same shape
// as the existing two, import it here, add one line to the array
// below. Nothing else in the app changes.
// ============================================================

import { runLocalChecks } from './providers/localChecks.js';
import { verifyWithMyEmailVerifier } from './providers/myEmailVerifier.js';
import { verifyWithZeroBounce } from './providers/zeroBounce.js';

// Order = fallback priority. First one tried first.
const PROVIDERS = [
  { name: 'myemailverifier', fn: verifyWithMyEmailVerifier },
  { name: 'zerobounce', fn: verifyWithZeroBounce }
  // To add a provider: import its verify function above, then
  // add one line here: { name: 'newprovider', fn: verifyWithNewProvider }
];

/**
 * Verifies one email address: runs free local checks first, and
 * only calls a paid provider if those pass. Falls through the
 * PROVIDERS list in order if a provider errors out.
 *
 * @param {string} email
 * @returns {Promise<object>} normalized verification result
 */
export async function verifyEmail(email) {
  const local = runLocalChecks(email);

  if (!local.passesLocalChecks) {
    // No need to spend an API call on something obviously bad.
    return {
      provider: 'local',
      email,
      status: local.disposable ? 'invalid' : 'invalid',
      syntaxValid: local.syntaxValid,
      domainValid: local.syntaxValid,
      mxValid: null,
      disposable: local.disposable,
      roleAddress: null,
      score: 0,
      reason: local.reason
    };
  }

  const errors = [];

  for (const provider of PROVIDERS) {
    try {
      const result = await provider.fn(email);
      return result; // first success wins
    } catch (err) {
      console.error(`Provider ${provider.name} failed:`, err.message);
      errors.push(`${provider.name}: ${err.message}`);
      // fall through to next provider
    }
  }

  // Every provider failed — return a clear "unverified" result
  // rather than silently pretending we checked it. Spec Part 7 §17:
  // always explain what happened, never fail silently.
  return {
    provider: 'none',
    email,
    status: 'unverified',
    syntaxValid: local.syntaxValid,
    domainValid: null,
    mxValid: null,
    disposable: false,
    roleAddress: null,
    score: null,
    reason: `All providers failed: ${errors.join('; ')}`
  };
}
