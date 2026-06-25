import { Injectable } from "@nestjs/common";
import { DomainsRepository } from "./domains.repository";

@Injectable()
export class DomainsService {
  constructor(private readonly domainsRepository: DomainsRepository) {}

  getBoundary() {
    return this.domainsRepository.getBoundary();
  }
}
