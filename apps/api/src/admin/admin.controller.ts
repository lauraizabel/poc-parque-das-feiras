import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { PlatformRole } from "@prisma/client";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PlatformRoles } from "../auth/platform-roles.decorator";
import { AdminService } from "./admin.service";
import {
  listAdminDomainsQuerySchema,
  listAdminOrdersQuerySchema,
  listAdminPaymentsQuerySchema,
  listAdminStoresQuerySchema,
  listAdminUsersQuerySchema,
  parseAdminBody,
  parseAdminQuery
} from "./admin.schemas";
import { updateAdminStoreStatusSchema } from "./admin.schemas";

@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("boundary")
  getBoundary() {
    return this.adminService.getBoundary();
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @PlatformRoles(PlatformRole.PLATFORM_ADMIN)
  @Get("overview")
  getOverview() {
    return this.adminService.getOverview();
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @PlatformRoles(PlatformRole.PLATFORM_ADMIN)
  @Get("stores")
  listStores(@Query() query: unknown) {
    return this.adminService.listStores(parseAdminQuery(listAdminStoresQuerySchema, query));
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @PlatformRoles(PlatformRole.PLATFORM_ADMIN)
  @Get("stores/:storeId")
  getStoreDetail(@Param("storeId") storeId: string) {
    return this.adminService.getStoreDetail(storeId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @PlatformRoles(PlatformRole.PLATFORM_ADMIN)
  @Patch("stores/:storeId/status")
  updateStoreStatus(@Param("storeId") storeId: string, @Body() body: unknown) {
    return this.adminService.updateStoreStatus(
      storeId,
      parseAdminBody(updateAdminStoreStatusSchema, body)
    );
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @PlatformRoles(PlatformRole.PLATFORM_ADMIN)
  @Get("users")
  listUsers(@Query() query: unknown) {
    return this.adminService.listUsers(parseAdminQuery(listAdminUsersQuerySchema, query));
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @PlatformRoles(PlatformRole.PLATFORM_ADMIN)
  @Get("users/:userId")
  getUserDetail(@Param("userId") userId: string) {
    return this.adminService.getUserDetail(userId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @PlatformRoles(PlatformRole.PLATFORM_ADMIN)
  @Get("orders")
  listOrders(@Query() query: unknown) {
    return this.adminService.listOrders(parseAdminQuery(listAdminOrdersQuerySchema, query));
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @PlatformRoles(PlatformRole.PLATFORM_ADMIN)
  @Get("orders/:orderId")
  getOrderDetail(@Param("orderId") orderId: string) {
    return this.adminService.getOrderDetail(orderId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @PlatformRoles(PlatformRole.PLATFORM_ADMIN)
  @Get("payments")
  listPayments(@Query() query: unknown) {
    return this.adminService.listPayments(parseAdminQuery(listAdminPaymentsQuerySchema, query));
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @PlatformRoles(PlatformRole.PLATFORM_ADMIN)
  @Get("payments/:paymentId")
  getPaymentDetail(@Param("paymentId") paymentId: string) {
    return this.adminService.getPaymentDetail(paymentId);
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @PlatformRoles(PlatformRole.PLATFORM_ADMIN)
  @Get("domains")
  listDomains(@Query() query: unknown) {
    return this.adminService.listDomains(parseAdminQuery(listAdminDomainsQuerySchema, query));
  }
}
