import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { StoreMemberRole } from "@prisma/client";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthenticatedRequest, PublicStorefrontRequest } from "../auth/auth.types";
import { StoreAccess } from "../auth/store-access.decorator";
import { StoreRoles } from "../auth/store-roles.decorator";
import { CatalogService } from "./catalog.service";
import {
  createCategorySchema,
  parseCatalogBody,
  updateCategorySchema
} from "./catalog.schemas";

@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get("boundary")
  getBoundary() {
    return this.catalogService.getBoundary();
  }

  @Get("public/context")
  getPublicContext(@Req() request: PublicStorefrontRequest) {
    return {
      store: request.publicStore ?? null
    };
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Get(":storeId/categories")
  listStoreCategories(@Param("storeId") storeId: string) {
    return this.catalogService.listStoreCategories(storeId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Post("categories")
  createCategory(@Req() _request: AuthenticatedRequest, @Body() body: unknown) {
    return this.catalogService.createCategory(
      parseCatalogBody(createCategorySchema, body)
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Patch("categories/:categoryId")
  updateCategory(
    @Req() _request: AuthenticatedRequest,
    @Param("categoryId") categoryId: string,
    @Body() body: unknown
  ) {
    return this.catalogService.updateCategory(
      categoryId,
      parseCatalogBody(updateCategorySchema, body)
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Post(":storeId/categories/:categoryId/deactivate")
  deactivateCategory(@Param("storeId") storeId: string, @Param("categoryId") categoryId: string) {
    return this.catalogService.deactivateCategory(storeId, categoryId);
  }
}
