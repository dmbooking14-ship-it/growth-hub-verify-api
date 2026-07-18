# Growth Hub — Email Verification API

Small serverless function. Keeps your MyEmailVerifier and ZeroBounce
API keys off the frontend entirely. Your Growth Hub app calls this
endpoint; this endpoint calls the verification providers.

## Where to put your real API keys

**You do NOT edit any `.js` file to add your keys.** Every provider
file reads its key from an environment variable — that's the whole
point of this setup. Keys live in exactly one place:

### Step-by-step:
1. Push this folder to a GitHub repo (or deploy it directly via the
   Vercel CLI — either works).
2. Go to https://vercel.com → New Project → import this repo.
3. Before or after the first deploy, go to:
   **Project → Settings → Environment Variables**
4. Add these two variables:

   | Name | Value |
   |---|---|
   | `MYEMAILVERIFIER_API_KEY` | (your MyEmailVerifier key, account 1) |
   | `MYEMAILVERIFIER_API_KEY_2` | (your MyEmailVerifier key, account 2) |
   | `ZEROBOUNCE_API_KEY` | (your ZeroBounce key, account 1) |
   | `ZEROBOUNCE_API_KEY_2` | (your ZeroBounce key, account 2) |
   | `ABSTRACTAPI_EMAIL_KEY` | (your Abstract API email-validation key, account 1) |
   | `ABSTRACTAPI_EMAIL_KEY_2` | (your Abstract API email-validation key, account 2) |
   | `ZERUH_API_KEY` | (your Zeruh key, account 1) |
   | `ZERUH_API_KEY_2` | (your Zeruh key, account 2) |

   Note the naming: the first key of each provider has NO numeric
   suffix (`MYEMAILVERIFIER_API_KEY`, not `..._KEY_1`) — this matches
   however you already created these in Vercel. The second account
   uses `_2`. Every provider file expects exactly this pattern.

   You don't need all 8 filled in to start — each provider file
   checks for both its keys and skips any that aren't set, so you
   can add account 2 for each provider whenever it's ready (e.g.
   once your partner creates theirs) without breaking anything.

   QuickEmailVerification was removed from the fallback chain (it's
   not actually free past a small trial) and replaced with Abstract
   API and Zeruh, both genuinely free with no credit card required
   at time of integration — re-check their pricing pages if you're
   relying on this at real volume, since free-tier terms can change.

5. Redeploy (Vercel usually prompts you to redeploy automatically
   after adding env vars — if not, trigger one manually from the
   Deployments tab).

That's it. No file in this project ever contains a real key.

## Files in this project

- `api/verify-email.js` — the actual endpoint URL your frontend calls.
  Do not rename this file; the filename IS the URL path (`/api/verify-email`).
- `api/emailVerificationManager.js` — holds the fallback order
  (MyEmailVerifier first, ZeroBounce if that fails). **This is the
  only file you'd edit to add a 3rd provider later.**
- `api/providers/myEmailVerifier.js` — talks to MyEmailVerifier's API.
- `api/providers/zeroBounce.js` — talks to ZeroBounce's API.
- `api/providers/localChecks.js` — free syntax + known-disposable-domain
  checks, run before any paid API call.

## Testing it once deployed

```bash
curl -X POST https://YOUR-PROJECT-NAME.vercel.app/api/verify-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Should return JSON like:
```json
{
  "provider": "myemailverifier",
  "email": "test@example.com",
  "status": "safe",
  "syntaxValid": true,
  "domainValid": true,
  "mxValid": true,
  "disposable": false,
  "roleAddress": false,
  "score": 95,
  "raw": { ... }
}
```

## A note on provider response field names

`myEmailVerifier.js` and `zeroBounce.js` were written against each
provider's documented response format at build time. If either
provider changes their API response shape in the future, the fix is
localized entirely to that one file — nothing else in this project
or in the main Growth Hub app needs to change.
