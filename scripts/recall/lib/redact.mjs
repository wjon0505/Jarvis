// jarvis-kit: generic adaptation of the recall index's redactor from a production multi-agent setup; real values replaced with placeholders.
/**
 * redact.mjs: strip credential shapes from text BEFORE it reaches the recall index.
 *
 * Transcripts and scratch reports are where secrets leak: a pasted env file, a tool result that
 * printed a token. Nothing is written to the index that has not passed through `redact()`, and the
 * replacement is `[REDACTED:<kind>]`, so a reader can see THAT a value stood there and search by the
 * NAME beside it, never by the value.
 *
 * Two halves, in order:
 *   1. the same families as scripts/secrets-sweep.sh (this module must never be weaker than the
 *      push sweep): private-key blocks, cloud keys, provider tokens, JWTs;
 *   2. shapes a diff sweep does not need but a prose dump does: secret-named assignments, URL
 *      credentials, bearer tokens, and high-entropy tokens.
 * `redact()` never logs its input. The self-test plants one value of every kind, assembled from
 * halves at run time so this file carries no matchable literal, and asserts none survives.
 */

const R = (kind) => `[REDACTED:${kind}]`;

/** The whole match is the secret. Counts are lower bounds so a longer key is swallowed whole. */
const WHOLE_MATCH = [
  ['cloud_access_key_id', /AKIA[0-9A-Z]{16}/g],
  ['live_secret_key', /sk_live_[0-9A-Za-z]{16,}/g],
  ['chat_token', /xox[baprs]-[0-9A-Za-z-]{10,}/g],
  ['git_host_token', /(?:ghp|gho|ghs|ghu)_[0-9A-Za-z]{30,}|github_pat_[0-9A-Za-z_]{30,}/g],
  ['cloud_api_key', /AIza[0-9A-Za-z_-]{30,}/g],
  // From BEGIN to the matching END, or to the end of the chunk when END is missing (a truncated dump).
  ['private_key_block', /BEGIN ([A-Z ]*)PRIVATE KEY[\s\S]*?(?:END [A-Z ]*PRIVATE KEY-*|(?![\s\S]))/g],
  ['jwt', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g],
];

