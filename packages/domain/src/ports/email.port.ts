/**
 * Email port (hexagonal seam). Phase 1 needs to deliver verification and
 * password-reset links, but the full multichannel dispatch pipeline is Phase 7.
 * Services depend on this interface; the concrete adapter (console in dev, SMTP
 * via Mailpit locally, Resend in cloud — O-4) is injected by the caller.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailPort {
  send(message: EmailMessage): Promise<void>;
}

/** Fallback adapter used in tests and when no transport is configured. */
export const noopEmailPort: EmailPort = {
  async send() {
    /* intentionally does nothing */
  },
};
