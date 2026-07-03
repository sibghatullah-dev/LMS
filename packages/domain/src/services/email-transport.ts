import nodemailer from 'nodemailer';
import { loadEnv } from '@lumora/config';
import type { EmailMessage } from '../ports/email.port';

/**
 * Shared email transport (SAD §5.3): SMTP (Mailpit locally) or Resend (cloud),
 * selected by `EMAIL_TRANSPORT`. Both the synchronous auth-email send path
 * (verification/reset links, apps/web/src/server/email.ts) and the worker's
 * queued-notification drain job (services/worker/src/index.ts) call this same
 * function, instead of each re-implementing transport selection.
 */
let smtpTransport: nodemailer.Transporter | null = null;

function getSmtpTransport(): nodemailer.Transporter {
  if (smtpTransport) return smtpTransport;
  const env = loadEnv();
  smtpTransport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false, // Mailpit and most local/dev SMTP relays don't use TLS
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return smtpTransport;
}

export async function sendViaConfiguredTransport(message: EmailMessage): Promise<void> {
  const env = loadEnv();

  if (env.EMAIL_TRANSPORT === 'resend' && env.RESEND_API_KEY) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!response.ok) throw new Error(`Resend failed with ${response.status}`);
    return;
  }

  // SMTP (local: Mailpit at localhost:1025, viewable at http://localhost:8025).
  await getSmtpTransport().sendMail({
    from: env.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}
