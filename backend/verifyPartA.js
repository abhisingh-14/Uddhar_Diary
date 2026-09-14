require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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
  let passRefresh = false;

  try {
    // Read credentials
    const passFile = fs.readFileSync(path.join(__dirname, '../frontend/doc/pass.txt'), 'utf-8');
    const emailMatch = passFile.match(/email:\s*(.+)/);
    const passMatch = passFile.match(/password:\s*(.+)/);
    const testEmail = emailMatch ? emailMatch[1].trim() : null;
    const testPassword = passMatch ? passMatch[1].trim() : null;

    if (!testEmail || !testPassword) {
      console.error('Could not extract email/password from pass.txt');
      return;
    }

    console.log(`Using credentials from pass.txt: ${testEmail}`);

    // Cleanup first if user already exists
    const { data: usersData } = await supabase.auth.admin.listUsers();
    const existingUser = usersData.users.find(u => u.email === testEmail);
    if (existingUser) {
      console.log(`User already exists, deleting first: ${existingUser.id}`);
      await supabase.auth.admin.deleteUser(existingUser.id);
      // Wait a moment for trigger cleanup (if any)
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`\n1. Creating user via admin API (signup): ${testEmail}`);
    const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        full_name: 'Test User From File'
      }
    });

    if (signUpError) {
      console.error('FAIL: Signup failed:', signUpError.message);
      return;
    }

    const userId = signUpData.user.id;
    console.log(`User signed up with ID: ${userId}`);

    console.log('\n--- 2. Checking if profiles row is created (Trigger) ---');
    // We wait a tiny bit to ensure the DB trigger finishes inserting
    await new Promise(r => setTimeout(r, 1000));
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profileData) {
      console.log('FAIL: Profile row not found for new user.', profileError);
    } else {
      console.log('PASS: Profile row exists.', profileData);
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
    // Ensure we are logged in (signup often auto-logs in if email confirm is off)
    // We will do an explicit login just to be sure.
    await supabaseClient.auth.signOut();
    const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    let token = null;
    let refreshToken = null;
    if (loginError || !loginData.session) {
      console.log('FAIL: Login failed.', loginError);
    } else {
      console.log('PASS: Login successful and returned a valid session.');
      passLogin = true;
      token = loginData.session.access_token;
      refreshToken = loginData.session.refresh_token;
    }

    console.log('\n--- 5. Checking login persists across refresh ---');
    if (refreshToken) {
      const { data: refreshData, error: refreshErr } = await supabaseClient.auth.refreshSession({ refresh_token: refreshToken });
      if (refreshErr || !refreshData.session) {
        console.log('FAIL: Refresh session failed.', refreshErr);
      } else {
        console.log('PASS: Session refreshed successfully.');
        passRefresh = true;
        token = refreshData.session.access_token; // use new token
      }
    } else {
      console.log('FAIL: No refresh token returned from login.');
    }

    if (!token) {
      console.log('Aborting further tests due to missing token.');
      return;
    }

    console.log('\n--- 6. Verifying Step 1-3 features with authenticated user ---');
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

      // Feature 2: Fetch categories
      const resCat = await fetch(`${BASE_URL}/api/categories`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!resCat.ok) {
        console.log('FAIL: Could not fetch categories', await resCat.text());
      } else {
        const catData = await resCat.json();
        const categoryId = catData.length > 0 ? catData[0].id : null;

        if (!categoryId) {
           console.log('FAIL: No categories found to create a bill with');
        } else {
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
          
          // Feature 4: Diary (Balances)
          const resBalances = await fetch(`${BASE_URL}/api/debts/balances`, {
             headers: { 'Authorization': `Bearer ${token}` }
          });

          // Feature 5: Expenses
          const resExpenses = await fetch(`${BASE_URL}/api/expenses/by-category?granularity=month`, {
             headers: { 'Authorization': `Bearer ${token}` }
          });

          if (!resBalances.ok || !resExpenses.ok) {
            console.log('FAIL: Could not fetch Diary or Expenses.');
            console.log('Balances:', await resBalances.text());
            console.log('Expenses:', await resExpenses.text());
          } else {
            const balData = await resBalances.json();
            const expData = await resExpenses.json();
            console.log('PASS: Successfully fetched Diary balances and Expenses.');
            console.log('Balances length:', balData.balances ? balData.balances.length : 'undefined');
            console.log('Expenses length:', expData.length);
            passFeatures = true;
          }
        }
      }
    }
    }

    console.log('\n--- FINAL SUMMARY ---');
    console.log(`Trigger creates profile: ${passTrigger ? 'PASS' : 'FAIL'}`);
    console.log(`Unauthenticated gets 401: ${passUnauth ? 'PASS' : 'FAIL'}`);
    console.log(`Login works and returns session: ${passLogin ? 'PASS' : 'FAIL'}`);
    console.log(`Login persists across refresh: ${passRefresh ? 'PASS' : 'FAIL'}`);
    console.log(`Features (Step 1-3) work for logged-in user: ${passFeatures ? 'PASS' : 'FAIL'}`);

    // Cleanup: delete the test user
    await supabase.auth.admin.deleteUser(userId);
    console.log(`\nCleanup: Deleted test user ${userId}`);

  } catch (error) {
    console.error('Script encountered an error:', error);
  }
}

verify();
