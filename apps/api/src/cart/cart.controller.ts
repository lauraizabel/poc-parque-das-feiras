import { Controller, Get } from "@nestjs/common";
import { CartService } from "./cart.service";

@Controller("cart")
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get("boundary")
  getBoundary() {
    return this.cartService.getBoundary();
  }
}
