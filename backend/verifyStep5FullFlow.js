/**
 * Step 5 / Part A — full end-to-end flow verification.
 *
 * One continuous scripted run of the whole app against the live local backend
 * (http://localhost:$PORT) + Supabase, instead of the earlier per-route scripts
 * that each verified a single endpoint in isolation:
 *
 *   1. Authenticate as a real user (Supabase Auth email/password -> Bearer token)
 *   2. Upload a real bill photo and extract it with Gemini
 *   3. Split the bill between a newly created person and one/two existing people
 *   4. Save the bill
 *   5. Confirm it landed: debts (direction + paise), balances, expense rollups
 *   6. Settle one debt partially, then fully
 *   7. Reminder flow (attach an email to the tracked person, trigger the reminder)
 *
 * Usage:
 *   node verifyStep5FullFlow.js ./test-bill.jpg
 *
 * Required env (backend/.env):
 *   SUPABASE_URL, PORT
 *   anon key: SUPABASE_ANON_KEY, or the frontend's VITE_SUPABASE_ANON_KEY
 *   TEST_USER_EMAIL, TEST_USER_PASSWORD
 *   TEST_REMINDER_EMAIL (falls back to TEST_EMAIL_RECIPIENT)
 *
 * Extraction note: step 2 never asserts exact OCR values (Gemini output varies).
 * It only fails when extractionFailed is true or no items come back — and in that
 * case the flow still continues with a hardcoded known-good items array so the
 * remaining steps get exercised, while the run is still reported as failed.
 *
 * Exit code is non-zero if any step fails, so a clean run is obvious at a glance.
 */

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const BACKEND_DIR = import.meta.dirname;
dotenv.config({ path: path.join(BACKEND_DIR, '.env') });

const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const MIME_BY_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
};

// Used only when Gemini extraction fails or returns something that cannot be
// saved as-is. Total is deliberately not divisible by 3 so the paise remainder
// handling gets exercised on a 3-way split.
const FALLBACK_BILL = {
  merchantName: 'Fallback Cafe (hardcoded test data)',
  items: [
    { name: 'Masala Dosa', price: 180.5, quantity: 1 },
    { name: 'Filter Coffee', price: 45, quantity: 2 },
  ],
};

const stepResults = [];
let fatalError = null;
const context = {
  token: null,
  userId: null,
  extraction: null,
  people: null,
  split: null,
  bill: null,
  snapshots: null,
  settle: null,
  reminder: null,
};

// ---------------------------------------------------------------- utilities

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function formatPaise(paise) {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  return `${sign}₹${(abs / 100).toFixed(2)} (${abs} paise)`;
}

function todayIsoDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function monthBucketStart(isoDate) {
  const [year, month] = isoDate.split('-');
  return `${year}-${month}-01`;
}

function isSameMonth(isoDate, referenceIsoDate) {
  return isoDate.slice(0, 7) === referenceIsoDate.slice(0, 7);
}

async function api(method, endpoint, { token, body, formData, timeoutMs } = {}) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let payload;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
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

// Mirror of src/services/splitCalculator.js so the expected split is computed
// independently of the backend. Any leftover paise (totalPaise % sharers) is
// absorbed by the bill owner, who is not part of the `people` array.
function expectedSplit(totalRupees, personIds, amountsPaid = {}) {
  const totalPeopleSharing = personIds.length + 1;
  const totalPaise = Math.round(totalRupees * 100);
  const baseSharePaise = Math.floor(totalPaise / totalPeopleSharing);
  const remainderPaise = totalPaise % totalPeopleSharing;

  const entries = [];
  for (const personId of personIds) {
    const paidPaise = Math.round((amountsPaid[personId] ?? 0) * 100);
    const owedPaise = baseSharePaise - paidPaise;
    if (owedPaise === 0) continue;
    entries.push({
      personId,
      amountPaise: Math.abs(owedPaise),
      direction: owedPaise > 0 ? 'they_owe_you' : 'you_owe_them',
    });
  }

  return {
    totalPaise,
    baseSharePaise,
    remainderPaise,
    ownerSharePaise: totalPaise - baseSharePaise * personIds.length,
    entries,
  };
}

function signedBalanceDelta(entry) {
  return entry.direction === 'they_owe_you' ? entry.amountPaise : -entry.amountPaise;
}

