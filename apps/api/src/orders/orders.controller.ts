import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { StoreMemberRole } from "@prisma/client";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StoreAccess } from "../auth/store-access.decorator";
import { StoreRoles } from "../auth/store-roles.decorator";
import {
  listManagedOrdersQuerySchema,
  parseOrdersBody,
  parseOrdersQuery,
  updateManagedOrderStatusSchema
} from "./orders.schemas";
import { OrdersService } from "./orders.service";

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get("boundary")
  getBoundary() {
    return this.ordersService.getBoundary();
  }

  @Get("public/:orderId")
  getPublicOrder(@Param("orderId") orderId: string, @Query("token") token = "") {
    return this.ordersService.getPublicOrder(orderId, token);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(
    StoreMemberRole.STORE_OWNER,
    StoreMemberRole.STORE_MANAGER,
    StoreMemberRole.STORE_SUPPORT
  )
  @Get(":storeId/management")
  listManagedOrders(@Param("storeId") storeId: string, @Query() query: unknown) {
    return this.ordersService.listManagedOrders(
      storeId,
      parseOrdersQuery(listManagedOrdersQuerySchema, query)
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Patch(":storeId/:orderId/status")
  updateManagedOrderStatus(
    @Req() request: AuthenticatedRequest,
    @Param("orderId") orderId: string,
    @Body() body: unknown
  ) {
    return this.ordersService.updateManagedOrderStatus(
      {
        id: request.user.sub,
        email: request.user.email,
        fullName: null,
        platformRole: request.user.platformRole
      },
      orderId,
      parseOrdersBody(updateManagedOrderStatusSchema, body)
    );
  }
}