/** The NAME stays, the VALUE goes: group 1 is kept, the last group is replaced. */
const VALUE_MATCH = [
  ['cloud_secret', /([Aa][Ww][Ss][^\n]{0,20}[Ss][Ee][Cc][Rr][Ee][Tt][^\n]{0,20}?[:=][ \t]*["']?)([^\s"',;]{4,})/g],
  ['password', /([Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd]\s*[:=]\s*["'])([^"'\n]{8,})/g],
  ['private_key', /([Pp][Rr][Ii][Vv][Aa][Tt][Ee]_[Kk][Ee][Yy]\s*[:=][ \t]*["']?)([^\s"']{4,})/g],
  // A secret-shaped env name given a literal of 8+ characters. Placeholders (`<...>`, `${VAR}`,
  // `[REDACTED...]`) are not literals and are left alone.
  ['env_secret_value', /(\b[A-Z][A-Z0-9_]*?(?:KEY|SECRET|PEPPER|SEED|TOKEN|PASSWORD|PASS|PEM|AUTH|DSN)(?:_PREVIOUS)?"?[ \t]*[:=][ \t]*["']?)([^\s"'`$<[][^\s"'`]{7,})/g],
  ['url_credential', /(\b[a-z][a-z0-9+.-]{1,20}:\/\/[^\s:@/"']{1,64}:)([^\s@/"']{1,256})(?=@)/g],
  ['bearer_token', /(\b[Bb]earer[ \t]+)([A-Za-z0-9._~+/-]{20,}=*)/g],
];

function entropy(s) {
  const freq = new Map();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of freq.values()) { const p = n / s.length; h -= p * Math.log2(p); }
  return h;
}

/**
 * High-entropy tokens: 32+ chars of a base64url-ish alphabet, mixed case, 2+ digits, entropy >= 4.0
 * bits/char, and NOT hexadecimal (a commit sha, a digest and a UUID are hex and must stay searchable).
 * `/` is outside the alphabet so a filesystem path is never a candidate.
 */
function redactHighEntropy(text, counts) {
  return text.replace(/[A-Za-z0-9+_=-]{32,}/g, (tok) => {
    if (tok.includes('REDACTED')) return tok;
    if (/^[0-9a-fA-F]*$/.test(tok.replace(/[-_=]/g, ''))) return tok;
    if ((tok.match(/[0-9]/g) ?? []).length < 2) return tok;
    if (!/[a-z]/.test(tok) || !/[A-Z]/.test(tok)) return tok;
    if (entropy(tok) < 4.0) return tok;
    counts.high_entropy_token = (counts.high_entropy_token ?? 0) + 1;
    return R('high_entropy_token');
  });
}

/** Returns { text, counts }. Counts are the only thing a caller may print. */
export function redact(text) {
  const counts = {};
  let out = text;
  for (const [kind, re] of WHOLE_MATCH) out = out.replace(re, () => { counts[kind] = (counts[kind] ?? 0) + 1; return R(kind); });
  for (const [kind, re] of VALUE_MATCH) out = out.replace(re, (...m) => { counts[kind] = (counts[kind] ?? 0) + 1; return `${m[1]}${R(kind)}`; });
  return { text: redactHighEntropy(out, counts), counts };
}

export function mergeCounts(into, from) {
  for (const [k, v] of Object.entries(from)) into[k] = (into[k] ?? 0) + v;
  return into;
}

export const REDACTION_KINDS = [...WHOLE_MATCH.map(([k]) => k), ...VALUE_MATCH.map(([k]) => k), 'high_entropy_token'];

/** One synthetic planted value per kind, assembled from halves (no matchable literal in this file). */
export function plantedSecrets() {
  const j = (...parts) => parts.join('');
  return [
    { kind: 'cloud_access_key_id', value: j('AKIA', 'IOSFODNN7EXAMPLE'), line: (v) => `access_key_id = ${v}` },
    { kind: 'live_secret_key', value: j('sk_live_', '4eC39HqLyjWDarjtT1zdp7dc'), line: (v) => `PAYMENTS=${v}` },
    { kind: 'chat_token', value: j('xoxb-', '1234567890-abcdefghijklmn'), line: (v) => `chat ${v}` },
    { kind: 'git_host_token', value: j('ghp_', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'), line: (v) => `auth ${v}` },
    { kind: 'cloud_api_key', value: j('AIza', 'SyA1234567890abcdefghijklmnopqrstuv'), line: (v) => `maps ${v}` },
    { kind: 'private_key_block', value: j('MIIBVwIBADANBgkqhkiG9w0BAQEFAASCAUEwggE9AgEAAkEA', 'u7WzFAKEFAKEFAKE'), line: (v) => `-----${j('BEGIN RSA PRIVATE', ' KEY')}-----\n${v}\n-----${j('END RSA PRIVATE', ' KEY')}-----` },
    { kind: 'jwt', value: j('eyJhbGciOiJIUzI1NiJ9', '.', 'eyJzdWIiOiJ4eCJ9', '.', 'c2lnbmF0dXJlLXNpZ25hdHVyZQ'), line: (v) => `token ${v}` },
    { kind: 'cloud_secret', value: j('wJalrXUtnFEMI', 'K7MDENGbPxRfiCYEXAMPLEKEY'), line: (v) => `${j('aws_secret_', 'access_key')} = ${v}` },
    { kind: 'password', value: j('hunter2', 'hunter2hunter2'), line: (v) => `${j('pass', 'word')}: "${v}"` },
    { kind: 'private_key', value: j('abcd1234', 'efgh5678'), line: (v) => `${j('PRIVATE_', 'KEY')}=${v}` },
    { kind: 'env_secret_value', value: j('0123456789abcdef', '0123456789abcdef'), line: (v) => `EXAMPLE_ENC_${j('K', 'EY')}=${v}` },
    { kind: 'url_credential', value: j('p4ssw0rd', 'secret'), line: (v) => `postgresql://app:${v}@localhost:5432/db` },
    { kind: 'bearer_token', value: j('AbCdEfGhIjKlMnOpQrStUvWxYz', '0123456789'), line: (v) => `Authorization: ${j('Bea', 'rer')} ${v}` },
    { kind: 'high_entropy_token', value: j('Qz7', 'bX2m', 'Kp9v', 'Rt4w', 'Ly6n', 'Hs3d', 'Fj8c', 'Gu5e', 'Wa1o', 'Zi0y', 'Nq'), line: (v) => `session ${v} started` },
  ];
}

/** Text that must pass through unchanged: the identifiers the index exists to find. */
export const CLEAN_SAMPLE = [
  'REQ-0042 was filed by lane BOOKINGS-CACHE-1 on 2030-01-25; see DEC-017 and the unit gate 1,204 / 96.',
  'commit 2a7c41ff05ec23fb1cd94923ea7dba16b96a4385 on main; sha 2a7c41ff0; GHSA-abcd-efgh-ijkl.',
  'session 11111111-2222-4333-8444-555555555555 cwd /home/dev/projects/example-app',
  'DATABASE_URL=<set in the secret store> and TEST_DATABASE_URL=${TEST_DATABASE_URL} and EXAMPLE_ENC_KEY=[REDACTED:env_secret_value]',
  'apps/api/src/bookings/bookings.service.spec.ts example_test postgresql://localhost:5432/example_test',
].join('\n');