// ---------------------------------------------------------------- API reads

async function fetchPeople(token) {
  const res = await api('GET', '/api/people', { token });
  assert(res.ok, `GET /api/people failed with ${res.status}: ${res.text}`);
  return res.json ?? [];
}

async function fetchCategories(token) {
  const res = await api('GET', '/api/categories', { token });
  assert(res.ok, `GET /api/categories failed with ${res.status}: ${res.text}`);
  return res.json ?? [];
}

async function fetchPersonDebts(token, personId) {
  const res = await api('GET', `/api/debts/person/${personId}`, { token });
  assert(
    res.ok,
    `GET /api/debts/person/${personId} failed with ${res.status}: ${res.text}`
  );
  return res.json?.debts ?? [];
}

async function fetchBalances(token) {
  const res = await api('GET', '/api/debts/balances', { token });
  assert(res.ok, `GET /api/debts/balances failed with ${res.status}: ${res.text}`);

  const byPerson = new Map();
  for (const row of res.json?.balances ?? []) {
    byPerson.set(row.personId, row);
  }
  return byPerson;
}

async function fetchByCategory(token) {
  const res = await api('GET', '/api/expenses/by-category?granularity=month', { token });
  assert(res.ok, `GET /api/expenses/by-category failed with ${res.status}: ${res.text}`);
  return res.json ?? [];
}

async function fetchOverTime(token) {
  const res = await api('GET', '/api/expenses/over-time?granularity=month', { token });
  assert(res.ok, `GET /api/expenses/over-time failed with ${res.status}: ${res.text}`);
  return res.json ?? [];
}

function categoryTotalPaise(rows, categoryId) {
  const row = rows.find((entry) => entry.categoryId === categoryId);
  return row ? Number(row.totalPaise) : 0;
}

function periodTotalPaise(rows, periodStart) {
  const row = rows.find((entry) => entry.periodStart === periodStart);
  return row ? Number(row.totalPaise) : 0;
}

// ---------------------------------------------------------------- step runner

async function runStep(number, title, fn) {
  console.log(`\n--- Step ${number}: ${title} ---`);
  try {
    const value = await fn();
    stepResults.push({ number, title, ok: true });
    console.log(`✓ Step ${number}: ${title}`);
    return { ok: true, value };
  } catch (error) {
    stepResults.push({ number, title, ok: false, error: error.message });
    console.error(`✗ Step ${number} failed: ${error.message}`);
    return { ok: false, value: null };
  }
}

// ---------------------------------------------------------------- preflight

function readAnonKey() {
  if (process.env.SUPABASE_ANON_KEY) {
    return { key: process.env.SUPABASE_ANON_KEY, source: 'SUPABASE_ANON_KEY' };
  }
  if (process.env.VITE_SUPABASE_ANON_KEY) {
    return {
      key: process.env.VITE_SUPABASE_ANON_KEY,
      source: 'VITE_SUPABASE_ANON_KEY',
    };
  }

  const frontendEnvPath = path.join(BACKEND_DIR, '..', 'frontend', '.env');
  if (fs.existsSync(frontendEnvPath)) {
    const match = fs
      .readFileSync(frontendEnvPath, 'utf8')
      .match(/^\s*VITE_SUPABASE_ANON_KEY\s*=\s*(.+)$/m);
    if (match) {
      return {
        key: match[1].trim(),
        source: 'frontend/.env (VITE_SUPABASE_ANON_KEY)',
      };
    }
  }

  throw new Error(
    'No Supabase anon key found. Set SUPABASE_ANON_KEY in backend/.env (or make sure frontend/.env has VITE_SUPABASE_ANON_KEY).'
  );
}

function resolveBillImage(imagePath) {
  const absolutePath = path.resolve(imagePath);
  assert(fs.existsSync(absolutePath), `Bill image not found: ${absolutePath}`);
  assert(
    fs.statSync(absolutePath).isFile(),
    `Bill image path is not a file: ${absolutePath}`
  );

  const sizeBytes = fs.statSync(absolutePath).size;
  assert(sizeBytes > 0, `Bill image is empty: ${absolutePath}`);
  assert(
    sizeBytes <= MAX_UPLOAD_BYTES,
    `Bill image is ${(sizeBytes / 1024 / 1024).toFixed(1)}MB; the API limit is 10MB`
  );

  const extension = path.extname(absolutePath).toLowerCase();
  const mimeType = MIME_BY_EXTENSION[extension];
  assert(
    mimeType,
    `Unsupported image extension "${extension}". Supported: ${Object.keys(MIME_BY_EXTENSION).join(', ')}`
  );

  return { absolutePath, filename: path.basename(absolutePath), mimeType, sizeBytes };
}

