import { Injectable } from "@nestjs/common";

@Injectable()
export class IntegrationCatalogService {
  list() {
    return {
      payments: ["stripe-connect", "pagarme", "mercado-pago", "asaas"],
      email: ["resend", "sendgrid", "aws-ses"],
      storage: ["s3", "r2"],
      domains: ["cloudflare-for-saas", "vercel-platforms"]
    };
  }
}
