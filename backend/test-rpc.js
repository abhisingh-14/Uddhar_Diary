require('dotenv').config();
const { supabase } = require('./src/lib/supabaseClient');

async function test() {
  const userId = '999af4e5-6e7b-4512-9202-95c1a29dfff0';
  const personId = '299e404d-7648-4fbf-b42a-45748c3bc9ce'; // Aditya
  
  const payload = {
    p_user_id: userId,
    p_image_url: '999af4e5-6e7b-4512-9202-95c1a29dfff0/1787589268165-sample.png',
    p_merchant_name: 'Test Merchant',
    p_total_amount: 10104,
    p_category_id: 'eba7fe7e-4bf7-42a9-8efe-88f77f9d1e7b', // Food
    p_bill_date: '2026-08-24',
    p_items: [{ name: 'Item 1', price: 10104, quantity: 1 }],
    p_split_entries: [
      {
        personId: personId,
        owedAmount: 3368,
        direction: 'they_owe_you'
      }
    ]
  };

  const { data, error } = await supabase.rpc('create_bill_with_split', payload);

  console.log('RPC result:', data);
  if (error) {
    console.error('RPC error:', error);
  }
}
test();
