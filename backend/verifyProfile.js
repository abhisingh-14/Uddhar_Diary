/**
 * Profile + change-password end-to-end verification against the live backend.
 *
 * Same shape as verifyPartA.js (one scripted run, PASS/FAIL per check), except
 * the test account is read from env vars instead of being hardcoded:
 *
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PORT
 *   SUPABASE_ANON_KEY  (falls back to frontend/.env VITE_SUPABASE_ANON_KEY)
 *   TEST_USER_EMAIL, TEST_USER_PASSWORD
 *
 * What it covers:
 *   Profile     GET/PATCH /api/profile — 401 without a token, shape with a
 *               token, trimming, empty/too-long rejection, extra fields
 *               ignored, and restoring the original fullName afterwards.
 *   Password    POST /api/account/change-password — every error code, a real
 *               change to a generated temporary password, a fresh login with
 *               the new password (and a failed login with the old one), then a
 *               change back to the original so the account stays usable.
 *   Route audit every file in src/routes/ applies requireAuth and every router
 *               is registered in index.js.
 *
 * Notes:
 *   - Passwords and tokens are never printed; all output goes through redact()
 *     as a safety net.
 *   - The anon key is resolved from SUPABASE_ANON_KEY, then a VITE_SUPABASE_ANON_KEY
 *     env var, then frontend/.env. If backend/.env's key is rejected by Supabase
 *     Auth the script says so and uses a working one for its own sign-in — but the
 *     backend's change-password verifier (src/lib/supabaseVerifier.js) reads
 *     SUPABASE_ANON_KEY directly, so its happy path keeps failing until that is fixed.
 *   - The account router rate-limits failed password changes to 10 per 15
 *     minutes per user, and this script spends ~4 of those, so back-to-back
 *     runs can hit a 429.
 *   - The original fullName is restored through the DB (service role) because
 *     the PATCH endpoint cannot express null, and the original password is
 *     restored through the admin API whenever it is shorter than the endpoint's
 *     8 character minimum.
 *
 * Usage:
 *   node verifyProfile.js        (backend must already be running: npm start)
 */

require('dotenv/config');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const BACKEND_DIR = __dirname;
const ROUTES_DIR = path.join(BACKEND_DIR, 'src', 'routes');
const INDEX_FILE = path.join(BACKEND_DIR, 'index.js');
const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  // Belt and braces: any JWT-looking string or bearer header is scrubbed even
  // if it never went through rememberSecret().
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

function describeFullName(value) {
  if (value === null) return 'null (was unset)';
  if (value === undefined) return 'unknown';
  return JSON.stringify(value);
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

async function login(email, password) {
  if (!activeAuthKey) {
    return { ok: false, error: 'no Supabase anon key resolved yet' };
  }
  return signIn(email, password, activeAuthKey.key);
}

// Tries each candidate anon key until one is accepted by Supabase Auth. A key
// that fails with anything other than "Invalid API key" is accepted by the
// auth server, so the credentials (not the key) are the problem.
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
  email: process.env.TEST_USER_EMAIL,
  userId: null,
  token: null,
  originalPassword: process.env.TEST_USER_PASSWORD,
  tempPassword: null,
  passwordIsTemp: false,
  passwordRestoreRejection: null,
  passwordRestoreRejectionDetail: null,
  originalFullName: undefined,
  fullNameRestored: false,
};

async function readStoredFullName() {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', state.userId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: 'profile row not found' };
  return { value: data.full_name };
}

// Restores the original fullName straight through the DB, because the API can
// only express strings of length 1..60 and the original may be null.
async function restoreOriginalFullName() {
  if (!state.userId || state.originalFullName === undefined) {
    return { skipped: true, ok: false };
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ full_name: state.originalFullName })
    .eq('id', state.userId);

  const stored = await readStoredFullName();
  const ok = !error && stored.value === state.originalFullName;

  state.fullNameRestored = ok;

  return {
    skipped: false,
    ok,
    detail: error
      ? `update failed: ${error.message}`
      : ok
        ? `stored value is ${describeFullName(stored.value)} again`
        : `stored value is ${describeFullName(stored.value)}, expected ${describeFullName(state.originalFullName)}`,
  };
}