function preflight() {
  console.log('--- Step 5 / Part A: full end-to-end flow ---');
  console.log(`Backend:  ${BASE_URL}`);

  const imageArgument = process.argv[2];
  if (!imageArgument) {
    console.error('\nUsage: node verifyStep5FullFlow.js <path-to-bill-image>');
    console.error('Example: node verifyStep5FullFlow.js ./test-bill.jpg');
    process.exit(2);
  }

  const missing = ['SUPABASE_URL', 'TEST_USER_EMAIL', 'TEST_USER_PASSWORD'].filter(
    (name) => !process.env[name]
  );
  if (missing.length > 0) {
    console.error(`\nMissing required env vars in backend/.env: ${missing.join(', ')}`);
    process.exit(2);
  }

  const image = resolveBillImage(imageArgument);
  const reminderEmail = process.env.TEST_REMINDER_EMAIL || process.env.TEST_EMAIL_RECIPIENT;

  console.log(`Bill image: ${image.absolutePath} (${(image.sizeBytes / 1024).toFixed(0)}KB, ${image.mimeType})`);
  console.log(`Test user:  ${process.env.TEST_USER_EMAIL}`);
  console.log(`Reminder to: ${reminderEmail ?? '(not configured)'}`);

  return { image, reminderEmail };
}

async function assertBackendIsUp() {
  try {
    const res = await api('GET', '/health', { timeoutMs: 5_000 });
    assert(res.ok, `GET /health returned ${res.status}`);
  } catch (error) {
    console.error(`\nBackend is not reachable at ${BASE_URL} (${error.message}).`);
    console.error('Start it first:  cd backend && npm start');
    process.exit(2);
  }
  console.log('Backend health check: ok');
}

// ---------------------------------------------------------------- steps

async function step1Authenticate() {
  const { key: anonKey, source } = readAnonKey();
  console.log(`Supabase anon key from: ${source}`);

  const supabase = createClient(process.env.SUPABASE_URL, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: process.env.TEST_USER_EMAIL,
    password: process.env.TEST_USER_PASSWORD,
  });

  assert(!error, `Supabase sign-in failed: ${error?.message}`);
  assert(data?.session?.access_token, 'Sign-in returned no access token');

  context.token = data.session.access_token;
  context.userId = data.user?.id;
  console.log(`Signed in as ${data.user.email} (${context.userId})`);

  // Prove the token is accepted by the same middleware every route uses.
  const res = await api('GET', '/api/people', { token: context.token });
  assert(
    res.status === 200,
    `Authenticated GET /api/people returned ${res.status}: ${res.text}`
  );

  return { userId: context.userId };
}

async function step2UploadAndExtract(image) {
  const formData = new FormData();
  formData.append(
    'image',
    new Blob([fs.readFileSync(image.absolutePath)], { type: image.mimeType }),
    image.filename
  );

  const res = await api('POST', '/api/bills/extract', {
    token: context.token,
    formData,
    timeoutMs: 120_000,
  });
  assert(
    res.ok,
    `POST /api/bills/extract returned ${res.status}: ${res.text.slice(0, 300)}`
  );

  const { storagePath, extractionFailed, extracted } = res.json ?? {};
  context.extraction = { storagePath, extractionFailed: Boolean(extractionFailed), extracted };

  console.log(`storagePath: ${storagePath}`);
  console.log(`extractionFailed: ${Boolean(extractionFailed)}`);
  console.log(`merchantName: ${JSON.stringify(extracted?.merchantName)}`);
  console.log(`total:        ${extracted?.total}`);
  console.log(`category:     ${JSON.stringify(extracted?.category)}`);
  console.log(`billDate:     ${JSON.stringify(extracted?.billDate)}`);
  console.log('items (eyeball these — OCR output is not asserted exactly):');
  for (const item of extracted?.items ?? []) {
    console.log(`  - ${item.quantity ?? 1} x ${item.name} @ ${item.price}`);
  }

  const problems = [];
  if (extractionFailed) problems.push('extractionFailed was true');
  if (!Array.isArray(extracted?.items) || extracted.items.length === 0) {
    problems.push('extracted items array is empty');
  }

  if (problems.length > 0) {
    console.error(`Extraction is not usable: ${problems.join('; ')}`);
    console.error(
      'Continuing with the hardcoded fallback items so the rest of the flow still runs — this run is still reported as failed.'
    );
  }

  return { problems };
}

