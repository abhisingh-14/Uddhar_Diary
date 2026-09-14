const { Resend } = require("resend");

/**
 * Formats amount in paise to Indian Rupee string with proper formatting.
 * Example: 1000 -> "₹10.00", 100000 -> "₹1,000.00"
 */
function formatPaiseToRupees(amountPaise) {
  const rupees = amountPaise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Sends a reminder email via Resend API.
 * 
 * Returns { success: true } on success, or { success: false, error: '...' } on failure.
 * 
 * Note: A failed email send is a delivery problem, not a request problem. The calling
 * route should still respond cleanly to the client (e.g., "reminder queued but email failed")
 * rather than throwing a 500. The route decides what status/message to return based on
 * this result.
 */
async function sendReminderEmail({ toEmail, personName, amountPaise }) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return { success: false, error: "Missing RESEND_API_KEY environment variable" };
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL;
    if (!fromEmail) {
      return { success: false, error: "Missing RESEND_FROM_EMAIL environment variable" };
    }

    const resend = new Resend(apiKey);
    const amount = formatPaiseToRupees(amountPaise);

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Reminder: you owe ${amount}`,
      html: `
        <p>Hi ${personName},</p>
        <p>This is a friendly reminder that you currently owe <strong>${amount}</strong>.</p>
        <p>Please settle this amount at your earliest convenience.</p>
        <p>Thanks!</p>
      `,
    });

    if (error) {
      return { success: false, error: error.message || "Failed to send email via Resend" };
    }

    return { success: true, data };
  } catch (err) {
    // Network errors and other exceptions are caught here and returned as failures
    // rather than throwing up to the caller
    return { success: false, error: err.message || "Unexpected error sending email" };
  }
}

module.exports = { sendReminderEmail };
