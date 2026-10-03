/**
 * Manual Debt verification against the live backend.
 *
 * Checks:
 * A. Create + balance
 *    1. Create a manual debt (they_owe_you) and verify response fields (kind, note, incurredOn, etc).
 *    2. Verify it appears in /api/debts/balances with correct amounts.
 * B. Both directions
 *    3. Create a second debt (you_owe_them, old_due, specific date).
 *    4. Verify /balances updates with both directions and net balance.
 * C. History left join
 *    5. Verify /api/debts/person/:personId returns both manual debts with correct nulls for bill fields.
 * D. Validation matrix
 *    6. Exhaustive check of rejected fields (400) and missing auth (401). Ensures no 500s.
 *    7. Verify edge cases (tomorrow's date, spaces note) are accepted (201).
 *    8. Verify exactly 4 debts were created in DB via service role client (no leaked debts from 400s).
 * E. Edit + delete
 *    9. Edit success: amountPaise, note, direction, incurredOn updates.
 *   10. Edit validation: disallowed fields, invalid values, mixed valid/invalid.
 *   11. Edit/delete routing: invalid UUID, random UUID, missing auth.
 *   12. Guard: payments recorded blocks edit/delete.
 *   13. Delete success: remove debt, verify gone, balances updated.
 *   14. Guard: bill-based debt blocks edit/delete (after expenses check).
 *   15. Final leak check: count debts matches expected.
 * F. Expenses isolation
 *   16. Verify manual debts don't affect expense endpoints (by-category, over-time for month/week).
 */

require('dotenv/config');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const BACKEND_DIR = __dirname;
const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;

let anyFailed = false;

function check(name, ok, detail = '') {
  if (ok) {
    console.log(`PASS: ${name}`);
  } else {
    const suffix = detail ? ` - ${detail}` : '';
    console.log(`FAIL: ${name}${suffix}`);
    anyFailed = true;
  }
}

async function api(method, endpoint, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: payload,
  });

  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: response.status, ok: response.ok, json, text };
}

function readFrontendAnonKey() {
  const frontendEnvPath = path.join(BACKEND_DIR, '..', 'frontend', '.env');
  if (!fs.existsSync(frontendEnvPath)) return null;
  const match = fs.readFileSync(frontendEnvPath, 'utf8').match(/^\s*VITE_SUPABASE_ANON_KEY\s*=\s*(.+)$/m);
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
}

async function getAuthToken() {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  const candidates = [
    process.env.SUPABASE_ANON_KEY,
    process.env.VITE_SUPABASE_ANON_KEY,
    readFrontendAnonKey()
  ].filter(Boolean);

  for (const key of candidates) {
    const client = createClient(process.env.SUPABASE_URL, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data } = await client.auth.signInWithPassword({ email, password });
    if (data?.session?.access_token) {
      return data.session.access_token;
    }
  }
  throw new Error('Could not authenticate. Check TEST_USER_EMAIL and TEST_USER_PASSWORD in .env');
}

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function getUtcToday() {
  return new Date().toISOString().split('T')[0];
}

function getUtcTomorrow() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0];
}

function getUtc3DaysFuture() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 3);
  return d.toISOString().split('T')[0];
}

