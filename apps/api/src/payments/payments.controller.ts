import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { PublicStorefrontRequest } from "../auth/auth.types";
import { PaymentsService } from "./payments.service";
import {
  createOrderPaymentIntentSchema,
  parsePaymentsBody
} from "./payments.schemas";

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
}
