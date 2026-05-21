const nodemailer = require("nodemailer");
const { env } = require("../config/env");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!env.mailerUser || !env.mailerPassword) return null;
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: env.mailerUser,
      pass: env.mailerPassword,
    },
  });
  return transporter;
}

async function sendEmail({ to, subject, html }) {
  const mailer = getTransporter();
  if (!mailer) {
    console.warn("Mailer not configured, skipping email.");
    return;
  }
  await mailer.sendMail({
    from: env.mailerUser,
    to,
    subject,
    html,
  });
}

async function sendVerificationEmail({ to, link }) {
  await sendEmail({
    to,
    subject: "Xac thuc tai khoan TournaStream",
    html: `<p>Vui long xac thuc email cua ban.</p><p><a href="${link}">Xac thuc tai khoan</a></p>`,
  });
}

async function sendResetPasswordEmail({ to, link }) {
  await sendEmail({
    to,
    subject: "Dat lai mat khau TournaStream",
    html: `<p>Ban vua yeu cau dat lai mat khau.</p><p><a href="${link}">Dat lai mat khau</a></p>`,
  });
}

module.exports = { sendVerificationEmail, sendResetPasswordEmail };