// Puts the original password back. The public endpoint enforces a minimum
// length of 8, so an original password shorter than that can only be restored
// through the admin API (same service-role client the backend itself uses).
async function restoreOriginalPassword() {
  if (!state.passwordIsTemp) {
    return { skipped: true, ok: false };
  }

  let apiFailure = null;
  const session = await login(state.email, state.tempPassword);

  if (session.ok) {
    const res = await api('POST', '/api/account/change-password', {
      token: session.token,
      body: { currentPassword: state.tempPassword, newPassword: state.originalPassword },
    });

    if (res.status === 200) {
      state.passwordIsTemp = false;
      return { skipped: false, ok: true, via: 'the change-password API' };
    }

    apiFailure = `the change-password API returned ${res.status}${res.json?.code ? ` (${res.json.code})` : ''}`;
    state.passwordRestoreRejection = res.status === 400 && res.json?.code === 'WEAK_PASSWORD';
    state.passwordRestoreRejectionDetail = `status=${res.status} code=${res.json?.code ?? 'none'}`;
  } else {
    apiFailure = `could not sign in with the temporary password (${session.error})`;
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(state.userId, {
    password: state.originalPassword,
  });

  if (error) {
    return { skipped: false, ok: false, detail: `${apiFailure}; admin API failed too: ${error.message}` };
  }

  const verified = await login(state.email, state.originalPassword);
  state.passwordIsTemp = !verified.ok;

  return {
    skipped: false,
    ok: verified.ok,
    via: 'the admin API',
    detail: verified.ok
      ? `${apiFailure}, restored through the admin API instead`
      : `${apiFailure}; the admin API reported success but the original password still does not log in`,
  };
}

// ---------------------------------------------------------------- profile

async function runProfileChecks() {
  section('Profile');

  // 1. No token -> 401
  const noToken = await api('GET', '/api/profile');
  check(
    'GET /api/profile without a token returns 401',
    noToken.status === 401,
    `got ${noToken.status}`
  );

  // 2. Valid token -> 200 with id, fullName (may be null), email
  const withToken = await api('GET', '/api/profile', { token: state.token });
  const profile = withToken.json?.profile;
  const idOk = typeof profile?.id === 'string' && UUID_RE.test(profile.id);
  const idMatchesSession = profile?.id === state.userId;
  const fullNameOk =
    profile !== undefined &&
    Object.prototype.hasOwnProperty.call(profile, 'fullName') &&
    (profile.fullName === null || typeof profile.fullName === 'string');
  const emailOk =
    typeof profile?.email === 'string' &&
    profile.email.toLowerCase() === String(state.email).toLowerCase();

  check(
    'GET /api/profile with a valid token returns 200 with id, fullName (may be null) and email',
    withToken.status === 200 && idOk && idMatchesSession && fullNameOk && emailOk,
    `status=${withToken.status} id=${idOk ? 'uuid' : JSON.stringify(profile?.id)} idMatchesSession=${idMatchesSession} fullName=${describeFullName(profile?.fullName)} emailOk=${emailOk}`
  );

  // 3. Trimming on PATCH
  const trimRes = await api('PATCH', '/api/profile', {
    token: state.token,
    body: { fullName: '  Test Name  ' },
  });
  const trimmedInResponse = trimRes.json?.profile?.fullName === 'Test Name';
  const storedAfterTrim = await readStoredFullName();
  const trimmedInDb = storedAfterTrim.value === 'Test Name';

  check(
    'PATCH /api/profile { fullName: "  Test Name  " } returns 200 and stores the trimmed value',
    trimRes.status === 200 && trimmedInResponse && trimmedInDb,
    `status=${trimRes.status} response=${describeFullName(trimRes.json?.profile?.fullName)} stored=${describeFullName(storedAfterTrim.value)}`
  );

  // 4. Empty string -> 400
  const emptyRes = await api('PATCH', '/api/profile', { token: state.token, body: { fullName: '' } });
  check(
    'PATCH /api/profile { fullName: "" } returns 400',
    emptyRes.status === 400,
    `got ${emptyRes.status}`
  );

  // 5. 61 characters -> 400
  const longName = 'x'.repeat(61);
  const longRes = await api('PATCH', '/api/profile', { token: state.token, body: { fullName: longName } });
  check(
    'PATCH /api/profile with a 61 character fullName returns 400',
    longRes.status === 400,
    `got ${longRes.status}`
  );

  // 6. Extra fields are ignored (an "id" in the body must not change the row)
  const otherId = crypto.randomUUID();
  const extraRes = await api('PATCH', '/api/profile', {
    token: state.token,
    body: { fullName: 'OK', id: otherId },
  });
  const returnedId = extraRes.json?.profile?.id;
  const storedAfterExtra = await readStoredFullName();
  const ownRowStillThere = storedAfterExtra.error === undefined;

  check(
    'PATCH /api/profile { fullName: "OK", id: <other uuid> } returns 200 and leaves the profile id unchanged',
    extraRes.status === 200 &&
      returnedId === state.userId &&
      ownRowStillThere &&
      storedAfterExtra.value === 'OK',
    `status=${extraRes.status} returnedIdMatches=${returnedId === state.userId} ownRow=${ownRowStillThere ? 'present' : storedAfterExtra.error} stored=${describeFullName(storedAfterExtra.value)}`
  );

  // 7. Restore the original fullName
  const restore = await restoreOriginalFullName();
  check(
    `Original fullName restored via DB (${describeFullName(state.originalFullName)})`,
    restore.ok,
    restore.detail
  );
}

// ---------------------------------------------------------------- password

async function runPasswordChecks() {
  section('Change password');

  // 1. No token -> 401
  const noToken = await api('POST', '/api/account/change-password', {
    body: { currentPassword: state.originalPassword, newPassword: 'whatever-123' },
  });
  check(
    'POST /api/account/change-password without a token returns 401',
    noToken.status === 401,
    `got ${noToken.status}`
  );

  // 2. Missing fields -> 400 MISSING_FIELDS
  const missingRes = await api('POST', '/api/account/change-password', {
    token: state.token,
    body: {},
  });
  check(
    'Missing fields returns 400 MISSING_FIELDS',
    missingRes.status === 400 && missingRes.json?.code === 'MISSING_FIELDS',
    `status=${missingRes.status} code=${missingRes.json?.code ?? 'none'}`
  );

  // 3. newPassword too short -> 400 WEAK_PASSWORD
  const weakRes = await api('POST', '/api/account/change-password', {
    token: state.token,
    body: { currentPassword: state.originalPassword, newPassword: 'short7!' },
  });
  check(
    'newPassword shorter than 8 characters returns 400 WEAK_PASSWORD',
    weakRes.status === 400 && weakRes.json?.code === 'WEAK_PASSWORD',
    `status=${weakRes.status} code=${weakRes.json?.code ?? 'none'}`
  );

  // 4. newPassword === currentPassword -> 400 SAME_PASSWORD.
  // The endpoint checks length before sameness, so this is only reachable while
  // the active password is at least 8 characters long; otherwise it is checked
  // further down, once the temporary password is in place.
  const originalPasswordIsLongEnough = state.originalPassword.length >= 8;

  if (originalPasswordIsLongEnough) {
    const sameRes = await api('POST', '/api/account/change-password', {
      token: state.token,
      body: { currentPassword: state.originalPassword, newPassword: state.originalPassword },
    });
    check(
      'newPassword equal to currentPassword returns 400 SAME_PASSWORD',
      sameRes.status === 400 && sameRes.json?.code === 'SAME_PASSWORD',
      `status=${sameRes.status} code=${sameRes.json?.code ?? 'none'}`
    );
  }

  // 5. Wrong currentPassword -> 400 INVALID_CURRENT_PASSWORD (specifically NOT 401)
  const wrongCurrent = `Wrong-${crypto.randomBytes(8).toString('hex')}`;
  state.tempPassword = `Vp-${crypto.randomBytes(9).toString('hex')}`;
  rememberSecret(state.tempPassword);
  rememberSecret(wrongCurrent);

  const wrongRes = await api('POST', '/api/account/change-password', {
    token: state.token,
    body: { currentPassword: wrongCurrent, newPassword: state.tempPassword },
  });
  check(
    'Wrong currentPassword returns 400 INVALID_CURRENT_PASSWORD (and not 401)',
    wrongRes.status !== 401 &&
      wrongRes.status === 400 &&
      wrongRes.json?.code === 'INVALID_CURRENT_PASSWORD',
    `status=${wrongRes.status} (not 401: ${wrongRes.status !== 401}) code=${wrongRes.json?.code ?? 'none'}`
  );

  // 6. Correct current + valid new -> 200, then prove it took effect
  const changeRes = await api('POST', '/api/account/change-password', {
    token: state.token,
    body: { currentPassword: state.originalPassword, newPassword: state.tempPassword },
  });
  const changed = changeRes.status === 200 && changeRes.json?.success === true;
  if (changed) state.passwordIsTemp = true;

  check(
    'Correct currentPassword + valid new password returns 200',
    changed,
    `status=${changeRes.status} success=${changeRes.json?.success ?? 'none'}`
  );

  if (changed) {
    const newLogin = await login(state.email, state.tempPassword);
    check('A fresh login with the NEW password succeeds', newLogin.ok, newLogin.error);

    const oldLogin = await login(state.email, state.originalPassword);
    check(
      'A login with the OLD password now fails',
      !oldLogin.ok,
      oldLogin.ok ? 'the old password still works — the change did not take effect' : 'rejected as expected'
    );

    if (newLogin.ok) {
      state.token = newLogin.token;
    }

    // Deferred from above: the original password is shorter than 8 characters,
    // so sameness is checked against the temporary password instead.
    if (!originalPasswordIsLongEnough) {
      const sameRes = await api('POST', '/api/account/change-password', {
        token: state.token,
        body: { currentPassword: state.tempPassword, newPassword: state.tempPassword },
      });
      check(
        'newPassword equal to currentPassword returns 400 SAME_PASSWORD',
        sameRes.status === 400 && sameRes.json?.code === 'SAME_PASSWORD',
        `status=${sameRes.status} code=${sameRes.json?.code ?? 'none'} (checked with the temporary password because the original is ${state.originalPassword.length} characters, so WEAK_PASSWORD fires first)`
      );
    }
  } else {
    check('A fresh login with the NEW password succeeds', false, 'skipped: the password change itself failed');
    check('A login with the OLD password now fails', false, 'skipped: the password change itself failed');
    if (!originalPasswordIsLongEnough) {
      check(
        'newPassword equal to currentPassword returns 400 SAME_PASSWORD',
        false,
        'skipped: the password change itself failed'
      );
    }
  }

  // 7. Change back to the original so the account stays usable
  const revert = await restoreOriginalPassword();

  if (originalPasswordIsLongEnough) {
    check(
      'Password changed back to the original value returns 200',
      revert.ok && revert.via === 'the change-password API',
      revert.ok
        ? `restored via ${revert.via}`
        : revert.skipped
          ? 'skipped: the password was never changed'
          : revert.detail
    );
  } else {
    check(
      `The endpoint refuses to set the original ${state.originalPassword.length} character password back (400 WEAK_PASSWORD, as documented)`,
      state.passwordRestoreRejection === true,
      state.passwordRestoreRejection === true
        ? 'the endpoint enforces a minimum length of 8'
        : state.passwordRestoreRejectionDetail === 'status=429 code=RATE_LIMITED'
          ? 'inconclusive: the endpoint rate limited this run (429). Wait 15 minutes and rerun.'
          : `unexpected response: ${state.passwordRestoreRejectionDetail ?? 'unknown'}`
    );

    check(
      `Original password restored via ${revert.via ?? 'the admin API'} (account left usable)`,
      revert.ok,
      revert.skipped ? 'skipped: the password was never changed' : revert.detail ?? `restored via ${revert.via}`
    );
  }

  const originalLogin = await login(state.email, state.originalPassword);
  check(
    'Login with the original password works again (account left usable)',
    originalLogin.ok,
    originalLogin.error
  );

  if (originalLogin.ok) {
    state.token = originalLogin.token;
  }
}

// ---------------------------------------------------------------- route audit

function resolveRegistration(indexSource, file) {
  const stem = path.basename(file, '.js');
  const requireRe = new RegExp(`require\\(\\s*['"]\\.\\/src\\/routes\\/${stem}['"]\\s*\\)`);

  if (!requireRe.test(indexSource)) {
    return { mount: null, how: 'not required in index.js' };
  }

  const varMatch = indexSource.match(
    new RegExp(`const\\s+([A-Za-z0-9_$]+)\\s*=\\s*require\\(\\s*['"]\\.\\/src\\/routes\\/${stem}['"]\\s*\\)`)
  );

  if (varMatch) {
    const varName = varMatch[1];
    const useMatch = indexSource.match(
      new RegExp(`app\\.use\\(\\s*['"]([^'"]+)['"]\\s*,\\s*${varName}\\s*\\)`)
    );
    if (useMatch) {
      return { mount: useMatch[1], how: `app.use('${useMatch[1]}', ${varName})` };
    }
    return { mount: null, how: `required as ${varName} but never mounted with app.use` };
  }

  const inlineMatch = indexSource.match(
    new RegExp(`app\\.use\\(\\s*['"]([^'"]+)['"]\\s*,\\s*require\\(\\s*['"]\\.\\/src\\/routes\\/${stem}['"]\\s*\\)\\s*\\)`)
  );
  if (inlineMatch) {
    return { mount: inlineMatch[1], how: `app.use('${inlineMatch[1]}', require('./src/routes/${stem}'))` };
  }

  return { mount: null, how: 'required in index.js but no app.use mount found' };
}

function printAuditTable(rows) {
  const headers = ['file', 'requireAuth', 'registered', 'mount'];
  const body = rows.map((row) => [
    row.file,
    row.applies ? 'yes' : 'NO',
    row.registered ? 'yes' : 'NO',
    row.mount ?? '-',
  ]);
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...body.map((cells) => cells[index].length))
  );
  const format = (cells) => cells.map((cell, index) => cell.padEnd(widths[index])).join('  ').trimEnd();

  console.log(format(headers));
  console.log(widths.map((width) => '-'.repeat(width)).join('  '));
  for (const cells of body) {
    console.log(format(cells));
  }
}

