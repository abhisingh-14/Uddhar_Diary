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

  // Login first
  let token = null;
  const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (!loginError && loginData.session) {
    token = loginData.session.access_token;
  } else {
    // If login failed, try signup
    const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Test Patch User' }
    });

    if (signUpError) {
      console.error('FAIL: Signup failed:', signUpError.message);
      return;
    }
    
    await new Promise(r => setTimeout(r, 1000));
    
    const { data: loginData2, error: loginError2 } = await supabaseClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    
    if (loginError2) {
      console.error('Login error after signup', loginError2);
      return;
    }
    token = loginData2.session.access_token;
  }
  
  // Create a person
  const resPerson = await fetch(`${BASE_URL}/api/people`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name: 'Patch Test Person' })
  });
  
  const personData = await resPerson.json();
  const personId = personData.id;

  console.log(`ACCESS_TOKEN=${token}`);
  console.log(`PERSON_ID=${personId}`);
  console.log(`PORT=${PORT}`);
}
run();
