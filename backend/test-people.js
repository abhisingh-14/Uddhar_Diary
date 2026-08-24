require('dotenv').config();
const { supabase } = require('./src/lib/supabaseClient');

async function test() {
  const userId = '999af4e5-6e7b-4512-9202-95c1a29dfff0';
  const { data, error } = await supabase
    .from('people')
    .select('id, name, email')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching people:', error);
  } else {
    console.log('People:', data);
  }
}

test();
