import { Injectable } from "@nestjs/common";
import { PaymentsRepository } from "./payments.repository";

@Injectable()
export class PaymentsService {
  constructor(private readonly paymentsRepository: PaymentsRepository) {}

  getBoundary() {
    return this.paymentsRepository.getBoundary();
  }
}
