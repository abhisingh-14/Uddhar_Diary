require('dotenv').config();
const { supabase } = require('./src/lib/supabaseClient');

async function test() {
  const userId = '54c0d586-58ca-4402-88de-da030b96b270';
  const personId = '6263291e-29e9-483f-b41c-eb6b134ae869'; // Aditya
  
  const payload = {
    p_user_id: userId,
    p_image_url: '54c0d586-58ca-4402-88de-da030b96b270/1787589268165-sample.png',
    p_merchant_name: 'Test Merchant',
    p_total_amount: 101.04,
    p_category_id: 'eba7fe7e-4bf7-42a9-8efe-88f77f9d1e7b', // Food
    p_bill_date: '2026-08-24',
    p_items: [{ name: 'Item 1', price: 101.04, quantity: 1 }],
    p_split_entries: [
      {
        personId: personId,
        owedAmount: 33.68,
        direction: 'they_owe_you'
      }
    ],
    p_user_share_paise: 3368, // User's share in paise (33.68 * 100)
    p_source: 'photo'
  };

  const { data, error } = await supabase.rpc('create_bill_with_split', payload);

  console.log('RPC result:', data);
  if (error) {
    console.error('RPC error:', error);
  }
}
test();
