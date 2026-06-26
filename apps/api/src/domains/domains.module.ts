import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConfigModule } from "@nestjs/config";
import { DomainsController } from "./domains.controller";
import { DomainsRepository } from "./domains.repository";
import { DomainsService } from "./domains.service";

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [DomainsController],
  providers: [DomainsService, DomainsRepository],
  exports: [DomainsService, DomainsRepository]
})
export class DomainsModule {}
