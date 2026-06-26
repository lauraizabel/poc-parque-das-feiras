import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaymentProvider } from "@prisma/client";
import {
  CreatePaymentIntentRequest,
  CreatePaymentIntentResult,
  PaymentGatewayAdapter
} from "./payment-gateway.types";

@Injectable()
export class StripeConnectPaymentGatewayAdapter implements PaymentGatewayAdapter {
  readonly provider = PaymentProvider.STRIPE_CONNECT;

  constructor(private readonly configService: ConfigService) {}

  async createPaymentIntent(
    input: CreatePaymentIntentRequest
  ): Promise<CreatePaymentIntentResult> {
    const secretKey = this.configService.get<string>("STRIPE_SECRET_KEY");
    const providerPaymentId = `pi_${randomUUID().replace(/-/g, "")}`;
    const clientSecret = `${providerPaymentId}_secret_${randomUUID().replace(/-/g, "")}`;
    const externalReference = `order_${input.orderId}`;

    // Until a real Stripe key is configured, keep the adapter contract stable with a
    // Stripe-shaped simulated response so the checkout flow stays testable end-to-end.
    if (!secretKey) {
      return {
        provider: this.provider,
        providerPaymentId,
        externalReference,
        clientSecret,
        checkoutUrl: null,
        status: "requires_payment_method",
        rawPayload: {
          id: providerPaymentId,
          object: "payment_intent",
          amount: input.amountCents,
          currency: input.currencyCode.toLowerCase(),
          client_secret: clientSecret,
          status: "requires_payment_method",
          metadata: {
            orderId: input.orderId,
            paymentId: input.paymentId,
            storeId: input.storeId,
            ...(input.metadata ?? {})
          },
          livemode: false
        }
      };
    }

    const body = new URLSearchParams({
      amount: input.amountCents.toString(),
      currency: input.currencyCode.toLowerCase(),
      "metadata[orderId]": input.orderId,
      "metadata[paymentId]": input.paymentId,
      "metadata[storeId]": input.storeId,
      description: `Order ${input.orderId}`,
      receipt_email: input.customerEmail
    });

    if (input.customerFullName) {
      body.set("metadata[customerName]", input.customerFullName);
    }

    for (const [key, value] of Object.entries(input.metadata ?? {})) {
      body.set(`metadata[${key}]`, value);
    }

    const response = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        authorization: `Bearer ${secretKey}`,
        "content-type": "application/x-www-form-urlencoded"
      },
      body
    });

    const rawPayload = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      throw new Error(
        typeof rawPayload.error === "object" && rawPayload.error !== null
          ? String((rawPayload.error as { message?: string }).message ?? "Stripe request failed")
          : "Stripe request failed"
      );
    }

    return {
      provider: this.provider,
      providerPaymentId: String(rawPayload.id),
      externalReference,
      clientSecret: String(rawPayload.client_secret ?? ""),
      checkoutUrl: null,
      status: String(rawPayload.status ?? "requires_payment_method") as CreatePaymentIntentResult["status"],
      rawPayload
    };
  }
}
