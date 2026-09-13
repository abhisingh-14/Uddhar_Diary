require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// For auth, we need the anon key as well to act as a client
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6ZnZycWZzcWNteXh5YWhvcmJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MjkzMzEsImV4cCI6MjEwMjIwNTMzMX0.tYbPDSNAV_BwlJ9OzcxCby8o0dKvIf5ZQxS-yoYDb0A';
const supabaseClient = createClient(process.env.SUPABASE_URL, anonKey);

const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;

async function verify() {
  console.log('--- Starting Part A End-to-End Verification ---');
  let passTrigger = false;
  let passUnauth = false;
  let passFeatures = false;
  let passLogin = false;

  try {
    const testEmail = `testuser_${crypto.randomBytes(4).toString('hex')}@example.com`;
    const testPassword = 'TestPassword123!';

    console.log(`\n1. Creating user via admin API: ${testEmail}`);
    const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true
    });

    if (signUpError) {
      console.error('FAIL: Signup failed:', signUpError.message);
      return;
    }

    const userId = signUpData.user.id;
    console.log(`User created with ID: ${userId}`);

    // Check if trigger created the profiles row
    console.log('\n--- 2. Checking if profiles row is created (Trigger) ---');
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profileData) {
      console.log('FAIL: Profile row not found for new user.');
    } else {
      console.log('PASS: Profile row exists.');
      passTrigger = true;
    }

    console.log('\n--- 3. Checking unauthenticated request ---');
    const resUnauth = await fetch(`${BASE_URL}/api/expenses/by-category?granularity=month`);
    if (resUnauth.status === 401) {
      console.log('PASS: Unauthenticated request got 401 Unauthorized.');
      passUnauth = true;
    } else {
      console.log(`FAIL: Expected 401, got ${resUnauth.status}`);
    }

    console.log('\n--- 4. Checking login session ---');
    const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    let token = null;
    if (loginError || !loginData.session) {
      console.log('FAIL: Login failed.');
    } else {
      console.log('PASS: Login successful and returned a valid session.');
      passLogin = true;
      token = loginData.session.access_token;
    }

    if (!token) {
      console.log('Aborting further tests due to missing token.');
      return;
    }

    console.log('\n--- 5. Verifying Step 1-3 features with authenticated user ---');
    // Feature 1: Create a person
    const resPerson = await fetch(`${BASE_URL}/api/people`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: 'Test Friend' })
    });

    if (!resPerson.ok) {
      console.log('FAIL: Could not create person', await resPerson.text());
    } else {
      const personData = await resPerson.json();
      const personId = personData.id;

      // Feature 2: Create a category
      const resCat = await fetch(`${BASE_URL}/api/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: 'Test Category', icon: 'test', color: '#000000' })
      });

      if (!resCat.ok) {
        console.log('FAIL: Could not create category', await resCat.text());
      } else {
        const catData = await resCat.json();
        const categoryId = catData.id;

        // Feature 3: Create a bill (Split Bill)
        const billPayload = {
          storagePath: 'test-path',
          merchantName: 'Test Merchant',
          total: 100,
          categoryId: categoryId,
          billDate: '2026-01-01',
          items: [{ name: 'Item 1', price: 100, quantity: 1 }],
          people: [{ personId: personId, amountPaid: 0 }]
        };

        const resBill = await fetch(`${BASE_URL}/api/bills`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(billPayload)
        });

        if (!resBill.ok) {
          console.log('FAIL: Could not create bill', await resBill.text());
        } else {
          console.log('PASS: Successfully created person, category, and bill with logged-in session.');
          passFeatures = true;
        }
      }
    }

    console.log('\n--- FINAL SUMMARY ---');
    console.log(`Trigger creates profile: ${passTrigger ? 'PASS' : 'FAIL'}`);
    console.log(`Unauthenticated gets 401: ${passUnauth ? 'PASS' : 'FAIL'}`);
    console.log(`Login works and returns session: ${passLogin ? 'PASS' : 'FAIL'}`);
    console.log(`Features (Step 1-3) work for logged-in user: ${passFeatures ? 'PASS' : 'FAIL'}`);

    // Cleanup: delete the test user
    await supabase.auth.admin.deleteUser(userId);
    console.log(`\nCleanup: Deleted test user ${userId}`);

  } catch (error) {
    console.error('Script encountered an error:', error);
  }
}

verify();