async function step3BuildSplit() {
  const existingPeople = await fetchPeople(context.token);
  console.log(`GET /api/people returned ${existingPeople.length} existing people`);

  const newPersonRes = await api('POST', '/api/people', {
    token: context.token,
    body: { name: `E2E Flow Person ${new Date().toISOString().slice(0, 19)}` },
  });
  assert(
    newPersonRes.status === 201,
    `POST /api/people returned ${newPersonRes.status}: ${newPersonRes.text}`
  );
  const newPerson = newPersonRes.json;
  console.log(`Created new person: ${newPerson.name} (${newPerson.id})`);

  const candidates = existingPeople.filter((person) => person.id !== newPerson.id);
  if (candidates.length === 0) {
    console.warn('No pre-existing person to pick from — creating a second person instead.');
    const fallbackRes = await api('POST', '/api/people', {
      token: context.token,
      body: { name: `E2E Flow Person B ${new Date().toISOString().slice(0, 19)}` },
    });
    assert(
      fallbackRes.status === 201,
      `POST /api/people (fallback) returned ${fallbackRes.status}: ${fallbackRes.text}`
    );
    candidates.push(fallbackRes.json);
  }

  // Prefer an existing person with no outstanding unpaid debt: once the debt
  // from this bill is fully settled they drop out of /api/debts/balances, which
  // makes the step 6 assertion unambiguous.
  let settleTarget = null;
  for (const candidate of candidates) {
    const debts = await fetchPersonDebts(context.token, candidate.id);
    const unpaid = debts.filter((debt) => debt.remainingPaise > 0);
    if (unpaid.length === 0) {
      settleTarget = candidate;
      break;
    }
  }

  const settleTargetHasCleanSlate = Boolean(settleTarget);
  if (!settleTarget) {
    settleTarget = candidates[0];
    console.warn(
      `${settleTarget.name} has other unpaid debts — step 6 will assert the balance delta instead of a full disappearance.`
    );
  }
  console.log(
    `Existing person for the split: ${settleTarget.name} (${settleTarget.id})${settleTargetHasCleanSlate ? ' [no unpaid debts]' : ''}`
  );

  const thirdPerson = candidates.find((person) => person.id !== settleTarget.id) ?? null;
  if (thirdPerson) {
    console.log(`Third person for the split:  ${thirdPerson.name} (${thirdPerson.id})`);
  } else {
    console.log('No third pre-existing person available — running a 2-way split.');
  }

  const participants = [newPerson, settleTarget, ...(thirdPerson ? [thirdPerson] : [])];
  const personIds = participants.map((person) => person.id);
  const amountsPaid = Object.fromEntries(personIds.map((personId) => [personId, 0]));

  context.people = {
    newPerson,
    settleTarget,
    thirdPerson,
    settleTargetHasCleanSlate,
    participants,
    personIds,
    amountsPaid,
    reminderPerson: newPerson,
  };

  console.log(`Split participants (${participants.length}): ${participants.map((p) => p.name).join(', ')}`);
  return context.people;
}

