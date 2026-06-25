import { Injectable } from "@nestjs/common";
import { CatalogRepository } from "./catalog.repository";

@Injectable()
export class CatalogService {
  constructor(private readonly catalogRepository: CatalogRepository) {}

  getBoundary() {
    return this.catalogRepository.getBoundary();
  }
}
