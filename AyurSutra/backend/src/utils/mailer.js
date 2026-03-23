import nodemailer from 'nodemailer';

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendEmail({ to, subject, text, html }) {
  const transport = getTransport();
  if (!transport) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('SMTP not configured; skipping email send:', { to, subject });
      return { skipped: true };
    }
    throw new Error('SMTP is not configured');
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  return transport.sendMail({ from, to, subject, text, html });
}

