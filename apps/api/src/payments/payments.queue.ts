import { createQueue, createWorker } from "@acme/queue";

export const PAYMENT_WEBHOOK_QUEUE = "payment-webhook-processing";

export type PaymentWebhookJob = {
  webhookEventId: string;
};

export function createPaymentWebhookQueue() {
  return createQueue(PAYMENT_WEBHOOK_QUEUE);
}

export function createPaymentWebhookWorker(
  processor: (job: { data: PaymentWebhookJob; id?: string }) => Promise<unknown>
) {
  return createWorker<PaymentWebhookJob>(PAYMENT_WEBHOOK_QUEUE, processor);
}