async function runChecks(token) {
  let personId = null;
  let throwawayBillId = null;
  let expensesBefore = {};

  try {
    // Setup
    const personRes = await api('POST', '/api/people', {
      token,
      body: { name: `verify-manual-${Date.now()}` }
    });
    if (!personRes.ok) throw new Error('Failed to create test person: ' + personRes.text);
    personId = personRes.json.id;

    // Capture expenses baseline before any debts are created
    const expBefore1 = await api('GET', '/api/expenses/by-category?granularity=month', { token });
    expensesBefore.byCategoryMonth = JSON.stringify(expBefore1.json);

    const expBefore2 = await api('GET', '/api/expenses/over-time?granularity=month', { token });
    expensesBefore.overTimeMonth = JSON.stringify(expBefore2.json);

    const expBefore3 = await api('GET', '/api/expenses/by-category?granularity=week', { token });
    expensesBefore.byCategoryWeek = JSON.stringify(expBefore3.json);

    const expBefore4 = await api('GET', '/api/expenses/over-time?granularity=week', { token });
    expensesBefore.overTimeWeek = JSON.stringify(expBefore4.json);

    // A. Create + balance
    const a1 = await api('POST', '/api/debts/manual', {
      token,
      body: { personId, direction: 'they_owe_you', amountPaise: 50000, kind: 'loan', note: 'verify loan' }
    });
    const a1Ok = a1.status === 201 
      && a1.json.kind === 'loan' 
      && a1.json.note === 'verify loan' 
      && a1.json.merchantName === null 
      && a1.json.billDate === null
      && a1.json.incurredOn === getUtcToday();
    check('A1. Create manual debt', a1Ok, a1Ok ? '' : `status=${a1.status} json=${JSON.stringify(a1.json)}`);

    const a2 = await api('GET', '/api/debts/balances', { token });
    const b1 = a2.json?.balances?.find(b => b.personId === personId);
    const a2Ok = b1 && b1.theyOweYouPaise === 50000 && b1.netBalancePaise === 50000;
    check('A2. Balances updated', a2Ok, a2Ok ? '' : `b=${JSON.stringify(b1)}`);

    // B. Both directions
    const b3 = await api('POST', '/api/debts/manual', {
      token,
      body: { personId, direction: 'you_owe_them', amountPaise: 20000, kind: 'old_due', incurredOn: '2025-01-15' }
    });
    check('B3. Second debt', b3.status === 201, b3.status === 201 ? '' : `status=${b3.status} text=${b3.text.slice(0, 100)}`);

    const b4 = await api('GET', '/api/debts/balances', { token });
    const b2 = b4.json?.balances?.find(b => b.personId === personId);
    const b4Ok = b2 && b2.theyOweYouPaise === 50000 && b2.youOweThemPaise === 20000 && b2.netBalancePaise === 30000;
    check('B4. Balances combined', b4Ok, b4Ok ? '' : `b=${JSON.stringify(b2)}`);

    // C. History left join
    const c5 = await api('GET', `/api/debts/person/${personId}`, { token });
    const debts = c5.json?.debts || [];
    const c5Ok = debts.length === 2 
      && debts.every(d => d.merchantName === null)
      && debts.some(d => d.kind === 'loan')
      && debts.some(d => d.kind === 'old_due');
    check('C5. Person history', c5Ok, c5Ok ? '' : `debts=${JSON.stringify(debts)}`);

    // D. Validation matrix
    const validBody = { personId, direction: 'they_owe_you', amountPaise: 1000, kind: 'loan' };
    
    const cases = [
      { name: 'amount 0', mod: { amountPaise: 0 }, exp: 400 },
      { name: 'amount -5', mod: { amountPaise: -5 }, exp: 400 },
      { name: 'amount float', mod: { amountPaise: 500.5 }, exp: 400 },
      { name: 'amount string', mod: { amountPaise: "500" }, exp: 400 },
      { name: 'amount large', mod: { amountPaise: 2147483648 }, exp: 400 },
      
      { name: 'direction invalid', mod: { direction: 'owes' }, exp: 400 },
      
      { name: 'kind bill', mod: { kind: 'bill' }, exp: 400 },
      { name: 'kind other', mod: { kind: 'other' }, exp: 400 },
      { name: 'kind missing', mod: { kind: undefined }, exp: 400 },
      
      { name: 'person invalid', mod: { personId: 'not-a-uuid' }, exp: 400 },
      { name: 'person random', mod: { personId: crypto.randomUUID() }, exp: 404 },
      
      { name: 'date invalid format', mod: { incurredOn: '2026-13-45' }, exp: 400 },
      { name: 'date invalid day', mod: { incurredOn: '2026-02-31' }, exp: 400 },
      { name: 'date random string', mod: { incurredOn: 'yesterday' }, exp: 400 },
      { name: 'date future', mod: { incurredOn: getUtc3DaysFuture() }, exp: 400 },
      
      { name: 'note long', mod: { note: 'A'.repeat(201) }, exp: 400 },
      { name: 'note number', mod: { note: 123 }, exp: 400 },
    ];

    for (const c of cases) {
      const res = await api('POST', '/api/debts/manual', {
        token,
        body: { ...validBody, ...c.mod }
      });
      const ok = res.status === c.exp;
      check(`D. Validation: ${c.name}`, ok, ok ? '' : `expected ${c.exp} got ${res.status} text=${res.text.slice(0, 100)}`);
      if (res.status === 500) check(`D. Validation: ${c.name} NO 500`, false, 'Returned 500');
    }

    const noAuth = await api('POST', '/api/debts/manual', { body: validBody });
    check('D. Validation: no auth', noAuth.status === 401, noAuth.status === 401 ? '' : `got ${noAuth.status} text=${noAuth.text.slice(0, 100)}`);

    // Edge cases accepted
    const edge1 = await api('POST', '/api/debts/manual', {
      token,
      body: { ...validBody, incurredOn: getUtcTomorrow() }
    });
    check('D. Edge: tomorrow date', edge1.status === 201, edge1.status === 201 ? '' : `got ${edge1.status} text=${edge1.text.slice(0, 100)}`);

    const edge2 = await api('POST', '/api/debts/manual', {
      token,
      body: { ...validBody, note: '   ' }
    });
    const edge2Ok = edge2.status === 201 && edge2.json.note === null;
    check('D. Edge: spaces note', edge2Ok, edge2Ok ? '' : `got ${edge2.status} json=${JSON.stringify(edge2.json)}`);

    // D final: confirm row count
    const { count, error } = await supabaseAdmin
      .from('debts')
      .select('*', { count: 'exact', head: true })
      .eq('person_id', personId);

    if (error) {
      check('D. Row count check', false, error.message);
    } else {
      check('D. Row count check', count === 4, count === 4 ? '' : `expected 4, found ${count}`);
    }

    // E. Edit + delete
    let debtXId = null;
    let billDebtId = null;
    let debtYId = null;
    let userId = null;
      // Get user_id from test person
      const { data: personRow } = await supabaseAdmin
        .from('people')
        .select('user_id')
        .eq('id', personId)
        .single();
      userId = personRow?.user_id;

      // Create manual debt X
      const eX = await api('POST', '/api/debts/manual', {
        token,
        body: { personId, direction: 'they_owe_you', amountPaise: 10000, kind: 'loan', note: 'e-test' }
      });
      debtXId = eX.json?.id;
      check('E1. Setup: create debt X', eX.status === 201, eX.status === 201 ? '' : `status=${eX.status}`);

      // E1 Edit success
      const e1a = await api('PATCH', `/api/debts/${debtXId}`, {
        token,
        body: { amountPaise: 12000, note: 'edited' }
      });
      const e1aOk = e1a.status === 200
        && e1a.json.amountPaise === 12000
        && e1a.json.note === 'edited'
        && e1a.json.kind === 'loan'
        && e1a.json.amountPaidPaise === 0;
      check('E1. Edit: amountPaise + note', e1aOk, e1aOk ? '' : `status=${e1a.status} json=${JSON.stringify(e1a.json)}`);

      const e1b = await api('PATCH', `/api/debts/${debtXId}`, { token, body: { note: null } });
      check('E1. Edit: note null', e1b.status === 200 && e1b.json.note === null, `status=${e1b.status} text=${e1b.text.slice(0, 100)}`);

      const e1c = await api('PATCH', `/api/debts/${debtXId}`, { token, body: { note: '   ' } });
      check('E1. Edit: note spaces', e1c.status === 200 && e1c.json.note === null, `status=${e1c.status} text=${e1c.text.slice(0, 100)}`);

      const e1d = await api('PATCH', `/api/debts/${debtXId}`, { token, body: { direction: 'you_owe_them' } });
      check('E1. Edit: direction flip', e1d.status === 200 && e1d.json.direction === 'you_owe_them', `status=${e1d.status} text=${e1d.text.slice(0, 100)}`);

      const e1e = await api('PATCH', `/api/debts/${debtXId}`, { token, body: { direction: 'they_owe_you' } });
      check('E1. Edit: direction back', e1e.status === 200 && e1e.json.direction === 'they_owe_you', `status=${e1e.status} text=${e1e.text.slice(0, 100)}`);

      const e1f = await api('PATCH', `/api/debts/${debtXId}`, { token, body: { incurredOn: '2025-02-01' } });
      check('E1. Edit: incurredOn', e1f.status === 200 && e1f.json.incurredOn === '2025-02-01', `status=${e1f.status} text=${e1f.text.slice(0, 100)}`);

      // E2 Edit validation
      const e2Cases = [
        { name: 'empty body', body: {}, exp: 400 },
        { name: 'kind field', body: { kind: 'bill' }, exp: 400 },
        { name: 'amountPaidPaise field', body: { amountPaidPaise: 0 }, exp: 400 },
        { name: 'personId field', body: { personId: crypto.randomUUID() }, exp: 400 },
        { name: 'billId field', body: { billId: null }, exp: 400 },
        { name: 'settledAt field', body: { settledAt: null }, exp: 400 },
        { name: 'amountPaise 0', body: { amountPaise: 0 }, exp: 400 },
        { name: 'amountPaise float', body: { amountPaise: 500.5 }, exp: 400 },
        { name: 'amountPaise null', body: { amountPaise: null }, exp: 400 },
        { name: 'direction invalid', body: { direction: 'owes' }, exp: 400 },
        { name: 'incurredOn null', body: { incurredOn: null }, exp: 400 },
        { name: 'incurredOn invalid', body: { incurredOn: '2026-02-31' }, exp: 400 },
        { name: 'incurredOn future', body: { incurredOn: getUtc3DaysFuture() }, exp: 400 },
        { name: 'note long', body: { note: 'x'.repeat(201) }, exp: 400 },
        { name: 'mixed valid+invalid', body: { amountPaise: 15000, kind: 'bill' }, exp: 400 },
      ];

      for (const c of e2Cases) {
        const res = await api('PATCH', `/api/debts/${debtXId}`, { token, body: c.body });
        const ok = res.status === c.exp;
        check(`E2. Validation: ${c.name}`, ok, ok ? '' : `expected ${c.exp} got ${res.status} text=${res.text.slice(0, 100)}`);
        if (res.status === 500) check(`E2. Validation: ${c.name} NO 500`, false, 'Returned 500');

        // Verify debt X unchanged via service-role
        const { data: checkX } = await supabaseAdmin
          .from('debts')
          .select('amount_paise, note, direction, incurred_on')
          .eq('id', debtXId)
          .single();
        const unchanged = checkX
          && checkX.amount_paise === 12000
          && checkX.note === null
          && checkX.direction === 'they_owe_you'
          && checkX.incurred_on === '2025-02-01';
        check(`E2. Validation: ${c.name} unchanged`, unchanged, unchanged ? '' : `amount=${checkX?.amount_paise} note=${checkX?.note} direction=${checkX?.direction} incurred_on=${checkX?.incurred_on}`);
      }

      // E3 Edit/delete routing
      const e3a = await api('PATCH', '/api/debts/not-a-uuid', { token, body: { note: 'x' } });
      check('E3. PATCH invalid UUID', e3a.status === 400, `got ${e3a.status} text=${e3a.text.slice(0, 100)}`);

      const e3b = await api('DELETE', '/api/debts/not-a-uuid', { token });
      check('E3. DELETE invalid UUID', e3b.status === 400, `got ${e3b.status} text=${e3b.text.slice(0, 100)}`);

      const randomId = crypto.randomUUID();
      const e3c = await api('PATCH', `/api/debts/${randomId}`, { token, body: { note: 'x' } });
      check('E3. PATCH random UUID', e3c.status === 404, `got ${e3c.status} text=${e3c.text.slice(0, 100)}`);

      const e3d = await api('DELETE', `/api/debts/${randomId}`, { token });
      check('E3. DELETE random UUID', e3d.status === 404, `got ${e3d.status} text=${e3d.text.slice(0, 100)}`);

      const e3e = await api('PATCH', `/api/debts/${debtXId}`, { body: { note: 'x' } });
      check('E3. PATCH no auth', e3e.status === 401, `got ${e3e.status} text=${e3e.text.slice(0, 100)}`);

      const e3f = await api('DELETE', `/api/debts/${debtXId}`);
      check('E3. DELETE no auth', e3f.status === 401, `got ${e3f.status} text=${e3f.text.slice(0, 100)}`);

      // E4 Guard: payments recorded
      const e4a = await api('PATCH', `/api/debts/${debtXId}/settle`, { token, body: { amountPaise: 1000 } });
      check('E4. Partial settle', e4a.status === 200, `got ${e4a.status} text=${e4a.text.slice(0, 100)}`);

      const e4b = await api('PATCH', `/api/debts/${debtXId}`, { token, body: { note: 'nope' } });
      check('E4. PATCH blocked by payment', e4b.status === 409, `got ${e4b.status} text=${e4b.text.slice(0, 100)}`);

      const e4c = await api('DELETE', `/api/debts/${debtXId}`, { token });
      check('E4. DELETE blocked by payment', e4c.status === 409, `got ${e4c.status} text=${e4c.text.slice(0, 100)}`);

      const { data: checkX4 } = await supabaseAdmin
        .from('debts')
        .select('amount_paise, note, amount_paid_paise, direction, incurred_on')
        .eq('id', debtXId)
        .single();
      const e4dOk = checkX4
        && checkX4.amount_paise === 12000
        && checkX4.note === null
        && checkX4.amount_paid_paise === 1000
        && checkX4.direction === 'they_owe_you'
        && checkX4.incurred_on === '2025-02-01';
      check('E4. Debt unchanged after blocks', e4dOk, e4dOk ? '' : `amount=${checkX4?.amount_paise} note=${checkX4?.note} amount_paid=${checkX4?.amount_paid_paise} direction=${checkX4?.direction} incurred_on=${checkX4?.incurred_on}`);

      // E6 Delete success - part 1: create Y and check it appears in balances
      const beforeBalances = await api('GET', '/api/debts/balances', { token });
      const before = beforeBalances.json?.balances?.find(b => b.personId === personId);

      const eY = await api('POST', '/api/debts/manual', {
        token,
        body: { personId, direction: 'they_owe_you', amountPaise: 7000, kind: 'old_due' }
      });
      debtYId = eY.json?.id;
      check('E6. Setup: create debt Y', eY.status === 201, `got ${eY.status} text=${eY.text.slice(0, 100)}`);

      const afterCreate = await api('GET', '/api/debts/balances', { token });
      const afterC = afterCreate.json?.balances?.find(b => b.personId === personId);
      const includeOk = afterC && before && afterC.theyOweYouPaise === before.theyOweYouPaise + 7000;
      check('E6. Balances include Y while it exists', includeOk, includeOk ? '' : `before=${before?.theyOweYouPaise} after=${afterC?.theyOweYouPaise}`);

      // F. Expenses isolation (while Y still exists)
      const expAfter1 = await api('GET', '/api/expenses/by-category?granularity=month', { token });
      const f1Ok = JSON.stringify(expAfter1.json) === expensesBefore.byCategoryMonth;
      check('F1. Expenses by-category (month) unchanged', f1Ok, f1Ok ? '' : `before=${expensesBefore.byCategoryMonth.slice(0, 100)} after=${JSON.stringify(expAfter1.json).slice(0, 100)}`);

      const expAfter2 = await api('GET', '/api/expenses/over-time?granularity=month', { token });
      const f2Ok = JSON.stringify(expAfter2.json) === expensesBefore.overTimeMonth;
      check('F2. Expenses over-time (month) unchanged', f2Ok, f2Ok ? '' : `before=${expensesBefore.overTimeMonth.slice(0, 100)} after=${JSON.stringify(expAfter2.json).slice(0, 100)}`);

      const expAfter3 = await api('GET', '/api/expenses/by-category?granularity=week', { token });
      const f3Ok = JSON.stringify(expAfter3.json) === expensesBefore.byCategoryWeek;
      check('F3. Expenses by-category (week) unchanged', f3Ok, f3Ok ? '' : `before=${expensesBefore.byCategoryWeek.slice(0, 100)} after=${JSON.stringify(expAfter3.json).slice(0, 100)}`);

      const expAfter4 = await api('GET', '/api/expenses/over-time?granularity=week', { token });
      const f4Ok = JSON.stringify(expAfter4.json) === expensesBefore.overTimeWeek;
      check('F4. Expenses over-time (week) unchanged', f4Ok, f4Ok ? '' : `before=${expensesBefore.overTimeWeek.slice(0, 100)} after=${JSON.stringify(expAfter4.json).slice(0, 100)}`);

      // E6 Delete success - part 2: delete Y and remaining checks
      const e6a = await api('DELETE', `/api/debts/${debtYId}`, { token });
      const e6aOk = e6a.status === 200 && e6a.json?.id === debtYId;
      check('E6. DELETE Y success', e6aOk, `status=${e6a.status} text=${e6a.text.slice(0, 100)}`);

      const { data: checkY } = await supabaseAdmin
        .from('debts')
        .select('id')
        .eq('id', debtYId)
        .maybeSingle();
      check('E6. Y gone from DB', checkY === null, `still exists: ${checkY?.id}`);

      const e6b = await api('DELETE', `/api/debts/${debtYId}`, { token });
      check('E6. DELETE Y again 404', e6b.status === 404, `got ${e6b.status} text=${e6b.text.slice(0, 100)}`);

      const afterDelete = await api('GET', '/api/debts/balances', { token });
      const afterD = afterDelete.json?.balances?.find(b => b.personId === personId);
      const backOk = afterD && before
        && afterD.theyOweYouPaise === before.theyOweYouPaise
        && afterD.youOweThemPaise === before.youOweThemPaise
        && afterD.netBalancePaise === before.netBalancePaise;
      check('E6. Balances back to normal after delete', backOk, backOk ? '' : `before=${JSON.stringify(before)} after=${JSON.stringify(afterD)}`);

      // E5 Guard: bill-based debt - NOW create the throwaway bill
      const ts = Date.now();
      const { data: billData, error: billError } = await supabaseAdmin
        .from('bills')
        .insert({
          merchant_name: `verify-manual-${ts}`,
          total_amount: 1,
          user_share_paise: 100,
          category_id: null,
          bill_date: getUtcToday(),
          user_id: userId
        })
        .select('id')
        .single();
      if (billError) {
        check('E5. Setup: create bill', false, billError.message);
      } else {
        throwawayBillId = billData.id;
        const { data: billDebtData, error: billDebtError } = await supabaseAdmin
          .from('debts')
          .insert({
            person_id: personId,
            bill_id: throwawayBillId,
            kind: 'bill',
            direction: 'they_owe_you',
            amount_paise: 100
          })
          .select('id')
          .single();
        if (billDebtError) {
          check('E5. Setup: create bill debt', false, billDebtError.message);
        } else {
          billDebtId = billDebtData.id;

          const e5a = await api('PATCH', `/api/debts/${billDebtId}`, { token, body: { note: 'nope' } });
          check('E5. PATCH bill debt blocked', e5a.status === 409, `got ${e5a.status} text=${e5a.text.slice(0, 100)}`);

          const e5b = await api('DELETE', `/api/debts/${billDebtId}`, { token });
          check('E5. DELETE bill debt blocked', e5b.status === 409, `got ${e5b.status} text=${e5b.text.slice(0, 100)}`);

          const { data: checkBillDebt } = await supabaseAdmin
            .from('debts')
            .select('amount_paise, note, kind, amount_paid_paise')
            .eq('id', billDebtId)
            .single();
          const e5Ok = checkBillDebt
            && checkBillDebt.amount_paise === 100
            && checkBillDebt.note === null
            && checkBillDebt.kind === 'bill'
            && checkBillDebt.amount_paid_paise === 0;
          check('E5. Bill debt unchanged', e5Ok, e5Ok ? '' : `amount=${checkBillDebt?.amount_paise} note=${checkBillDebt?.note} kind=${checkBillDebt?.kind} amount_paid=${checkBillDebt?.amount_paid_paise}`);
        }
      }

      // E7 Final leak check
      const { count: finalCount, error: finalError } = await supabaseAdmin
        .from('debts')
        .select('*', { count: 'exact', head: true })
        .eq('person_id', personId);
      if (finalError) {
        check('E7. Final leak check', false, finalError.message);
      } else {
        // Expected: 4 from A-D + X (with payment) + bill debt = 6 total (Y deleted)
        const expectedCount = 6;
        check('E7. Final leak check', finalCount === expectedCount, `expected ${expectedCount}, found ${finalCount}`);
      }

  } finally {
    // Cleanup (each step wrapped in try/catch to ensure all steps run)
    try {
      if (throwawayBillId) {
        const { error: billDeleteError } = await supabaseAdmin
          .from('bills')
          .delete()
          .eq('id', throwawayBillId);
        if (billDeleteError) {
          console.error('CLEANUP WARNING: delete throwaway bill -', billDeleteError.message);
        }
      }
    } catch (err) {
      console.error('CLEANUP WARNING: delete throwaway bill -', err.message);
    }

    try {
      if (personId) {
        const { error: debtsDeleteError } = await supabaseAdmin
          .from('debts')
          .delete()
          .eq('person_id', personId);
        if (debtsDeleteError) {
          console.error('CLEANUP WARNING: delete person debts -', debtsDeleteError.message);
        }
      }
    } catch (err) {
      console.error('CLEANUP WARNING: delete person debts -', err.message);
    }

    try {
      if (personId) {
        const { error: personDeleteError } = await supabaseAdmin
          .from('people')
          .delete()
          .eq('id', personId);
        if (personDeleteError) {
          console.error('CLEANUP WARNING: delete test person -', personDeleteError.message);
        }
      }
    } catch (err) {
      console.error('CLEANUP WARNING: delete test person -', err.message);
    }
  }

  if (anyFailed) {
    process.exit(1);
  }
}

async function main() {
  const token = await getAuthToken();
  await runChecks(token);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
