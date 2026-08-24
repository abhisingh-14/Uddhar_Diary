require('dotenv').config();
const { supabase } = require('./src/lib/supabaseClient');

async function test() {
  const userId = '999af4e5-6e7b-4512-9202-95c1a29dfff0';
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId);

  console.log('Profiles:', data, error);
}
test();
