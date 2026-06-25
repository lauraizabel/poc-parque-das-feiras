import { Module } from "@nestjs/common";
import { DomainsController } from "./domains.controller";
import { DomainsRepository } from "./domains.repository";
import { DomainsService } from "./domains.service";

@Module({
  controllers: [DomainsController],
  providers: [DomainsService, DomainsRepository],
  exports: [DomainsService, DomainsRepository]
})
export class DomainsModule {}
