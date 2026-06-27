import { createQueue, createWorker, getQueueMonitoringSnapshot } from "@acme/queue";

export const EMAIL_NOTIFICATION_QUEUE = "notifications-email";

export type EmailNotificationJob = {
  to: string;
  subject: string;
  templateKey: string;
  variables?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export function createEmailNotificationQueue() {
  return createQueue(EMAIL_NOTIFICATION_QUEUE, "notifications-email");
}

export function createEmailNotificationWorker(
  processor: (job: { data: EmailNotificationJob; id?: string }) => Promise<unknown>
) {
  return createWorker<EmailNotificationJob>(
    EMAIL_NOTIFICATION_QUEUE,
    processor,
    "notifications-email"
  );
}

export function getEmailNotificationQueueMonitoring() {
  return getQueueMonitoringSnapshot(EMAIL_NOTIFICATION_QUEUE, "notifications-email");
}
