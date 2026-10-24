/**
 * Verification script for DELETE /api/account
 *
 * Verifies the complete account deletion flow against the live backend:
 *   1. Asserts 401 Unauthorized when calling DELETE /api/account without a token.
 *   2. Creates a throwaway test user in Supabase Auth.
 *   3. Populates all related records:
 *      - Profile (handled by auth trigger or inserted)
 *      - Person in `people`
 *      - Dummy image in `bill-images` bucket under `${userId}/`
 *      - Bill in `bills`
 *      - Debt in `debts`
 *   4. Calls DELETE /api/account with the user's Bearer token.
 *   5. Asserts:
 *      - HTTP 200 response with { success: true }
 *      - Auth user is removed from Supabase Auth
 *      - Profile row is gone
 *      - People rows for user are gone
 *      - Bills rows for user are gone
 *      - Debts rows are gone
 *      - Storage folder under bill-images/${userId}/ is completely empty
 *
 * Usage:
 *   1. Ensure your backend server is running:
 *      cd backend && npm start
 *   2. Run this script from the backend directory:
 *      node verifyDeleteAccount.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------- reporting
const results = [];

function section(title) {
  console.log(`\n=== ${title} ===`);
}

function check(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail });
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${suffix}`);
  return Boolean(ok);
}

// ---------------------------------------------------------------- helpers
async function api(method, endpoint, { token, body } = {}) {
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
  });

  const contentType = response.headers.get('content-type') || '';
  let responseBody = null;
  if (contentType.includes('application/json')) {
    responseBody = await response.json().catch(() => null);
  } else {
    responseBody = await response.text().catch(() => null);
  }

  return {
    status: response.status,
    ok: response.ok,
    body: responseBody,
  };
}

async function main() {
  console.log(`Starting DELETE /api/account verification against ${BASE_URL}...`);

  section('1. Authorization Guards');
  const unauthRes = await api('DELETE', '/api/account');
  check(
    'DELETE /api/account without token returns 401',
    unauthRes.status === 401,
    `Status ${unauthRes.status}`
  );

  section('2. Creating Throwaway Test User');
  const timestamp = Date.now();
  const testEmail = `verify-delete-${timestamp}@example.com`;
  const testPassword = `TestPass!${timestamp}`;

  let testUserId = null;
  let testUserToken = null;
  let createdPersonId = null;
  let createdBillId = null;
  let createdDebtId = null;

  try {
    const { data: authUserData, error: createAuthError } =
      await supabaseAdmin.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true,
        user_metadata: { full_name: 'Throwaway Test User' },
      });

    if (createAuthError || !authUserData?.user) {
      throw new Error(`Failed to create test user: ${createAuthError?.message}`);
    }

    testUserId = authUserData.user.id;
    check('Created throwaway auth user', true, `User ID: ${testUserId}`);

    // Allow trigger to insert profile, or ensure profile exists
    await new Promise((resolve) => setTimeout(resolve, 800));
    const { data: profileCheck } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', testUserId)
      .maybeSingle();

    if (!profileCheck) {
      await supabaseAdmin.from('profiles').insert({
        id: testUserId,
        email: testEmail,
        full_name: 'Throwaway Test User',
      });
    }

    // Sign in using anon or verifier client to obtain session token
    const anonKey = process.env.SUPABASE_ANON_KEY;
    let clientForSignIn = supabaseAdmin;
    if (anonKey) {
      clientForSignIn = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false },
      });
    }

    const { data: signInData, error: signInError } =
      await clientForSignIn.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

    if (signInError || !signInData?.session?.access_token) {
      throw new Error(`Failed to sign in as test user: ${signInError?.message}`);
    }

    testUserToken = signInData.session.access_token;
    check('Obtained access token for test user', true);

    section('3. Seeding Test Data (People, Storage, Bills, Debts)');
    // 3a. Create Person
    const { data: personData, error: personError } = await supabaseAdmin
      .from('people')
      .insert({
        user_id: testUserId,
        name: `Friend ${timestamp}`,
        email: `friend-${timestamp}@example.com`,
      })
      .select('id')
      .single();

    if (personError || !personData) {
      throw new Error(`Failed to seed person: ${personError?.message}`);
    }
    createdPersonId = personData.id;
    check('Seeded person', true, `Person ID: ${createdPersonId}`);

    // 3b. Seed dummy image in Storage
    const dummyImageBuffer = Buffer.from('fake-image-bytes-for-verification');
    const storageFilePath = `${testUserId}/${timestamp}-test-bill.jpg`;
    const { error: storageError } = await supabaseAdmin.storage
      .from('bill-images')
      .upload(storageFilePath, dummyImageBuffer, {
        contentType: 'image/jpeg',
      });

    if (storageError) {
      throw new Error(`Failed to upload test bill image: ${storageError?.message}`);
    }
    check('Seeded storage image in bill-images', true, `Path: ${storageFilePath}`);

    // 3c. Seed Bill
    const { data: billData, error: billError } = await supabaseAdmin
      .from('bills')
      .insert({
        user_id: testUserId,
        merchant_name: 'Test Merchant',
        total_amount: 100.0,
        user_share_paise: 5000,
        image_url: storageFilePath,
        bill_date: new Date().toISOString().split('T')[0],
      })
      .select('id')
      .single();

    if (billError || !billData) {
      throw new Error(`Failed to seed bill: ${billError?.message}`);
    }
    createdBillId = billData.id;
    check('Seeded bill', true, `Bill ID: ${createdBillId}`);

    // 3d. Seed Debt
    const { data: debtData, error: debtError } = await supabaseAdmin
      .from('debts')
      .insert({
        bill_id: createdBillId,
        person_id: createdPersonId,
        direction: 'they_owe_you',
        amount_paise: 5000,
        amount_paid_paise: 0,
        kind: 'bill',
      })
      .select('id')
      .single();

    if (debtError || !debtData) {
      throw new Error(`Failed to seed debt: ${debtError?.message}`);
    }
    createdDebtId = debtData.id;
    check('Seeded debt', true, `Debt ID: ${createdDebtId}`);

    section('4. Calling DELETE /api/account');
    const deleteRes = await api('DELETE', '/api/account', {
      token: testUserToken,
    });

    check(
      'DELETE /api/account returns 200 OK',
      deleteRes.status === 200,
      `Status ${deleteRes.status}`
    );
    check(
      'DELETE /api/account returns { success: true }',
      deleteRes.body?.success === true
    );

    section('5. Asserting All Data Is Permanently Deleted');

    // 5a. Auth user gone
    const { data: getUserData, error: getUserError } =
      await supabaseAdmin.auth.admin.getUserById(testUserId);
    check(
      'Auth user is deleted from Supabase Auth',
      Boolean(getUserError || !getUserData?.user),
      getUserError ? getUserError.message : 'User not found'
    );

    // 5b. Profile gone
    const { data: profileAfter } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', testUserId)
      .maybeSingle();
    check('Profile row is deleted', !profileAfter);

    // 5c. People gone
    const { data: peopleAfter } = await supabaseAdmin
      .from('people')
      .select('id')
      .eq('user_id', testUserId);
    check(
      'People rows are deleted',
      !peopleAfter || peopleAfter.length === 0,
      `Remaining: ${peopleAfter?.length || 0}`
    );

    // 5d. Bills gone
    const { data: billsAfter } = await supabaseAdmin
      .from('bills')
      .select('id')
      .eq('user_id', testUserId);
    check(
      'Bills rows are deleted',
      !billsAfter || billsAfter.length === 0,
      `Remaining: ${billsAfter?.length || 0}`
    );

    // 5e. Debts gone
    const { data: debtsAfter } = await supabaseAdmin
      .from('debts')
      .select('id')
      .in('id', [createdDebtId]);
    check(
      'Debts rows are deleted',
      !debtsAfter || debtsAfter.length === 0,
      `Remaining: ${debtsAfter?.length || 0}`
    );

    // 5f. Storage folder empty
    const { data: storageFilesAfter } = await supabaseAdmin.storage
      .from('bill-images')
      .list(testUserId);
    check(
      'Storage files in bill-images are deleted',
      !storageFilesAfter || storageFilesAfter.length === 0,
      `Remaining files: ${storageFilesAfter?.length || 0}`
    );

    testUserId = null; // Successfully deleted
  } catch (err) {
    console.error('\nVerification encountered an unexpected error:', err);
  } finally {
    // Cleanup if something failed before account deletion completed
    if (testUserId) {
      console.log('\nCleaning up leftover test user data...');
      try {
        if (createdDebtId) {
          await supabaseAdmin.from('debts').delete().eq('id', createdDebtId);
        }
        if (createdBillId) {
          await supabaseAdmin.from('bills').delete().eq('id', createdBillId);
        }
        if (createdPersonId) {
          await supabaseAdmin.from('people').delete().eq('id', createdPersonId);
        }
        await supabaseAdmin.from('profiles').delete().eq('id', testUserId);
        const { data: files } = await supabaseAdmin.storage
          .from('bill-images')
          .list(testUserId);
        if (files && files.length > 0) {
          await supabaseAdmin.storage
            .from('bill-images')
            .remove(files.map((f) => `${testUserId}/${f.name}`));
        }
        await supabaseAdmin.auth.admin.deleteUser(testUserId);
      } catch (cleanupErr) {
        console.error('Failed to clean up test user:', cleanupErr);
      }
    }
  }

  section('Summary');
  const allPassed = results.every((r) => r.ok);
  const passedCount = results.filter((r) => r.ok).length;
  console.log(`Total checks: ${results.length}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${results.length - passedCount}`);

  if (allPassed) {
    console.log('\nAll checks PASSED!');
    process.exit(0);
  } else {
    console.log('\nSome checks FAILED.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled fatal error:', err);
  process.exit(1);
});
