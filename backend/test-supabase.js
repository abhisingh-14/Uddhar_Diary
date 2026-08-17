require('dotenv').config();
const { supabase } = require('./src/lib/supabaseClient');

async function test() {
  const { data, error } = await supabase.from('categories').select('id, name');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Data:', data);
  }
}

test();
