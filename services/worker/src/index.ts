import { Queue, Worker } from 'bullmq';
import { loadEnv, QUEUE_NAMES } from '@lumora/config';
import {
  connectToDatabase,
  getPendingEmailNotifications,
  markNotificationEmailFailed,
  markNotificationEmailSent,
  sendViaConfiguredTransport,
} from '@lumora/domain';

/**
 * Background worker entrypoint (SAD §2, §4.5). Wires the notification queue
 * and drains queued in-app notifications to real email (SMTP/Mailpit locally,
 * Resend in cloud) via the shared transport. SMS is intentionally omitted per O-4.
 */

interface NotificationEmailJob {
  notificationId?: string;
}

function redisConnectionOptions(redisUrl: string) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}

async function dispatchPendingNotificationEmails(limit = 25): Promise<number> {
  const pending = await getPendingEmailNotifications(limit);
  let sent = 0;

  for (const notification of pending) {
    const user = notification.userId as unknown as { email: string; fullName: string };
    try {
      await sendViaConfiguredTransport({
        to: user.email,
        subject: notification.title,
        text: `${notification.body}\n\n${notification.actionUrl ?? ''}`.trim(),
        html: `<p>${escapeHtml(notification.body)}</p>${
          notification.actionUrl ? `<p><a href="${notification.actionUrl}">Open in Lumora</a></p>` : ''
        }`,
      });
      await markNotificationEmailSent(String(notification._id));
      sent++;
    } catch (err) {
      await markNotificationEmailFailed(String(notification._id), (err as Error).message);
    }
  }

  return sent;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function main(): Promise<void> {
  const env = loadEnv();
  await connectToDatabase();

  const connection = redisConnectionOptions(env.REDIS_URL);
  const queue = new Queue<NotificationEmailJob, { sent: number }, string>(QUEUE_NAMES.notifications, {
    connection,
  });
  const worker = new Worker<NotificationEmailJob, { sent: number }, string>(
    QUEUE_NAMES.notifications,
    async () => {
      const count = await dispatchPendingNotificationEmails();
      return { sent: count };
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`[lumora-worker] notification job ${job?.id ?? 'unknown'} failed`, err);
  });

  await queue.add(
    'flush-email-notifications',
    {},
    { repeat: { every: 60_000 }, removeOnComplete: 100, removeOnFail: 100 },
  );

  const sentAtBoot = await dispatchPendingNotificationEmails();
  console.log(
    `[lumora-worker] boot ok (env=${env.NODE_ENV}); notification queue active; sentAtBoot=${sentAtBoot}`,
  );

  const shutdown = async () => {
    await worker.close();
    await queue.close();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[lumora-worker] boot failed', err);
  process.exit(1);
});