function pickBillData() {
  const { extraction } = context;
  const extractedItems = (extraction?.extracted?.items ?? []).map((item) => ({
    name: typeof item?.name === 'string' ? item.name.trim() : '',
    price: Number(item?.price),
    quantity: Number.isInteger(item?.quantity) && item.quantity >= 1 ? item.quantity : 1,
  }));
  const extractedTotal = Number(extraction?.extracted?.total);
  const itemsSum = extractedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const itemsAreValid =
    extractedItems.length > 0 &&
    extractedItems.every(
      (item) => item.name !== '' && Number.isFinite(item.price) && item.price >= 0
    );
  const totalIsValid = Number.isFinite(extractedTotal) && extractedTotal > 0;
  const totalsMatch = totalIsValid && Math.abs(itemsSum - extractedTotal) <= 0.01;

  if (itemsAreValid && totalsMatch) {
    console.log('Bill data source: raw Gemini extraction, passed through unchanged.');
    return {
      source: 'gemini',
      merchantName:
        typeof extraction.extracted.merchantName === 'string' &&
        extraction.extracted.merchantName.trim() !== ''
          ? extraction.extracted.merchantName.trim()
          : 'Unknown merchant (from extraction)',
      items: extractedItems,
      total: extractedTotal,
      categoryName: extraction.extracted.category,
    };
  }

  const reasons = [];
  if (!itemsAreValid) reasons.push('extracted items were missing/invalid');
  if (!totalIsValid) reasons.push(`extracted total was invalid (${extraction?.extracted?.total})`);
  else if (!totalsMatch) {
    reasons.push(
      `items sum to ${itemsSum.toFixed(2)} but the bill total is ${extractedTotal.toFixed(2)} (the API rejects that mismatch)`
    );
  }
  console.log(`Bill data source: hardcoded fallback items — ${reasons.join('; ')}.`);

  return {
    source: 'fallback',
    merchantName: FALLBACK_BILL.merchantName,
    items: FALLBACK_BILL.items,
    total: FALLBACK_BILL.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    categoryName: extraction?.extracted?.category,
  };
}

async function step4SaveBill() {
  const billData = pickBillData();

  const categories = await fetchCategories(context.token);
  const requestedCategory =
    typeof billData.categoryName === 'string' ? billData.categoryName.trim().toLowerCase() : '';
  const matchedCategory = categories.find(
    (category) => category.name.toLowerCase() === requestedCategory
  );
  const fallbackCategory =
    categories.find((category) => category.name.toLowerCase() === 'other') ?? categories[0];
  const category = matchedCategory ?? fallbackCategory;
  assert(category, 'No categories returned by GET /api/categories');

  console.log(
    matchedCategory
      ? `Category: ${category.name} (${category.id}) — matched extraction`
      : `Category: ${category.name} (${category.id}) — extraction said ${JSON.stringify(billData.categoryName)}, falling back`
  );

  const today = todayIsoDate();
  const extractedDate =
    typeof context.extraction?.extracted?.billDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(context.extraction.extracted.billDate)
      ? context.extraction.extracted.billDate
      : null;
  const billDate = extractedDate && isSameMonth(extractedDate, today) ? extractedDate : today;
  console.log(
    `Bill date: ${billDate}${extractedDate && billDate !== extractedDate ? ` (extraction said ${extractedDate}, outside the current month, so today is used to keep the expense assertions in the current period)` : ''}`
  );

  const split = expectedSplit(billData.total, context.people.personIds, context.people.amountsPaid);
  assert(
    split.baseSharePaise > 0,
    `Computed per-person share is 0 paise for a total of ${formatPaise(split.totalPaise)}`
  );

  console.log(
    `Expected split (${context.people.participants.length + 1}-way): base share ${formatPaise(split.baseSharePaise)} each, remainder ${split.remainderPaise} paise absorbed by you, your share ${formatPaise(split.ownerSharePaise)}`
  );
  for (const entry of split.entries) {
    console.log(`  - ${entry.direction} ${formatPaise(entry.amountPaise)}`);
  }

  // Snapshot before the write so step 5 can assert exact deltas afterwards.
  const balancesBefore = await fetchBalances(context.token);
  const byCategoryBefore = await fetchByCategory(context.token);
  const overTimeBefore = await fetchOverTime(context.token);

  const createRes = await api('POST', '/api/bills', {
    token: context.token,
    body: {
      storagePath: context.extraction.storagePath,
      merchantName: billData.merchantName,
      total: billData.total,
      categoryId: category.id,
      billDate,
      items: billData.items,
      people: context.people.personIds.map((personId) => ({ personId, amountPaid: 0 })),
    },
  });
  assert(
    createRes.status === 201,
    `POST /api/bills returned ${createRes.status}: ${createRes.text}`
  );

  const created = createRes.json;
  assert(created?.id, `POST /api/bills returned no bill id: ${createRes.text}`);

  const returnedDebts = created.debts ?? [];
  console.log(`Saved bill ${created.id} (${billData.merchantName}, ${formatPaise(split.totalPaise)})`);
  console.log(`Returned ${returnedDebts.length} debts:`);
  for (const debt of returnedDebts) {
    console.log(`  - ${debt.id} ${debt.personName}: ${debt.direction} ${debt.owedAmount}`);
  }

  assertEqual(
    returnedDebts.length,
    split.entries.length,
    'number of debts returned by POST /api/bills'
  );
  for (const entry of split.entries) {
    const debt = returnedDebts.find((row) => row.personId === entry.personId);
    assert(debt, `No debt returned for person ${entry.personId}`);
    assertEqual(debt.direction, entry.direction, `direction for person ${entry.personId}`);
  }

  context.bill = {
    id: created.id,
    merchantName: billData.merchantName,
    total: billData.total,
    billDate,
    categoryId: category.id,
    categoryName: category.name,
    source: billData.source,
    items: billData.items,
    debtIdsByPerson: new Map(returnedDebts.map((debt) => [debt.personId, debt.id])),
  };
  context.split = split;
  context.snapshots = {
    balancesBefore,
    byCategoryBefore,
    overTimeBefore,
    monthBucket: monthBucketStart(billDate),
  };

  return context.bill;
}

