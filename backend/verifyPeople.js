/**
 * "Add person" (POST /api/people) end-to-end verification against the live backend.
 *
 * Same shape as verifyProfile.js (one scripted run, PASS/FAIL per check), with the
 * test account read from env vars instead of being hardcoded:
 *
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PORT
 *   SUPABASE_ANON_KEY  (falls back to frontend/.env VITE_SUPABASE_ANON_KEY)
 *   TEST_USER_EMAIL, TEST_USER_PASSWORD
 *
 * What it covers:
 *   401 without a token; creating with a name only (email stored as null);
 *   name + email trimmed; empty/whitespace-only name rejected; a 61 character
 *   name rejected; a malformed email rejected; a duplicate name in a different
 *   casing rejected with 409 PERSON_EXISTS; and a request body carrying someone
 *   else's userId still creating the person under the caller's own id.
 *
 * Notes:
 *   - Passwords and tokens are never printed; all output goes through redact().
 *   - Every person this script creates is deleted again through the service-role
 *     client in a finally block, so the account is left exactly as found.
 *   - The duplicate check depends on the unique index added by
 *     backend/sql/migration/add_people_unique_name.sql. That migration must be
 *     run manually in the Supabase SQL Editor. Until it is, the duplicate case
 *     is reported as PENDING rather than silently passing.
 *
 * Usage:
 *   node verifyPeople.js        (backend must already be running: npm start)
 */

require('dotenv/config');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const BACKEND_DIR = __dirname;
const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;
const MIGRATION_FILE = path.join(
  BACKEND_DIR,
  'sql',
  'migration',
  'add_people_unique_name.sql'
);

// ---------------------------------------------------------------- reporting

const results = [];

function section(title) {
  console.log(`\n--- ${title} ---`);
}

