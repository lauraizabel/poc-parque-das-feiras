import { Injectable } from "@nestjs/common";
import { DomainBoundary } from "../platform/domain-boundary";

@Injectable()
export class CatalogRepository {
  getBoundary(): DomainBoundary {
    return {
      module: "catalog",
      description: "Products, categories, inventory-facing metadata and media references.",
      responsibilities: ["products", "categories", "pricing snapshots", "catalog media links"],
      dependsOn: ["database", "stores"]
    };
  }
}
