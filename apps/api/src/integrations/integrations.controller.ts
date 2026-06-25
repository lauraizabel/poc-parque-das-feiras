import { Controller, Get } from "@nestjs/common";
import { IntegrationCatalogService } from "./integrations.service";

@Controller("integrations")
export class IntegrationsController {
  constructor(private readonly integrationCatalog: IntegrationCatalogService) {}

  @Get()
  list() {
    return this.integrationCatalog.list();
  }
}
