import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { PublicStorefrontRequest } from "../auth/auth.types";
import { PaymentsService } from "./payments.service";
import {
  createOrderPaymentIntentSchema,
  parsePaymentsBody
} from "./payments.schemas";

type WebhookRequest = {
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  rawBody?: Buffer;
};

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get("boundary")
  getBoundary() {
    return this.paymentsService.getBoundary();
  }

  @Post("public/orders/:orderId/intent")
  createOrderIntent(
    @Req() request: PublicStorefrontRequest,
    @Param("orderId") orderId: string,
    @Body() body: unknown
  ) {
    return this.paymentsService.createOrderPaymentIntent(
      request.publicStore!,
      orderId,
      parsePaymentsBody(createOrderPaymentIntentSchema, body)
    );
  }

  @Post("webhooks/stripe")
  receiveStripeWebhook(@Req() request: WebhookRequest & { get(name: string): string | undefined }) {
    return this.paymentsService.receiveStripeWebhook({
      body: request.body,
      rawBody: request.rawBody,
      signature: request.get("stripe-signature"),
      userAgent: request.get("user-agent"),
      sourceIp: request.ip,
      headers: request.headers
    });
  }
}
