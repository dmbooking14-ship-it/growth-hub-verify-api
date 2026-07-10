// ============================================================
// api/providers/localChecks.js
//
// Zero-cost, zero-API-call checks (spec Part 3 §8 "Option 1" from
// our discussion). Run BEFORE calling any paid provider, so
// obviously-malformed emails or known-disposable domains never
// spend an API request at all. This is a pre-filter, not a
// replacement for real MX/SMTP verification.
// ============================================================

// Small, commonly-seen disposable-email domains. Not exhaustive —
// this is a fast pre-filter, not a comprehensive disposable-domain
// database. Add to this list any time you notice one slipping through.
const KNOWN_DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.info',
  '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'throwawaymail.com',
  'yopmail.com', 'trashmail.com', 'getnada.com', 'fakeinbox.com',
  'sharklasers.com', 'mailnesia.com', 'dispostable.com'
]);

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Runs local, free checks on an email address before any API call.
 * @param {string} email
 * @returns {{ passesLocalChecks: boolean, syntaxValid: boolean, disposable: boolean, reason: string|null }}
 */
export function runLocalChecks(email) {
  const trimmed = (email || '').trim();

  const syntaxValid = EMAIL_REGEX.test(trimmed);
  if (!syntaxValid) {
    return { passesLocalChecks: false, syntaxValid: false, disposable: false, reason: 'Invalid email format' };
  }

  const domain = trimmed.split('@')[1]?.toLowerCase();
  const disposable = KNOWN_DISPOSABLE_DOMAINS.has(domain);
  if (disposable) {
    return { passesLocalChecks: false, syntaxValid: true, disposable: true, reason: 'Known disposable email domain' };
  }

  return { passesLocalChecks: true, syntaxValid: true, disposable: false, reason: null };
}
