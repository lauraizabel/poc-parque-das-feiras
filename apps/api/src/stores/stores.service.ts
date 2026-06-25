import { Injectable } from "@nestjs/common";
import { StoresRepository } from "./stores.repository";

@Injectable()
export class StoresService {
  constructor(private readonly storesRepository: StoresRepository) {}

  getBoundary() {
    return this.storesRepository.getBoundary();
  }
}
