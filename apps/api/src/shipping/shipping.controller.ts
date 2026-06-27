import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { StoreMemberRole } from "@prisma/client";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StoreAccess } from "../auth/store-access.decorator";
import { StoreRoles } from "../auth/store-roles.decorator";
import { ShippingService } from "./shipping.service";
import {
  createShipmentSchema,
  createShippingMethodSchema,
  parseShippingBody,
  updateShippingMethodSchema
} from "./shipping.schemas";

@Controller("shipping")
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get("boundary")
  getBoundary() {
    return this.shippingService.getBoundary();
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Get(":storeId/methods")
  listStoreShippingMethods(@Param("storeId") storeId: string) {
    return this.shippingService.listStoreShippingMethods(storeId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Post("methods")
  createShippingMethod(@Req() _request: AuthenticatedRequest, @Body() body: unknown) {
    return this.shippingService.createShippingMethod(
      parseShippingBody(createShippingMethodSchema, body)
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Patch("methods/:shippingMethodId")
  updateShippingMethod(
    @Req() _request: AuthenticatedRequest,
    @Param("shippingMethodId") shippingMethodId: string,
    @Body() body: unknown
  ) {
    return this.shippingService.updateShippingMethod(
      shippingMethodId,
      parseShippingBody(updateShippingMethodSchema, body)
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Post("shipments")
  createShipment(@Req() _request: AuthenticatedRequest, @Body() body: unknown) {
    return this.shippingService.createShipment(
      parseShippingBody(createShipmentSchema, body)
    );
  }
}
