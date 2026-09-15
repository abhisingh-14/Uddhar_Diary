require('dotenv').config();

const { sendReminderEmail } = require('./src/services/emailService');

async function runTest() {
  const toEmail = process.env.TEST_EMAIL_RECIPIENT;
  
  if (!toEmail || toEmail === 'your-registered-email@example.com') {
    console.error('Error: Please set TEST_EMAIL_RECIPIENT in backend/.env to a valid email address.');
    process.exit(1);
  }

  const personName = 'Test Person';
  const amountPaise = 150000; // ₹1,500.00

  console.log(`Testing sendReminderEmail...`);
  console.log(`To: ${toEmail}`);
  console.log(`Name: ${personName}`);
  console.log(`Amount (paise): ${amountPaise}`);
  console.log('----------------------------------------');

  try {
    const result = await sendReminderEmail({ toEmail, personName, amountPaise });
    
    if (result.success) {
      console.log('✅ Email service returned SUCCESS:');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    } else {
      console.error('❌ Email service returned FAILURE:');
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }
  } catch (err) {
    console.error('💥 UNEXPECTED EXCEPTION (sendReminderEmail should catch its own errors):');
    console.error(err);
    process.exit(1);
  }
}

runTest();
