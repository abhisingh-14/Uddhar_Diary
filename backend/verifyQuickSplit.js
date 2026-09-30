/**
 * Quick split (manual bill) end-to-end verification against the live backend.
 *
 * Verifies the new manual bill entry path (source: 'manual') works correctly
 * and doesn't regress the existing photo flow.
 *
 * Usage:
 *   node verifyQuickSplit.js        (backend must already be running: npm start)
 *
 * Environment variables (from backend/.env):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PORT
 *   SUPABASE_ANON_KEY  (falls back to frontend/.env VITE_SUPABASE_ANON_KEY)
 *   TEST_USER_EMAIL, TEST_USER_PASSWORD
 */

require('dotenv/config');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const BACKEND_DIR = __dirname;
const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;

// ---------------------------------------------------------------- reporting

const results = [];

function section(title) {
  console.log(`\n--- ${title} ---`);
}

function check(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail });
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${suffix}`);
  return Boolean(ok);
}

function note(message) {
  console.log(`NOTE: ${message}`);
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
  createdBillIds: [],
  createdPersonIds: [],
  otherCategoryId: null,
};

const stamp = Date.now().toString(36);

function trackBill(billId) {
  if (billId && typeof billId === 'string') {
    state.createdBillIds.push(billId);
  }
  return billId;
}

function trackPerson(person) {
  if (person && typeof person.id === 'string') {
    state.createdPersonIds.push(person.id);
  }
  return person;
}

// ---------------------------------------------------------------- cleanup

async function deleteCreatedData() {
  const errors = [];

  // Delete bills (this cascades to debts and bill_items)
  if (state.createdBillIds.length > 0) {
    const { error } = await supabaseAdmin
      .from('bills')
      .delete()
      .in('id', state.createdBillIds);

    if (error) {
      errors.push(`bills: ${error.message}`);
    }
  }

  // Delete people
  if (state.createdPersonIds.length > 0) {
    const { error } = await supabaseAdmin
      .from('people')
      .delete()
      .in('id', state.createdPersonIds);

    if (error) {
      errors.push(`people: ${error.message}`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, detail: errors.join('; ') };
  }

  return { ok: true, detail: `deleted ${state.createdBillIds.length} bill(s) and ${state.createdPersonIds.length} person(s)` };
}

// ---------------------------------------------------------------- setup

async function setupTestData() {
  section('Setup');

  // Get "Other" category
  const { data: categories, error: catError } = await supabaseAdmin
    .from('categories')
    .select('id, name')
    .ilike('name', 'other')
    .limit(1);

  if (catError || !categories || categories.length === 0) {
    check('Found "Other" category', false, catError?.message ?? 'not found');
    return false;
  }

  state.otherCategoryId = categories[0].id;
  check('Found "Other" category', true, `id=${categories[0].id}`);

  // Create 2 test people
  const person1 = await api('POST', '/api/people', {
    token: state.token,
    body: { name: `Quick Person 1 ${stamp}` },
  });
  trackPerson(person1.json);

  const person2 = await api('POST', '/api/people', {
    token: state.token,
    body: { name: `Quick Person 2 ${stamp}` },
  });
  trackPerson(person2.json);

  const bothCreated = person1.status === 201 && person2.status === 201;
  check('Created 2 test people', bothCreated, `p1=${person1.status} p2=${person2.status}`);

  return bothCreated;
}

// ---------------------------------------------------------------- validation checks

async function runValidationChecks() {
  section('API validation (rejections)');

  // Zero amount
  const zeroAmount = await api('POST', '/api/bills', {
    token: state.token,
    body: {
      source: 'manual',
      total: 0,
      paidBy: 'you',
      participantIds: [state.createdPersonIds[0]],
    },
  });
  check('Zero amount is rejected', zeroAmount.status === 400, `status=${zeroAmount.status}`);

  // 3 decimal places
  const threeDecimals = await api('POST', '/api/bills', {
    token: state.token,
    body: {
      source: 'manual',
      total: 100.123,
      paidBy: 'you',
      participantIds: [state.createdPersonIds[0]],
    },
  });
  check('3 decimal places is rejected', threeDecimals.status === 400, `status=${threeDecimals.status}`);

  // Manual with items
  const manualWithItems = await api('POST', '/api/bills', {
    token: state.token,
    body: {
      source: 'manual',
      total: 100,
      items: [{ name: 'Test', price: 100, quantity: 1 }],
      paidBy: 'you',
      participantIds: [state.createdPersonIds[0]],
    },
  });
  check('Manual with items is rejected', manualWithItems.status === 400, `status=${manualWithItems.status}`);

  // Photo without items
  const photoWithoutItems = await api('POST', '/api/bills', {
    token: state.token,
    body: {
      source: 'photo',
      storagePath: 'test/path.jpg',
      merchantName: 'Test',
      total: 100,
      items: [],
      paidBy: 'you',
      participantIds: [state.createdPersonIds[0]],
    },
  });
  check('Photo without items is rejected', photoWithoutItems.status === 400, `status=${photoWithoutItems.status}`);

  // Unknown category
  const unknownCategory = await api('POST', '/api/bills', {
    token: state.token,
    body: {
      source: 'manual',
      total: 100,
      categoryId: crypto.randomUUID(),
      paidBy: 'you',
      participantIds: [state.createdPersonIds[0]],
    },
  });
  check('Unknown category is rejected', unknownCategory.status === 400, `status=${unknownCategory.status}`);
}

// ---------------------------------------------------------------- manual bill checks

async function runManualBillChecks() {
  section('Manual bill: you paid, split 3 ways');

  const today = new Date().toISOString().split('T')[0];
  const total = 300;

  const createResult = await api('POST', '/api/bills', {
    token: state.token,
    body: {
      source: 'manual',
      total,
      categoryId: state.otherCategoryId,
      merchantName: `Quick Test ${stamp}`,
      billDate: today,
      paidBy: 'you',
      participantIds: state.createdPersonIds,
    },
  });

  if (createResult.status !== 201) {
    check('Manual bill created', false, `status=${createResult.status} body=${createResult.text?.slice(0, 100)}`);
    return;
  }

  trackBill(createResult.json.id);
  check('Manual bill created', true, `id=${createResult.json.id}`);

  // Verify DB state
  const { data: bill, error: billError } = await supabaseAdmin
    .from('bills')
    .select('*')
    .eq('id', createResult.json.id)
    .single();

  if (billError) {
    check('Bill row exists in DB', false, billError.message);
    return;
  }

  check('Bill row exists in DB', true);
  check('bills.source = manual', bill.source === 'manual', `source=${bill.source}`);
  check('bills.image_url IS NULL', bill.image_url === null, `image_url=${bill.image_url}`);
  check('bills.category_id = Other category', bill.category_id === state.otherCategoryId, `category_id=${bill.category_id}`);
  check('bills.bill_date = today', bill.bill_date === today, `bill_date=${bill.bill_date}`);

  // Check user_share_paise
  const totalParticipants = state.createdPersonIds.length + 1; // +1 for you
  const expectedUserSharePaise = Math.round((total * 100) / totalParticipants);
  check('bills.user_share_paise correct', bill.user_share_paise === expectedUserSharePaise, 
    `expected=${expectedUserSharePaise} actual=${bill.user_share_paise}`);

  // Check debts
  const { data: debts, error: debtsError } = await supabaseAdmin
    .from('debts')
    .select('*')
    .eq('bill_id', createResult.json.id);

  if (debtsError) {
    check('Debts rows exist', false, debtsError.message);
    return;
  }

  check('Exactly 2 debts rows (for 2 participants)', debts.length === 2, `count=${debts.length}`);

  const allTheyOweYou = debts.every(d => d.direction === 'they_owe_you');
  check('All debts have direction = they_owe_you', allTheyOweYou);

  const allCorrectAmount = debts.every(d => d.amount_paise === 10000); // 100 * 100
  check('All debts have correct amount (₹100)', allCorrectAmount);

  // Check bill_items is empty
  const { data: billItems, error: itemsError } = await supabaseAdmin
    .from('bill_items')
    .select('*')
    .eq('bill_id', createResult.json.id);

  if (itemsError) {
    check('bill_items query succeeded', false, itemsError.message);
  } else {
    check('bill_items has zero rows', billItems.length === 0, `count=${billItems.length}`);
  }
}

// ---------------------------------------------------------------- person paid check

async function runPersonPaidCheck() {
  section('Manual bill: person paid, you owe them');

  const total = 150;

  const createResult = await api('POST', '/api/bills', {
    token: state.token,
    body: {
      source: 'manual',
      total,
      categoryId: state.otherCategoryId,
      merchantName: `Person Paid ${stamp}`,
      paidBy: state.createdPersonIds[0],
      participantIds: state.createdPersonIds, // both people, payer included
    },
  });

  if (createResult.status !== 201) {
    check('Person-paid bill created', false, `status=${createResult.status}`);
    return;
  }

  trackBill(createResult.json.id);
  check('Person-paid bill created', true, `id=${createResult.json.id}`);

  // Verify debts: only 1 debt (you owe the payer)
  const { data: debts, error: debtsError } = await supabaseAdmin
    .from('debts')
    .select('*')
    .eq('bill_id', createResult.json.id);

  if (debtsError) {
    check('Debts query succeeded', false, debtsError.message);
    return;
  }

  check('Exactly 1 debt row (you owe payer)', debts.length === 1, `count=${debts.length}`);
  check('Debt direction = you_owe_them', debts[0]?.direction === 'you_owe_them', `direction=${debts[0]?.direction}`);
  
  // Total 150, split 3 ways = 50 each, person1 paid so you owe person1 50
  const expectedAmount = 5000; // 150 / 3 = 50 each
  check('Debt amount correct (₹50)', debts[0]?.amount_paise === expectedAmount, 
    `expected=${expectedAmount} actual=${debts[0]?.amount_paise}`);
}

// ---------------------------------------------------------------- category correctness check

async function runCategoryCheck() {
  section('Category correctness: expenses by category');

  const beforeRes = await api('GET', `/api/expenses/by-category?userId=${state.userId}&granularity=month`, { token: state.token });
  const beforeData = beforeRes.json || [];
  const beforeOther = beforeData.find(c => c.categoryId === state.otherCategoryId)?.totalPaise || 0;

  // Create a manual bill in "Other" category
  const total = 200;
  const createResult = await api('POST', '/api/bills', {
    token: state.token,
    body: {
      source: 'manual',
      total,
      categoryId: state.otherCategoryId,
      paidBy: 'you',
      participantIds: [state.createdPersonIds[0]],
    },
  });

  if (createResult.status !== 201) {
    check('Category test bill created', false, `status=${createResult.status}`);
    return;
  }

  trackBill(createResult.json.id);

  // Check expenses API
  const afterRes = await api('GET', `/api/expenses/by-category?userId=${state.userId}&granularity=month`, { token: state.token });
  const afterData = afterRes.json || [];
  const afterOther = afterData.find(c => c.categoryId === state.otherCategoryId)?.totalPaise || 0;

  const totalParticipants = 1 /* the one person */ + 1 /* you */;
  const expectedIncrease = Math.round((total * 100) / totalParticipants); // 10000
  const actualIncrease = afterOther - beforeOther;
  check('Manual bill shows in expenses under "Other"', actualIncrease === expectedIncrease,
    `expectedIncrease=${expectedIncrease} actualIncrease=${actualIncrease}`);
}

// ---------------------------------------------------------------- diary correctness check

async function runDiaryCheck() {
  section('Diary correctness: balances');

  const beforeRes = await api('GET', '/api/debts/balances', { token: state.token });
  const beforeData = beforeRes.json?.balances || [];
  const beforePersonEntry = beforeData.find(b => b.personId === state.createdPersonIds[0]);
  const beforeNet = beforePersonEntry?.netBalancePaise || 0;

  // Create a manual bill that creates a debt
  const total = 100;
  const createResult = await api('POST', '/api/bills', {
    token: state.token,
    body: {
      source: 'manual',
      total,
      categoryId: state.otherCategoryId,
      paidBy: 'you',
      participantIds: [state.createdPersonIds[0]],
    },
  });

  if (createResult.status !== 201) {
    check('Diary test bill created', false, `status=${createResult.status}`);
    return;
  }

  trackBill(createResult.json.id);

  // Check balances API
  const afterRes = await api('GET', '/api/debts/balances', { token: state.token });
  const afterData = afterRes.json?.balances || [];

  const personEntry = afterData.find(b => b.personId === state.createdPersonIds[0]);
  check('Person appears in balances', !!personEntry);
  
  if (personEntry) {
    // Split 2 ways: ₹50 each, you paid so they owe you ₹50
    const expectedIncrease = 5000; // 50 * 100
    const afterNet = personEntry.netBalancePaise || 0;
    const actualIncrease = afterNet - beforeNet;
    check('Balance has correct direction and amount', actualIncrease === expectedIncrease,
      `expectedIncrease=${expectedIncrease} actualIncrease=${actualIncrease}`);
  }
}

// ---------------------------------------------------------------- photo regression check

async function runPhotoRegressionCheck() {
  section('Photo flow regression: items and source');

  // First upload an image
  const { data: uploadData, error: uploadError } = await supabaseAdmin
    .storage
    .from('bill-images')
    .upload(`test/${stamp}-regression.jpg`, Buffer.from('fake image'), {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadError) {
    check('Test image uploaded to storage', false, uploadError.message);
    return;
  }

  const storagePath = uploadData.path;
  check('Test image uploaded to storage', true, `path=${storagePath}`);

  // Create a photo-sourced bill
  const total = 250;
  const createResult = await api('POST', '/api/bills', {
    token: state.token,
    body: {
      source: 'photo',
      storagePath,
      merchantName: `Photo Regression ${stamp}`,
      total,
      categoryId: state.otherCategoryId,
      items: [
        { name: 'Item 1', price: 100, quantity: 1 },
        { name: 'Item 2', price: 150, quantity: 1 },
      ],
      paidBy: 'you',
      participantIds: [state.createdPersonIds[0]],
    },
  });

  if (createResult.status !== 201) {
    check('Photo bill created', false, `status=${createResult.status}`);
    return;
  }

  trackBill(createResult.json.id);
  check('Photo bill created', true, `id=${createResult.json.id}`);

  // Verify DB state
  const { data: bill, error: billError } = await supabaseAdmin
    .from('bills')
    .select('*')
    .eq('id', createResult.json.id)
    .single();

  if (billError) {
    check('Photo bill row exists', false, billError.message);
    return;
  }

  check('Photo bill source = photo', bill.source === 'photo', `source=${bill.source}`);
  check('Photo bill has image_url', !!bill.image_url, `image_url=${bill.image_url}`);

  // Check bill_items
  const { data: billItems, error: itemsError } = await supabaseAdmin
    .from('bill_items')
    .select('*')
    .eq('bill_id', createResult.json.id);

  if (itemsError) {
    check('bill_items query succeeded', false, itemsError.message);
  } else {
    check('Photo bill has bill_items rows', billItems.length === 2, `count=${billItems.length}`);
  }

  // Cleanup storage
  await supabaseAdmin.storage.from('bill-images').remove([storagePath]);
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
      console.log(`  - ${result.name}${result.detail ? ` (${result.detail})` : ''}`);
    }
  }

  console.log(`\nRESULT: ${failed === 0 ? 'PASS — every check passed.' : 'FAIL — see the failures above.'}`);
}

// ---------------------------------------------------------------- main

async function main() {
  console.log('--- Quick split (manual bill) verification ---');
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

  const setupOk = await setupTestData();
  if (!setupOk) {
    console.error('Setup failed, aborting remaining checks.');
    return;
  }

  await runValidationChecks();
  await runManualBillChecks();
  await runPersonPaidCheck();
  await runCategoryCheck();
  await runDiaryCheck();
  await runPhotoRegressionCheck();
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
    try {
      const cleanup = await deleteCreatedData();
      if (!cleanup.ok) {
        check('Cleanup: created data deleted', false, cleanup.detail);
      } else {
        check('Cleanup: created data deleted', true, cleanup.detail);
      }
    } catch (error) {
      console.error('Cleanup failed:', redact(error?.message ?? error));
      process.exitCode = 1;
    }

    printSummary();

    if (results.some((result) => !result.ok)) {
      process.exitCode = 1;
    }
  }
})();