async function step5VerifyLanded() {
  const { id: billId, categoryId } = context.bill;
  const { entries, ownerSharePaise } = context.split;

  // 5a. Each new debt exists with the right direction and paise amount.
  for (const entry of entries) {
    const person = context.people.participants.find((p) => p.id === entry.personId);
    const debts = await fetchPersonDebts(context.token, entry.personId);
    const debt = debts.find((row) => row.billId === billId);
    assert(debt, `No debt for bill ${billId} found on ${person.name}'s history`);
    assertEqual(debt.amountPaise, entry.amountPaise, `${person.name} amountPaise`);
    assertEqual(debt.direction, entry.direction, `${person.name} direction`);
    assertEqual(debt.amountPaidPaise, 0, `${person.name} amountPaidPaise`);
    assertEqual(debt.remainingPaise, entry.amountPaise, `${person.name} remainingPaise`);
    assertEqual(debt.settledAt, null, `${person.name} settledAt`);
    console.log(
      `  ${person.name}: ${debt.direction} ${formatPaise(debt.amountPaise)} (debt ${debt.id}, unsettled)`
    );
  }
  console.log(`Your own share of this bill: ${formatPaise(ownerSharePaise)}`);

  // 5b. Balances moved by exactly the new debt amounts.
  const balancesAfter = await fetchBalances(context.token);
  for (const entry of entries) {
    const person = context.people.participants.find((p) => p.id === entry.personId);
    const before = context.snapshots.balancesBefore.get(entry.personId)?.netBalancePaise ?? 0;
    const expectedNet = before + signedBalanceDelta(entry);
    const row = balancesAfter.get(entry.personId);
    const actualNet = row?.netBalancePaise ?? 0;
    assertEqual(actualNet, expectedNet, `${person.name} net balance`);
    console.log(
      `  ${person.name} net balance: ${formatPaise(before)} -> ${formatPaise(actualNet)}`
    );
  }

  // 5c. Expense rollups picked the bill up in the current period.
  const byCategoryAfter = await fetchByCategory(context.token);
  const categoryDelta =
    categoryTotalPaise(byCategoryAfter, categoryId) -
    categoryTotalPaise(context.snapshots.byCategoryBefore, categoryId);
  assertEqual(categoryDelta, ownerSharePaise, `by-category delta for ${context.bill.categoryName}`);
  console.log(
    `  by-category ${context.bill.categoryName}: +${formatPaise(categoryDelta)} (matches your share)`
  );

  const overTimeAfter = await fetchOverTime(context.token);
  const bucket = context.snapshots.monthBucket;
  const periodDelta =
    periodTotalPaise(overTimeAfter, bucket) - periodTotalPaise(context.snapshots.overTimeBefore, bucket);
  assertEqual(periodDelta, ownerSharePaise, `over-time delta for period ${bucket}`);
  console.log(
    `  over-time ${bucket}: +${formatPaise(periodDelta)} (matches your share)`
  );

  return { balancesAfter };
}

