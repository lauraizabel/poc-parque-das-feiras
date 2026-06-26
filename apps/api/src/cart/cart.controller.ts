import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req
} from "@nestjs/common";
import { PublicStorefrontRequest } from "../auth/auth.types";
import { CartService } from "./cart.service";
import {
  addCartItemSchema,
  clearCartSchema,
  parseCartBody,
  resolveCartSchema,
  updateCartItemSchema
} from "./cart.schemas";

@Controller("cart")
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get("boundary")
  getBoundary() {
    return this.cartService.getBoundary();
  }

  @Get("public/context")
  getPublicContext(@Req() request: PublicStorefrontRequest, @Body() body: unknown) {
    return this.cartService.getCurrentPublicContext(
      request.publicStore!,
      parseCartBody(resolveCartSchema, body ?? {})
    );
  }

  @Post("public/current")
  createCart(@Req() request: PublicStorefrontRequest, @Body() body: unknown) {
    return this.cartService.createCart(
      request.publicStore!,
      parseCartBody(resolveCartSchema, body)
    );
  }

  @Post("public/current/items")
  addItem(@Req() request: PublicStorefrontRequest, @Body() body: unknown) {
    return this.cartService.addItem(
      request.publicStore!,
      parseCartBody(addCartItemSchema, body)
    );
  }

  @Patch("public/current/items/:cartItemId")
  updateItem(
    @Req() request: PublicStorefrontRequest,
    @Param("cartItemId") cartItemId: string,
    @Body() body: unknown
  ) {
    return this.cartService.updateItem(
      request.publicStore!,
      cartItemId,
      parseCartBody(updateCartItemSchema, body)
    );
  }

  @Delete("public/current/items/:cartItemId")
  removeItem(
    @Req() request: PublicStorefrontRequest,
    @Param("cartItemId") cartItemId: string,
    @Body() body: unknown
  ) {
    return this.cartService.removeItem(
      request.publicStore!,
      cartItemId,
      parseCartBody(resolveCartSchema, body)
    );
  }

  @Post("public/current/clear")
  clear(@Req() request: PublicStorefrontRequest, @Body() body: unknown) {
    return this.cartService.clear(
      request.publicStore!,
      parseCartBody(clearCartSchema, body)
    );
  }
}
