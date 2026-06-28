import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { StoreMemberRole } from "@prisma/client";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthenticatedRequest, PublicStorefrontRequest } from "../auth/auth.types";
import { StoreAccess } from "../auth/store-access.decorator";
import { StoreRoles } from "../auth/store-roles.decorator";
import { CatalogService } from "./catalog.service";
import {
  createCategorySchema,
  parseCatalogQuery,
  createProductSchema,
  publicCatalogProductsQuerySchema,
  parseCatalogBody,
  uploadProductImageSchema,
  updateCategorySchema,
  updateProductSchema
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

  @Get("public/home")
  getPublicHomepage(@Req() request: PublicStorefrontRequest) {
    return this.catalogService.getPublicHomepage(request.publicStore!);
  }

  @Get("public/products")
  listPublicProducts(@Req() request: PublicStorefrontRequest, @Query() query: unknown) {
    return this.catalogService.listPublicProducts(
      request.publicStore!,
      parseCatalogQuery(publicCatalogProductsQuerySchema, query)
    );
  }

  @Get("public/products/:productSlug")
  getPublicProduct(
    @Req() request: PublicStorefrontRequest,
    @Param("productSlug") productSlug: string
  ) {
    return this.catalogService.getPublicProduct(request.publicStore!, productSlug);
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

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Get(":storeId/products")
  listStoreProducts(@Param("storeId") storeId: string) {
    return this.catalogService.listStoreProducts(storeId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Post("products")
  createProduct(@Req() _request: AuthenticatedRequest, @Body() body: unknown) {
    return this.catalogService.createProduct(
      parseCatalogBody(createProductSchema, body)
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Patch("products/:productId")
  updateProduct(
    @Req() _request: AuthenticatedRequest,
    @Param("productId") productId: string,
    @Body() body: unknown
  ) {
    return this.catalogService.updateProduct(
      productId,
      parseCatalogBody(updateProductSchema, body)
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Post("products/:productId/images")
  uploadProductImage(
    @Req() _request: AuthenticatedRequest,
    @Param("productId") productId: string,
    @Body() body: unknown
  ) {
    return this.catalogService.uploadProductImage(
      productId,
      parseCatalogBody(uploadProductImageSchema, body)
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Get(":storeId/products/:productId/images")
  listProductImages(@Param("storeId") storeId: string, @Param("productId") productId: string) {
    return this.catalogService.listProductImages(storeId, productId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Delete(":storeId/products/:productId/images/:imageId")
  removeProductImage(
    @Param("storeId") storeId: string,
    @Param("productId") productId: string,
    @Param("imageId") imageId: string
  ) {
    return this.catalogService.removeProductImage(storeId, productId, imageId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Post(":storeId/products/:productId/publish")
  publishProduct(@Param("storeId") storeId: string, @Param("productId") productId: string) {
    return this.catalogService.publishProduct(storeId, productId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Post(":storeId/products/:productId/deactivate")
  deactivateProduct(@Param("storeId") storeId: string, @Param("productId") productId: string) {
    return this.catalogService.deactivateProduct(storeId, productId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Post(":storeId/products/:productId/archive")
  archiveProduct(@Param("storeId") storeId: string, @Param("productId") productId: string) {
    return this.catalogService.archiveProduct(storeId, productId);
  }
}