async function step6SettleDebt() {
  const settlePerson = context.people.settleTarget;
  const debtId = context.bill.debtIdsByPerson.get(settlePerson.id);
  assert(debtId, `No debt from bill ${context.bill.id} belongs to ${settlePerson.name}`);

  const debt = (await fetchPersonDebts(context.token, settlePerson.id)).find(
    (row) => row.id === debtId
  );
  assert(debt, `Debt ${debtId} not found on ${settlePerson.name}`);
  const fullPaise = debt.remainingPaise;
  const partialPaise = fullPaise > 1 ? Math.floor(fullPaise / 2) : fullPaise;
  console.log(
    `${settlePerson.name} owes ${formatPaise(fullPaise)} on debt ${debtId}; settling ${formatPaise(partialPaise)} first.`
  );

  const partialRes = await api('PATCH', `/api/debts/${debtId}/settle`, {
    token: context.token,
    body: { amountPaise: partialPaise },
  });
  assert(
    partialRes.status === 200,
    `PATCH settle (partial) returned ${partialRes.status}: ${partialRes.text}`
  );
  assertEqual(partialRes.json.amountPaidPaise, partialPaise, 'amountPaidPaise after partial settle');
  assertEqual(partialRes.json.settledAt, null, 'settledAt after partial settle');
  assertEqual(
    partialRes.json.remainingPaise,
    fullPaise - partialPaise,
    'remainingPaise after partial settle'
  );
  console.log(
    `  partial settle ok: paid ${formatPaise(partialPaise)}, remaining ${formatPaise(partialRes.json.remainingPaise)}, settledAt still null`
  );

  // Re-read from the API to prove the partial payment was persisted, not just echoed back.
  const persisted = (await fetchPersonDebts(context.token, settlePerson.id)).find(
    (row) => row.id === debtId
  );
  assertEqual(persisted.amountPaidPaise, partialPaise, 'persisted amountPaidPaise');
  assertEqual(persisted.settledAt, null, 'persisted settledAt');

  const remainingPaise = fullPaise - partialPaise;
  const fullRes = await api('PATCH', `/api/debts/${debtId}/settle`, {
    token: context.token,
    body: { amountPaise: remainingPaise },
  });
  assert(
    fullRes.status === 200,
    `PATCH settle (remaining) returned ${fullRes.status}: ${fullRes.text}`
  );
  assertEqual(fullRes.json.amountPaidPaise, fullPaise, 'amountPaidPaise after full settle');
  assert(fullRes.json.settledAt, 'settledAt should be set once the debt is fully paid');
  assertEqual(fullRes.json.remainingPaise, 0, 'remainingPaise after full settle');
  console.log(`  full settle ok: settledAt ${fullRes.json.settledAt}`);

  // The settled debt should no longer contribute to balances.
  const balancesAfterSettle = await fetchBalances(context.token);
  const row = balancesAfterSettle.get(settlePerson.id);
  if (context.people.settleTargetHasCleanSlate) {
    assert(
      !row,
      `${settlePerson.name} still appears in /api/debts/balances after full settlement: ${JSON.stringify(row)}`
    );
    console.log(`  ${settlePerson.name} no longer appears in GET /api/debts/balances`);
  } else {
    const before =
      context.snapshots.balancesBefore.get(settlePerson.id)?.netBalancePaise ?? 0;
    const expectedNet = before;
    assertEqual(row?.netBalancePaise ?? 0, expectedNet, `${settlePerson.name} net balance after settle`);
    console.log(
      `  ${settlePerson.name} had other debts, so they remain listed — net balance back to ${formatPaise(expectedNet)}`
    );
  }

  context.settle = { debtId, personId: settlePerson.id, fullPaise, partialPaise };
  return context.settle;
}

async function step7ReminderFlow(reminderEmail) {
  assert(reminderEmail, 'TEST_REMINDER_EMAIL (or TEST_EMAIL_RECIPIENT) is not set');

  const person = context.people.reminderPerson;
  const patchRes = await api('PATCH', `/api/people/${person.id}`, {
    token: context.token,
    body: { email: reminderEmail },
  });
  assert(
    patchRes.status === 200,
    `PATCH /api/people/${person.id} returned ${patchRes.status}: ${patchRes.text}`
  );
  assertEqual(patchRes.json.email, reminderEmail, 'email returned after PATCH');
  console.log(`Set ${person.name}'s email to ${patchRes.json.email}`);

  const remindRes = await api('POST', `/api/people/${person.id}/remind`, {
    token: context.token,
    timeoutMs: 60_000,
  });
  assert(
    remindRes.status === 200,
    `POST /api/people/${person.id}/remind returned ${remindRes.status}: ${remindRes.text}`
  );
  console.log(`Reminder response: ${JSON.stringify(remindRes.json)}`);
  console.log('Delivery is not asserted here — check your inbox manually.');

  context.reminder = { personId: person.id, email: reminderEmail, response: remindRes.json };
  return context.reminder;
}

