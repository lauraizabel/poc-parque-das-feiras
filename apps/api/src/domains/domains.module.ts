import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { ConfigModule } from "@nestjs/config";
import { DomainsController } from "./domains.controller";
import { DomainsDnsService } from "./domains-dns.service";
import { DomainsSslService } from "./domains-ssl.service";
import { DomainsRepository } from "./domains.repository";
import { DomainsService } from "./domains.service";

@Module({
  imports: [ConfigModule, AuditModule, AuthModule],
  controllers: [DomainsController],
  providers: [DomainsService, DomainsRepository, DomainsDnsService, DomainsSslService],
  exports: [DomainsService, DomainsRepository]
})
export class DomainsModule {}
