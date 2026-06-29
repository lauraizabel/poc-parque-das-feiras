import { Body, Controller, Delete, Get, Headers, Param, Post, Req, UseGuards } from "@nestjs/common";
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
  createStoreDomain(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.domainsService.createStoreDomain(
      {
        id: request.user.sub,
        email: request.user.email,
        fullName: null,
        platformRole: request.user.platformRole
      },
      parseDomainBody(createStoreDomainSchema, body)
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Post(":storeId/verify-dns")
  verifyStoreDomainDns(@Param("storeId") storeId: string) {
    return this.domainsService.verifyStoreDomainDns(storeId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Post(":storeId/sync-ssl")
  syncStoreDomainSsl(@Param("storeId") storeId: string) {
    return this.domainsService.syncStoreDomainSsl(storeId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Delete(":storeId")
  removeStoreDomain(@Req() request: AuthenticatedRequest, @Param("storeId") storeId: string) {
    return this.domainsService.removeStoreDomain(
      {
        id: request.user.sub,
        email: request.user.email,
        fullName: null,
        platformRole: request.user.platformRole
      },
      storeId
    );
  }
}
