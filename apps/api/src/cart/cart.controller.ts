import { Controller, Get, Req } from "@nestjs/common";
import { PublicStorefrontRequest } from "../auth/auth.types";
import { CartService } from "./cart.service";

@Controller("cart")
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get("boundary")
  getBoundary() {
    return this.cartService.getBoundary();
  }

  @Get("public/context")
  getPublicContext(@Req() request: PublicStorefrontRequest) {
    return {
      store: request.publicStore ?? null,
      cart: request.publicStore
        ? this.cartService.getCurrentPublicContext(request.publicStore.storeId)
        : null
    };
  }
}
