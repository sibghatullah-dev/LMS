import type { EmailPort } from '@lumora/domain';
import { sendViaConfiguredTransport } from '@lumora/domain';

/**
 * Email adapter for auth flows (verification links, password reset) — these
 * need to go out immediately rather than through the queued notification
 * pipeline. Delivers via SMTP locally (Mailpit at http://localhost:8025) or
 * Resend in cloud, per `EMAIL_TRANSPORT` (O-4: email-only, no SMS).
 */
const transportEmailPort: EmailPort = {
  send: sendViaConfiguredTransport,
};

export function getEmailPort(): EmailPort {
  return transportEmailPort;
}
