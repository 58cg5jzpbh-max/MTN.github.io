const nodemailer = require('nodemailer');

function buildTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE) === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendWithdrawalEmail(adminEmail, details) {
  const transporter = buildTransport();
  const { userEmail, phone, amountMb, requestedAt } = details;
  await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to: adminEmail,
    subject: `New MTN data withdrawal request - ${amountMb}MB`,
    text: `New withdrawal request:
User email: ${userEmail}
Phone number to receive data: ${phone}
Network: MTN
Amount: ${amountMb} MB
Requested at: ${new Date(requestedAt).toLocaleString()}

Please send ${amountMb}MB of MTN data to ${phone} and mark this request as paid.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#f7a600">New Withdrawal Request</h2>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:6px 0;color:#666">User email</td><td style="padding:6px 0;font-weight:700">${userEmail}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Phone number</td><td style="padding:6px 0;font-weight:700">${phone}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Network</td><td style="padding:6px 0;font-weight:700">MTN</td></tr>
          <tr><td style="padding:6px 0;color:#666">Amount</td><td style="padding:6px 0;font-weight:700">${amountMb} MB</td></tr>
          <tr><td style="padding:6px 0;color:#666">Requested at</td><td style="padding:6px 0">${new Date(requestedAt).toLocaleString()}</td></tr>
        </table>
        <p style="margin-top:16px">Please send <strong>${amountMb}MB</strong> of MTN data to <strong>${phone}</strong> and mark this as paid.</p>
      </div>
    `,
  });
}

module.exports = { sendWithdrawalEmail };