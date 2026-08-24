require('dotenv').config();
const { supabase } = require('./src/lib/supabaseClient');

async function test() {
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .limit(1);

  console.log('Debts:', data, error);
}
test();
