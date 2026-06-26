import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DomainsController } from "./domains.controller";
import { DomainsRepository } from "./domains.repository";
import { DomainsService } from "./domains.service";

@Module({
  imports: [ConfigModule],
  controllers: [DomainsController],
  providers: [DomainsService, DomainsRepository],
  exports: [DomainsService, DomainsRepository]
})
export class DomainsModule {}
