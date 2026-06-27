import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { PublicStorefrontRequest } from "../auth/auth.types";
import { CheckoutService } from "./checkout.service";
import {
  calculateShippingOptionsSchema,
  createOrderFromCartSchema,
  parseCheckoutBody
} from "./checkout.schemas";

@Controller("checkout")
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Get("boundary")
  getBoundary() {
    return this.checkoutService.getBoundary();
  }

  @Get("public/context")
  getPublicContext(@Req() request: PublicStorefrontRequest) {
    return {
      store: request.publicStore ?? null
    };
  }

  @Post("public/current/shipping-options")
  calculateShippingOptions(@Req() request: PublicStorefrontRequest, @Body() body: unknown) {
    return this.checkoutService.calculateShippingOptions(
      request.publicStore!,
      parseCheckoutBody(calculateShippingOptionsSchema, body)
    );
  }

  @Post("public/current/order")
  createOrder(@Req() request: PublicStorefrontRequest, @Body() body: unknown) {
    return this.checkoutService.createOrderFromCart(
      request.publicStore!,
      parseCheckoutBody(createOrderFromCartSchema, body)
    );
  }
}
