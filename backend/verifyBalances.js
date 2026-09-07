import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const CURRENT_USER_ID = '999af4e5-6e7b-4512-9202-95c1a29dfff0';

async function verify() {
  let { data: initialBalances } = await supabase
    .from('person_balances')
    .select('*')
    .eq('user_id', CURRENT_USER_ID);
    
  if (initialBalances.length > 0) {
    const personToZero = initialBalances.find(b => b.net_balance_paise > 0);
    if (!personToZero) return console.log('No person to zero out.');
    
    console.log(`Will zero out balance for ${personToZero.name} (ID: ${personToZero.person_id})`);
    
    // Attempt to update both amount and amount_paise, also amount_paid_paise and status just in case.
    const res = await supabase
      .from('debts')
      .update({ amount_paise: 0, amount_paid_paise: 0 })
      .eq('person_id', personToZero.person_id);
      
    console.log('Update result:', res);
      
    const { data: finalBalances } = await supabase
      .from('person_balances')
      .select('*')
      .eq('user_id', CURRENT_USER_ID);
      
    console.log('\nRemaining people in view:', finalBalances.map(b => `${b.name}: ${b.net_balance_paise}`));
  }
}
verify();
