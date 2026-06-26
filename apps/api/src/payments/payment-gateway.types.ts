import { PaymentProvider } from "@prisma/client";

export type CreatePaymentIntentRequest = {
  provider: PaymentProvider;
  storeId: string;
  orderId: string;
  paymentId: string;
  amountCents: number;
  currencyCode: string;
  customerEmail: string;
  customerFullName?: string | null;
  metadata?: Record<string, string>;
};

export type CreatePaymentIntentResult = {
  provider: PaymentProvider;
  providerPaymentId: string;
  externalReference: string;
  clientSecret: string;
  checkoutUrl?: string | null;
  status: "requires_payment_method" | "requires_confirmation" | "processing";
  rawPayload: Record<string, unknown>;
};

export type PaymentGatewayAdapter = {
  provider: PaymentProvider;
  createPaymentIntent(input: CreatePaymentIntentRequest): Promise<CreatePaymentIntentResult>;
};
