import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from "@nestjs/common";
import { StoreMemberRole } from "@prisma/client";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StoreAccess } from "../auth/store-access.decorator";
import { StoreRoles } from "../auth/store-roles.decorator";
import { AuthenticatedRequest } from "../auth/auth.types";
import { DomainsService } from "./domains.service";
import { createStoreDomainSchema, parseDomainBody } from "./domains.schemas";

@Controller("domains")
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Get("boundary")
  getBoundary() {
    return this.domainsService.getBoundary();
  }

  @Get("resolve")
  resolve(
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined
  ) {
    return this.domainsService.resolveHost({
      headers: {
        host,
        "x-forwarded-host": forwardedHost
      }
    });
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Get(":storeId")
  getStoreDomain(@Param("storeId") storeId: string) {
    return this.domainsService.getStoreDomain(storeId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Post()
  createStoreDomain(@Req() _request: AuthenticatedRequest, @Body() body: unknown) {
    return this.domainsService.createStoreDomain(
      parseDomainBody(createStoreDomainSchema, body)
    );
  }
}
