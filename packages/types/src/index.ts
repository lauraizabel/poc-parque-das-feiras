export type PaymentProvider = "stripe-connect" | "pagarme" | "mercado-pago" | "asaas";

export type EmailProvider = "resend" | "sendgrid" | "aws-ses";

export type StorageProvider = "s3" | "r2";

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  status: "active" | "trialing" | "past_due" | "suspended";
}
