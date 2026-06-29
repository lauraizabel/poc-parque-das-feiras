import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
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
import {
  createStoreSchema,
  inviteStoreMemberSchema,
  parseStoreBody,
  parseStoreQuery,
  storeSlugAvailabilitySchema,
  updateStoreSettingsSchema,
  updateStoreThemeSchema,
  updateStoreMemberRoleSchema
} from "./stores.schemas";
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

  @Get("slug-availability")
  getSlugAvailability(@Query() query: unknown) {
    return this.storesService.checkSlugAvailability(
      parseStoreQuery(storeSlugAvailabilitySchema, query)
    );
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
      ownerId: request.user.sub,
      actor: {
        id: request.user.sub,
        email: request.user.email,
        fullName: null,
        platformRole: request.user.platformRole
      }
    });
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Get(":storeId/settings")
  getStoreSettings(@Param("storeId") storeId: string) {
    return this.storesService.getStoreSettings(storeId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Patch(":storeId/settings")
  updateStoreSettings(@Param("storeId") storeId: string, @Body() body: unknown) {
    return this.storesService.updateStoreSettings(
      storeId,
      parseStoreBody(updateStoreSettingsSchema, body)
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Get(":storeId/theme")
  getStoreTheme(@Param("storeId") storeId: string) {
    return this.storesService.getStoreTheme(storeId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Patch(":storeId/theme")
  updateStoreTheme(@Param("storeId") storeId: string, @Body() body: unknown) {
    return this.storesService.updateStoreTheme(
      storeId,
      parseStoreBody(updateStoreThemeSchema, body)
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER)
  @Get(":storeId/members")
  listMembers(@Param("storeId") storeId: string) {
    return this.storesService.listMembers(storeId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER)
  @Post(":storeId/members/invite")
  inviteMember(
    @Req() request: AuthenticatedRequest,
    @Param("storeId") storeId: string,
    @Body() body: unknown
  ) {
    return this.storesService.inviteMember({
      ...parseStoreBody(inviteStoreMemberSchema, body),
      storeId,
      invitedByUserId: request.user.sub
    });
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER)
  @Patch(":storeId/members/:memberId")
  updateMemberRole(
    @Req() request: AuthenticatedRequest,
    @Param("storeId") storeId: string,
    @Param("memberId") memberId: string,
    @Body() body: unknown
  ) {
    return this.storesService.updateMemberRole({
      ...parseStoreBody(updateStoreMemberRoleSchema, body),
      storeId,
      memberId,
      actorUserId: request.user.sub
    });
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER)
  @Delete(":storeId/members/:memberId")
  removeMember(
    @Req() request: AuthenticatedRequest,
    @Param("storeId") storeId: string,
    @Param("memberId") memberId: string
  ) {
    return this.storesService.removeMember({
      storeId,
      memberId,
      actorUserId: request.user.sub
    });
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER)
  @Delete(":storeId/member-invites/:inviteId")
  removePendingInvite(@Param("storeId") storeId: string, @Param("inviteId") inviteId: string) {
    return this.storesService.removePendingInvite({
      storeId,
      inviteId
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
