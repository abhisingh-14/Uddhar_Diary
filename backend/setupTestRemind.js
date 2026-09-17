require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6ZnZycWZzcWNteXh5YWhvcmJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MjkzMzEsImV4cCI6MjEwMjIwNTMzMX0.tYbPDSNAV_BwlJ9OzcxCby8o0dKvIf5ZQxS-yoYDb0A';
const supabaseClient = createClient(process.env.SUPABASE_URL, anonKey);
const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;

async function run() {
  const passFile = fs.readFileSync(path.join(__dirname, '../frontend/doc/pass.txt'), 'utf-8');
  const emailMatch = passFile.match(/email:\s*(.+)/);
  const passMatch = passFile.match(/password:\s*(.+)/);
  const testEmail = emailMatch ? emailMatch[1].trim() : null;
  const testPassword = passMatch ? passMatch[1].trim() : null;

  // Login
  const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (loginError) {
    console.error('Login error', loginError);
    return;
  }
  const token = loginData.session.access_token;
  
  // Person A (email + positive balance)
  const resA = await fetch(`${BASE_URL}/api/people`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ name: 'Person A', email: 'test_a@example.com' }) });
  const personA = await resA.json();

  // Person B (no email)
  const resB = await fetch(`${BASE_URL}/api/people`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ name: 'Person B' }) });
  const personB = await resB.json();

  // Person C (email + zero balance)
  const resC = await fetch(`${BASE_URL}/api/people`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ name: 'Person C', email: 'test_c@example.com' }) });
  const personC = await resC.json();

  // Person D (email + negative balance)
  const resD = await fetch(`${BASE_URL}/api/people`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ name: 'Person D', email: 'test_d@example.com' }) });
  const personD = await resD.json();

  // Get a category
  const resCat = await fetch(`${BASE_URL}/api/categories`, { headers: { 'Authorization': `Bearer ${token}` } });
  const catData = await resCat.json();
  const categoryId = catData.length > 0 ? catData[0].id : null;

  if (categoryId) {
    // Bill for Person A (Owes 100) -> Person A paid 0, Total 100, we paid 100.
    // Wait, if we paid 100 and Person A paid 0, Person A owes us their share. Let's make items and people such that Person A owes us.
    // Total: 200, We paid 200, Person A's share is 200. Person A owes 200.
    await fetch(`${BASE_URL}/api/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        storagePath: 'test-a', merchantName: 'Merchant A', total: 200, categoryId: categoryId, billDate: '2026-01-01',
        items: [{ name: 'Item A', price: 200, quantity: 1, people: [personA.id] }],
        people: [{ personId: personA.id, amountPaid: 0 }]
      })
    });

    // Bill for Person D (We owe them 100) -> Total: 200. Person D paid 200. Our share is 200.
    // Our share is automatically determined if we are in items. Actually the backend logic for split bill:
    // Items without people are split equally? Let's just create a generic debt for Person D if that's easier.
    // But we don't have a POST /api/debts directly for arbitrary balances. We must create a bill.
    // If Person D paid 200, and they are not in items, their share is 0. So they paid 200, owe 0 -> we owe them 200.
    await fetch(`${BASE_URL}/api/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        storagePath: 'test-d', merchantName: 'Merchant D', total: 200, categoryId: categoryId, billDate: '2026-01-01',
        items: [{ name: 'Item D', price: 200, quantity: 1, people: [] }], // implicit split with us? Or just us?
        people: [{ personId: personD.id, amountPaid: 200 }]
      })
    });
  }

  console.log(`ACCESS_TOKEN=${token}`);
  console.log(`PERSON_A=${personA.id}`);
  console.log(`PERSON_B=${personB.id}`);
  console.log(`PERSON_C=${personC.id}`);
  console.log(`PERSON_D=${personD.id}`);
}
run();
