export type PaymentProvider = "stripe-connect" | "pagarme" | "mercado-pago" | "asaas";

export type EmailProvider = "resend" | "sendgrid" | "aws-ses";

export type StorageProvider = "s3" | "r2";

export type PlatformRole = "PLATFORM_ADMIN" | "CUSTOMER";

export type StoreMemberRole = "STORE_OWNER" | "STORE_MANAGER" | "STORE_SUPPORT";

export interface StoreSummary {
  id: string;
  name: string;
  slug: string;
  status: "active" | "trialing" | "past_due" | "suspended";
}