function auditRoutes() {
  section('Route audit');

  const indexSource = fs.readFileSync(INDEX_FILE, 'utf8');
  const routeFiles = fs
    .readdirSync(ROUTES_DIR)
    .filter((file) => file.endsWith('.js'))
    .sort();

  const rows = routeFiles.map((file) => {
    const source = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');

    const imports = /require\(\s*['"][^'"]*middleware\/requireAuth['"]\s*\)/.test(source);
    const routerUse = /router\.use\(\s*requireAuth\s*\)/.test(source);
    const perRoute = /router\.(get|post|patch|put|delete)\(\s*['"][^'"]*['"]\s*,\s*requireAuth\b/.test(source);
    const applies = imports && (routerUse || perRoute);
    const registration = resolveRegistration(indexSource, file);

    return {
      file,
      imports,
      routerUse,
      perRoute,
      applies,
      how: routerUse ? 'router.use(requireAuth)' : perRoute ? 'per-route requireAuth' : null,
      mount: registration.mount,
      howRegistered: registration.how,
      registered: Boolean(registration.mount),
    };
  });

  printAuditTable(rows);

  const missingAuth = rows.filter((row) => !row.applies);
  const unregistered = rows.filter((row) => !row.registered);

  console.log(`\nScanned ${rows.length} route file(s) in src/routes/.`);
  if (missingAuth.length > 0) {
    console.log(`FLAGGED (no requireAuth): ${missingAuth.map((row) => `src/routes/${row.file}`).join(', ')}`);
  }
  if (unregistered.length > 0) {
    console.log(`FLAGGED (not registered in index.js): ${unregistered.map((row) => `src/routes/${row.file}`).join(', ')}`);
  }

  for (const row of rows) {
    check(
      `src/routes/${row.file} applies requireAuth`,
      row.applies,
      row.applies ? row.how : 'no requireAuth import/usage found'
    );
  }

  for (const row of rows) {
    check(
      `src/routes/${row.file} is registered in index.js`,
      row.registered,
      row.howRegistered
    );
  }

  check(
    'Every file in src/routes/ applies requireAuth',
    missingAuth.length === 0,
    missingAuth.length === 0 ? `${rows.length} file(s) checked` : `missing on ${missingAuth.map((row) => row.file).join(', ')}`
  );

  check(
    'Every router in src/routes/ is registered in index.js',
    unregistered.length === 0,
    unregistered.length === 0 ? `${rows.length} file(s) checked` : `missing on ${unregistered.map((row) => row.file).join(', ')}`
  );
}

// ---------------------------------------------------------------- preflight

function preflight() {
  console.log('--- Profile + change-password verification ---');
  console.log(`Backend: ${BASE_URL}`);

  const missing = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'TEST_USER_EMAIL',
    'TEST_USER_PASSWORD',
  ].filter((name) => !process.env[name]);

  if (missing.length > 0) {
    console.error(`\nMissing required env vars in backend/.env: ${missing.join(', ')}`);
    process.exit(2);
  }

  const candidates = anonKeyCandidates();
  if (candidates.length === 0) {
    console.error(
      '\nNo Supabase anon key found. Set SUPABASE_ANON_KEY in backend/.env (or make sure frontend/.env has VITE_SUPABASE_ANON_KEY).'
    );
    process.exit(2);
  }

  console.log(`Test user: ${process.env.TEST_USER_EMAIL}`);
  console.log(`Supabase anon key candidates: ${candidates.map((candidate) => candidate.source).join(', ')}`);
  console.log('Credentials come from backend/.env; passwords and tokens are never printed.');
  console.log('This run spends up to 5 of the account router\'s 10 failed password-change attempts per 15 minutes.');
}