// ---------------------------------------------------------------- main

async function main() {
  const { image, reminderEmail } = preflight();
  await assertBackendIsUp();

  const auth = await runStep(1, 'Authenticate as a real user (Supabase Auth)', () =>
    step1Authenticate()
  );
  if (!auth.ok) {
    return;
  }

  const extraction = await runStep(2, 'Upload a bill photo and extract it with Gemini', () =>
    step2UploadAndExtract(image)
  );
  if (!extraction.ok) {
    return;
  }
  if (extraction.value.problems.length > 0) {
    // Extraction problems do not stop the run, but the step stays failed so the
    // exit code still reports a dirty flow.
    const step = stepResults.find((entry) => entry.number === 2);
    step.ok = false;
    step.error = extraction.value.problems.join('; ');
  }

  const split = await runStep(3, 'Create a person and pick existing people for the split', () =>
    step3BuildSplit()
  );
  if (!split.ok) {
    return;
  }

  const bill = await runStep(4, 'Save the bill', () => step4SaveBill());
  if (!bill.ok) {
    return;
  }

  const verify = await runStep(5, 'Verify the bill landed (debts, balances, expenses)', () =>
    step5VerifyLanded()
  );
  if (!verify.ok) {
    return;
  }

  const settle = await runStep(6, 'Settle a debt partially, then fully', () => step6SettleDebt());
  if (!settle.ok) {
    return;
  }

  await runStep(7, 'Reminder flow (set email, trigger reminder)', () =>
    step7ReminderFlow(reminderEmail)
  );
}

function printSummary() {
  console.log('\n--- FINAL SUMMARY ---');
  for (const result of stepResults) {
    const mark = result.ok ? '✓' : '✗';
    const suffix = result.ok ? '' : ` — ${result.error}`;
    console.log(`${mark} Step ${result.number}: ${result.title}${suffix}`);
  }

  if (context.bill) {
    console.log('\nCreated during this run:');
    console.log(`  bill:   ${context.bill.id} (${context.bill.merchantName}, ${formatPaise(context.split.totalPaise)})`);
    console.log(`  data:   ${context.bill.source === 'gemini' ? 'raw Gemini extraction' : 'hardcoded fallback items'}`);
    console.log(`  people: ${context.people.participants.map((p) => `${p.name} (${p.id})`).join(', ')}`);
    if (context.settle) {
      console.log(`  debt:   ${context.settle.debtId} on ${context.people.settleTarget.name} (fully settled)`);
    }
    console.log('\nEyeball in the app:');
    console.log(`  - Diary: ${context.people.participants[0].name} should still show they owe you ${formatPaise(context.split.entries[0].amountPaise)}`);
    console.log(`  - Diary: ${context.people.settleTarget.name} should be settled up / gone`);
    console.log(`  - Expenses: ${context.bill.categoryName} should include your ${formatPaise(context.split.ownerSharePaise)} share for this month`);
  }
  if (context.reminder) {
    console.log(`\nManual check: reminder email to ${context.reminder.email} — open your inbox to confirm delivery.`);
  }

  const failures = stepResults.filter((result) => !result.ok);
  const ranAllSteps = stepResults.length === 7;

  if (stepResults.length === 0) {
    console.log(
      `\nRESULT: FAIL — the run stopped before any step completed${fatalError ? `: ${fatalError}` : '.'}`
    );
    process.exitCode = 1;
    return;
  }

  if (failures.length === 0 && ranAllSteps) {
    console.log('\nRESULT: PASS — the whole flow ran clean.');
    process.exitCode = 0;
    return;
  }

  console.log(`\nRESULT: FAIL — ${failures.length} of ${stepResults.length} run step(s) failed.`);
  if (!ranAllSteps) {
    console.log(`Steps ${stepResults.length + 1}-7 were skipped because an earlier step failed.`);
  }
  process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  fatalError = error.message;
  console.error('\nScript encountered an unexpected error:', error);
  process.exitCode = 1;
} finally {
  printSummary();
}