function check(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail });
  const suffix = detail ? ` — ${redact(detail)}` : '';
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${suffix}`);
  return Boolean(ok);
}

function note(message) {
  console.log(`NOTE: ${redact(message)}`);
}

// ---------------------------------------------------------------- redaction

const secrets = new Set();

function rememberSecret(value) {
  if (typeof value === 'string' && value.length >= 6) {
    secrets.add(value);
  }
}

function redact(input) {
  let out = String(input ?? '');
  for (const secret of secrets) {
    out = out.split(secret).join('<redacted>');
  }
  out = out.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer <redacted>');
  out = out.replace(/eyJ[A-Za-z0-9._-]{10,}/g, '<redacted-token>');
  return out;
}

// ---------------------------------------------------------------- utilities

async function api(method, endpoint, { token, body, timeoutMs } = {}) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: payload,
    signal: AbortSignal.timeout(timeoutMs ?? 30_000),
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { status: response.status, ok: response.ok, json, text };
}

function readFrontendAnonKey() {
  const frontendEnvPath = path.join(BACKEND_DIR, '..', 'frontend', '.env');
  if (!fs.existsSync(frontendEnvPath)) return null;

  const match = fs
    .readFileSync(frontendEnvPath, 'utf8')
    .match(/^\s*VITE_SUPABASE_ANON_KEY\s*=\s*(.+)$/m);

  return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
}

function anonKeyCandidates() {
  const candidates = [];
  const push = (source, key) => {
    if (key && !candidates.some((candidate) => candidate.key === key)) {
      candidates.push({ source, key });
    }
  };

  push('SUPABASE_ANON_KEY (backend/.env)', process.env.SUPABASE_ANON_KEY);
  push('VITE_SUPABASE_ANON_KEY (backend/.env)', process.env.VITE_SUPABASE_ANON_KEY);
  push('frontend/.env (VITE_SUPABASE_ANON_KEY)', readFrontendAnonKey());

  return candidates;
}

function isInvalidApiKey(result) {
  return /invalid api key/i.test(result.error ?? '');
}

// ---------------------------------------------------------------- clients

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

let activeAuthKey = null;

async function signIn(email, password, key) {
  const client = createClient(process.env.SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error || !data?.session?.access_token) {
    return { ok: false, error: error?.message ?? 'sign-in returned no session' };
  }

  rememberSecret(data.session.access_token);
  rememberSecret(data.session.refresh_token);

  return { ok: true, token: data.session.access_token, userId: data.user?.id };
}

// Tries each candidate anon key until one is accepted by Supabase Auth.
async function resolveAuthKey(email, password) {
  const attempts = [];

  for (const candidate of anonKeyCandidates()) {
    const result = await signIn(email, password, candidate.key);

    if (result.ok) {
      activeAuthKey = candidate;
      return { ok: true, candidate, result, attempts };
    }

    attempts.push({ source: candidate.source, error: result.error });

    if (!isInvalidApiKey(result)) {
      activeAuthKey = candidate;
      return { ok: false, candidate, result, attempts, keyAccepted: true };
    }
  }

  return { ok: false, candidate: null, result: null, attempts, keyAccepted: false };
}

// ---------------------------------------------------------------- state

const state = {
  token: null,
  userId: null,
  createdIds: [],
  duplicateIndexPresent: null,
};

const stamp = Date.now().toString(36);

function trackPerson(person) {
  if (person && typeof person.id === 'string') {
    state.createdIds.push(person.id);
  }
  return person;
}

// ---------------------------------------------------------------- cleanup

async function deleteCreatedPeople() {
  if (state.createdIds.length === 0) {
    return { skipped: true };
  }

  const ids = [...new Set(state.createdIds)];
  const { error } = await supabaseAdmin.from('people').delete().in('id', ids);

  if (error) {
    return { ok: false, detail: `could not delete ${ids.length} created person(s): ${error.message}` };
  }

  return { ok: true, detail: `deleted ${ids.length} created person(s)` };
}

// ---------------------------------------------------------------- checks

function looksLikePerson(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Object.prototype.hasOwnProperty.call(value, 'email')
  );
}

async function runCreateChecks() {
  section('Auth');

  const noToken = await api('POST', '/api/people', { body: { name: 'Should Not Exist' } });
  check('POST /api/people without a token returns 401', noToken.status === 401, `got ${noToken.status}`);

  section('Create');

  // 1. Name only -> email must come back as null.
  const nameOnly = await api('POST', '/api/people', {
    token: state.token,
    body: { name: `Verify ${stamp}` },
  });
  trackPerson(nameOnly.json);
  const nameOnlyOk = (nameOnly.status === 201 || nameOnly.status === 200) && looksLikePerson(nameOnly.json);
  check(
    'Name only returns 201/200 with the {id, name, email} list shape',
    nameOnlyOk,
    `status=${nameOnly.status} keys=${nameOnly.json ? Object.keys(nameOnly.json).join(',') : 'n/a'}`
  );
  check(
    'Name only stores a null email',
    nameOnlyOk && nameOnly.json.email === null,
    `email=${JSON.stringify(nameOnly.json?.email ?? null)}`
  );
  check(
    'Name is stored trimmed',
    nameOnlyOk && nameOnly.json.name === `Verify ${stamp}`,
    `stored=${JSON.stringify(nameOnly.json?.name)}`
  );

  // 2. Name + email, both padded with spaces to prove trimming.
  const withEmail = await api('POST', '/api/people', {
    token: state.token,
    body: { name: `  Verify Email ${stamp}  `, email: `  verify.${stamp}@example.com  ` },
  });
  trackPerson(withEmail.json);
  check(
    'Name + email returns 201/200',
    (withEmail.status === 201 || withEmail.status === 200) && looksLikePerson(withEmail.json),
    `status=${withEmail.status}`
  );
  check(
    'Name and email are both stored trimmed',
    withEmail.json?.name === `Verify Email ${stamp}` &&
      withEmail.json?.email === `verify.${stamp}@example.com`,
    `name=${JSON.stringify(withEmail.json?.name)} email=${JSON.stringify(withEmail.json?.email)}`
  );

  section('Validation');

  const emptyName = await api('POST', '/api/people', { token: state.token, body: { name: '' } });
  check(
    'Empty name returns 400 INVALID_NAME',
    emptyName.status === 400 && emptyName.json?.code === 'INVALID_NAME',
    `status=${emptyName.status} code=${emptyName.json?.code ?? 'none'}`
  );

  const whitespaceName = await api('POST', '/api/people', {
    token: state.token,
    body: { name: '   ' },
  });
  check(
    'Whitespace-only name returns 400 INVALID_NAME',
    whitespaceName.status === 400 && whitespaceName.json?.code === 'INVALID_NAME',
    `status=${whitespaceName.status} code=${whitespaceName.json?.code ?? 'none'}`
  );

  const longName = await api('POST', '/api/people', {
    token: state.token,
    body: { name: 'x'.repeat(61) },
  });
  check(
    'A 61 character name returns 400 INVALID_NAME',
    longName.status === 400 && longName.json?.code === 'INVALID_NAME',
    `status=${longName.status} code=${longName.json?.code ?? 'none'}`
  );

  const badEmail = await api('POST', '/api/people', {
    token: state.token,
    body: { name: `Verify Bad Email ${stamp}`, email: 'not-an-email' },
  });
  trackPerson(badEmail.json);
  check(
    'A malformed email returns 400 INVALID_EMAIL',
    badEmail.status === 400 && badEmail.json?.code === 'INVALID_EMAIL',
    `status=${badEmail.status} code=${badEmail.json?.code ?? 'none'}`
  );

  const emptyEmail = await api('POST', '/api/people', {
    token: state.token,
    body: { name: `Verify Empty Email ${stamp}`, email: '   ' },
  });
  trackPerson(emptyEmail.json);
  check(
    'A whitespace-only email is treated as "no email" rather than an error',
    (emptyEmail.status === 201 || emptyEmail.status === 200) && emptyEmail.json?.email === null,
    `status=${emptyEmail.status} email=${JSON.stringify(emptyEmail.json?.email ?? null)}`
  );

  section('Duplicates');

  const firstName = `Dup ${stamp}`;
  const first = await api('POST', '/api/people', { token: state.token, body: { name: firstName } });
  trackPerson(first.json);
  check(
    'First person with the duplicate name is created',
    first.status === 201 || first.status === 200,
    `status=${first.status}`
  );

  const second = await api('POST', '/api/people', {
    token: state.token,
    body: { name: firstName.toLowerCase() },
  });
  trackPerson(second.json);

  const duplicateEnforced = second.status === 409 && second.json?.code === 'PERSON_EXISTS';
  state.duplicateIndexPresent = duplicateEnforced;

  if (duplicateEnforced) {
    check('The same name in a different casing returns 409 PERSON_EXISTS', true, `status=409`);
    check(
      'The 409 carries a friendly message',
      typeof second.json?.error === 'string' && second.json.error.length > 0,
      `error=${JSON.stringify(second.json?.error)}`
    );
  } else if (second.status === 201 || second.status === 200) {
    // The insert succeeded, which means the unique index is not in place yet.
    check('The same name in a different casing returns 409 PERSON_EXISTS', false,
      `got ${second.status} — the unique index looks missing, run ${path.basename(MIGRATION_FILE)}`);
    note(
      `The duplicate was accepted, so the unique index on (user_id, lower(name)) is not applied yet. ` +
        `Run backend/sql/migration/add_people_unique_name.sql in the Supabase SQL Editor, then re-run this script. ` +
        `The extra row it created was cleaned up.`
    );
  } else {
    check('The same name in a different casing returns 409 PERSON_EXISTS', false,
      `unexpected status=${second.status} body=${second.text?.slice(0, 120)}`);
  }

  section('Owner is taken from the token');

  // Find a profile id that is not the caller's, to prove a body userId is ignored.
  let otherUserId = null;
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .neq('id', state.userId)
    .limit(1);

  if (profilesError) {
    note(`Could not read profiles to find another user id (${profilesError.message}); using a random UUID instead.`);
  } else if (profiles && profiles.length > 0) {
    otherUserId = profiles[0].id;
  }

  const spoofedId = otherUserId ?? crypto.randomUUID();
  const spoof = await api('POST', '/api/people', {
    token: state.token,
    body: { name: `Verify Spoof ${stamp}`, userId: spoofedId },
  });
  trackPerson(spoof.json);

  check(
    'A body containing another userId still creates the person',
    (spoof.status === 201 || spoof.status === 200) && looksLikePerson(spoof.json),
    `status=${spoof.status} spoofedIdSource=${otherUserId ? 'another profile' : 'random uuid'}`
  );

  if (looksLikePerson(spoof.json)) {
    const { data: stored, error: storedError } = await supabaseAdmin
      .from('people')
      .select('id, user_id, name')
      .eq('id', spoof.json.id)
      .maybeSingle();

    if (storedError) {
      check('The created person belongs to the caller', false, storedError.message);
    } else {
      check(
        'The created person belongs to the caller, not the userId in the body',
        stored?.user_id === state.userId && stored?.user_id !== spoofedId,
        `storedUserIdMatchesCaller=${stored?.user_id === state.userId}`
      );
    }
  }
}

// ---------------------------------------------------------------- summary

function printSummary() {
  const passed = results.filter((result) => result.ok).length;
  const failed = results.length - passed;

  console.log('\n--- FINAL SUMMARY ---');
  console.log(`Checks run: ${results.length}`);
  console.log(`Passed:     ${passed}`);
  console.log(`Failed:     ${failed}`);

  if (failed > 0) {
    console.log('\nFailed checks:');
    for (const result of results.filter((entry) => !entry.ok)) {
      console.log(`  - ${result.name}${result.detail ? ` (${redact(result.detail)})` : ''}`);
    }
  }

  if (state.duplicateIndexPresent === false) {
    console.log('\nReminder: run backend/sql/migration/add_people_unique_name.sql in the');
    console.log('Supabase SQL Editor so duplicate names are rejected with 409 PERSON_EXISTS.');
  }

  console.log(`\nRESULT: ${failed === 0 ? 'PASS — every check passed.' : 'FAIL — see the failures above.'}`);
}

// ---------------------------------------------------------------- main

async function main() {
  console.log('--- Add person (POST /api/people) verification ---');
  console.log(`Backend: ${BASE_URL}`);
  console.log(`Test user: ${process.env.TEST_USER_EMAIL ?? '(TEST_USER_EMAIL not set)'}`);
  console.log('Credentials come from backend/.env; passwords and tokens are never printed.');

  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  rememberSecret(password);

  if (!email || !password) {
    console.error('\nTEST_USER_EMAIL and TEST_USER_PASSWORD must be set in backend/.env.');
    process.exitCode = 1;
    return;
  }

  const health = await api('GET', '/health');
  if (!health.ok) {
    console.error(`\nBackend health check failed (${health.status}). Start it with: npm start`);
    process.exitCode = 1;
    return;
  }
  console.log('Backend health check: ok');

  section('Sign in');

  const resolved = await resolveAuthKey(email, password);

  if (resolved.ok) {
    check(`Login with TEST_USER_EMAIL succeeds (anon key from ${resolved.candidate.source})`, true);
  } else if (resolved.keyAccepted) {
    check('Login with TEST_USER_EMAIL succeeds', false, resolved.result.error);
    return;
  } else {
    check('Login with TEST_USER_EMAIL succeeds', false,
      `every anon key candidate was rejected: ${resolved.attempts.map((a) => `${a.source}: ${a.error}`).join('; ')}`);
    return;
  }

  state.token = resolved.result.token;
  state.userId = resolved.result.userId;
  check('Signed-in user id was returned', typeof state.userId === 'string' && state.userId.length > 0);

  await runCreateChecks();
}

(async () => {
  try {
    await main();
  } catch (error) {
    console.error(
      '\nScript encountered an unexpected error:',
      redact(error?.stack ?? error?.message ?? error)
    );
    process.exitCode = 1;
  } finally {
    // Safety net: always remove anything this script created, even if a check
    // above blew up halfway through.
    try {
      const cleanup = await deleteCreatedPeople();
      if (!cleanup.skipped) {
        check('Cleanup: created people deleted', cleanup.ok, cleanup.detail);
      }
    } catch (error) {
      console.error('Cleanup failed while deleting created people:', redact(error?.message ?? error));
      process.exitCode = 1;
    }

    printSummary();

    if (results.some((result) => !result.ok)) {
      process.exitCode = 1;
    }
  }
})();