async function assertBackendIsUp() {
  try {
    const res = await api('GET', '/health', { timeoutMs: 5_000 });
    if (!res.ok) throw new Error(`GET /health returned ${res.status}`);
  } catch (error) {
    console.error(`\nBackend is not reachable at ${BASE_URL} (${error.message}).`);
    console.error('Start it first:  cd backend && npm start');
    process.exit(2);
  }
  console.log('Backend health check: ok');
}

// ---------------------------------------------------------------- summary

function printSummary() {
  const failed = results.filter((result) => !result.ok);

  console.log('\n--- FINAL SUMMARY ---');
  console.log(`Checks run: ${results.length}`);
  console.log(`Passed:     ${results.length - failed.length}`);
  console.log(`Failed:     ${failed.length}`);

  if (failed.length > 0) {
    console.log('');
    for (const result of failed) {
      console.log(`  FAIL: ${result.name}${result.detail ? ` — ${redact(result.detail)}` : ''}`);
    }
    console.log('\nRESULT: FAIL');
    process.exitCode = 1;
    return;
  }

  console.log('\nRESULT: PASS — every check passed.');
  process.exitCode = 0;
}

// ---------------------------------------------------------------- main

async function main() {
  preflight();
  await assertBackendIsUp();

  section('Sign in');
  const auth = await resolveAuthKey(state.email, state.originalPassword);

  for (const attempt of auth.attempts) {
    console.log(`  anon key rejected by Supabase Auth: ${attempt.source} — ${redact(attempt.error)}`);
  }

  if (!auth.ok) {
    if (auth.keyAccepted) {
      check(
        'Login with TEST_USER_EMAIL / TEST_USER_PASSWORD succeeds',
        false,
        `Supabase rejected the credentials (${auth.result.error}) — check TEST_USER_EMAIL / TEST_USER_PASSWORD in backend/.env`
      );
    } else {
      check(
        'Login with TEST_USER_EMAIL / TEST_USER_PASSWORD succeeds',
        false,
        `no usable Supabase anon key was found (tried: ${auth.attempts.map((attempt) => attempt.source).join(', ') || 'none'})`
      );
    }
    return;
  }

  if (auth.attempts.length > 0) {
    console.log(`\nWARN: backend/.env SUPABASE_ANON_KEY was rejected by Supabase Auth ("${auth.attempts[0].error}").`);
    console.log(`WARN: this script signed in with ${auth.candidate.source} instead.`);
    console.log('WARN: the backend reads SUPABASE_ANON_KEY in src/lib/supabaseVerifier.js, so the');
    console.log('WARN: change-password happy path will answer 502 until backend/.env is fixed.');
  }

  state.token = auth.result.token;
  state.userId = auth.result.userId;

  check(
    `Login with TEST_USER_EMAIL / TEST_USER_PASSWORD succeeds (anon key from ${auth.candidate.source})`,
    true
  );

  const stored = await readStoredFullName();
  if (stored.error) {
    check('Read the original fullName from the DB', false, stored.error);
    return;
  }

  state.originalFullName = stored.value;
  check(
    `Read the original fullName from the DB (${describeFullName(state.originalFullName)})`,
    true
  );

  await runProfileChecks();
  await runPasswordChecks();
  auditRoutes();
}

(async () => {
  try {
    await main();
  } catch (error) {
    console.error('\nScript encountered an unexpected error:', redact(error?.stack ?? error?.message ?? error));
    process.exitCode = 1;
  } finally {
    // Safety net: always leave the test account as we found it, even if a check
    // above blew up halfway through.
    try {
      if (!state.fullNameRestored) {
        const restore = await restoreOriginalFullName();
        if (!restore.skipped) {
          check('Cleanup: original fullName restored', restore.ok, restore.detail);
        }
      }
    } catch (error) {
      console.error('Cleanup failed while restoring fullName:', redact(error?.message ?? error));
      process.exitCode = 1;
    }

    try {
      const restore = await restoreOriginalPassword();
      if (!restore.skipped) {
        check('Cleanup: original password restored', restore.ok, restore.detail);
      }
    } catch (error) {
      console.error('Cleanup failed while restoring the password:', redact(error?.message ?? error));
      process.exitCode = 1;
    }

    printSummary();
  }
})();
