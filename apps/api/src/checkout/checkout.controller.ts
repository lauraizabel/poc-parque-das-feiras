import { Controller, Get, Req } from "@nestjs/common";
import { PublicStorefrontRequest } from "../auth/auth.types";
import { CheckoutService } from "./checkout.service";

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
}
