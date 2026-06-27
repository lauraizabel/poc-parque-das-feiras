import { createQueue, createWorker, getQueueMonitoringSnapshot } from "@acme/queue";

export const PAYMENT_WEBHOOK_QUEUE = "payment-webhook-processing";

export type PaymentWebhookJob = {
  webhookEventId: string;
};

export function createPaymentWebhookQueue() {
  return createQueue(PAYMENT_WEBHOOK_QUEUE, "payment-webhook-processing");
}

export function createPaymentWebhookWorker(
  processor: (job: { data: PaymentWebhookJob; id?: string }) => Promise<unknown>
) {
  return createWorker<PaymentWebhookJob>(
    PAYMENT_WEBHOOK_QUEUE,
    processor,
    "payment-webhook-processing"
  );
}

export function getPaymentQueueMonitoring() {
  return getQueueMonitoringSnapshot(
    PAYMENT_WEBHOOK_QUEUE,
    "payment-webhook-processing"
  );
}
