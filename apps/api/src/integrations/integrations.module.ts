import { Module } from "@nestjs/common";
import { IntegrationsController } from "./integrations.controller";
import { IntegrationCatalogService } from "./integrations.service";

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationCatalogService]
})
export class IntegrationsModule {}
