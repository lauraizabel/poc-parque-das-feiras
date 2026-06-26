import { Injectable } from "@nestjs/common";
import { CartRepository } from "./cart.repository";

@Injectable()
export class CartService {
  constructor(private readonly cartRepository: CartRepository) {}

  getBoundary() {
    return this.cartRepository.getBoundary();
  }

  getCurrentPublicContext(storeId: string) {
    return {
      storeId
    };
  }
}
