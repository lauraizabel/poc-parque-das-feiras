import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BaselinkerClient } from "./baselinker.client";
import { BaselinkerRepository } from "./baselinker.repository";
import { BaselinkerOrderSyncService } from "./baselinker-order-sync.service";
import { BaselinkerCatalogSyncService } from "./baselinker-catalog-sync.service";
import { BaselinkerShippingService } from "./baselinker-shipping.service";
import { BaselinkerService } from "./baselinker.service";
import { BaselinkerController } from "./baselinker.controller";

@Module({
  imports: [AuthModule],
  controllers: [BaselinkerController],
  providers: [
    BaselinkerClient,
    BaselinkerRepository,
    BaselinkerOrderSyncService,
    BaselinkerCatalogSyncService,
    BaselinkerShippingService,
    BaselinkerService
  ],
  exports: [BaselinkerService, BaselinkerOrderSyncService, BaselinkerCatalogSyncService]
})
export class BaselinkerModule {}
