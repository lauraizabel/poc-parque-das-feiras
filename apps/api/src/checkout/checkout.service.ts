import { Injectable } from "@nestjs/common";
import { CheckoutRepository } from "./checkout.repository";

@Injectable()
export class CheckoutService {
  constructor(private readonly checkoutRepository: CheckoutRepository) {}

  getBoundary() {
    return this.checkoutRepository.getBoundary();
  }
}
