import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { PlatformRole, StoreMemberRole } from "@prisma/client";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PlatformRoles } from "../auth/platform-roles.decorator";
import { StoreAccess } from "../auth/store-access.decorator";
import { StoreRoles } from "../auth/store-roles.decorator";
import {
  AuthenticatedRequest,
  PublicStorefrontRequest
} from "../auth/auth.types";
import { createStoreSchema, parseStoreBody } from "./stores.schemas";
import { StoresService } from "./stores.service";

@Controller("stores")
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get("boundary")
  getBoundary() {
    return this.storesService.getBoundary();
  }

  @Get("public/current")
  getPublicCurrent(
    @Req() request: PublicStorefrontRequest
  ) {
    return {
      store: request.publicStore ?? null
    };
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @PlatformRoles(PlatformRole.PLATFORM_ADMIN)
  @Get("platform")
  getPlatformProtected() {
    return {
      scope: "platform",
      access: "granted"
    };
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Get(":storeId/management")
  getStoreManagement(@Req() request: AuthenticatedRequest) {
    return {
      scope: "store",
      access: "granted",
      storeContext: request.storeContext
    };
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @Get(":storeId/support")
  getStoreSupport(@Req() request: AuthenticatedRequest) {
    return {
      scope: "store",
      access: "granted",
      storeContext: request.storeContext
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  createStore(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.storesService.createStore({
      ...parseStoreBody(createStoreSchema, body),
      ownerId: request.user.sub
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post("fixtures")
  createFixture(
    @Req() request: AuthenticatedRequest,
    @Body() body: { role?: StoreMemberRole; name?: string; slug?: string }
  ) {
    return this.storesService.createAuthorizationFixture({
      userId: request.user.sub,
      role: body.role ?? StoreMemberRole.STORE_OWNER,
      name: body.name,
      slug: body.slug
    });
  }
}
