import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { PlatformRole } from "@prisma/client";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PlatformRoles } from "../auth/platform-roles.decorator";
import { AdminService } from "./admin.service";
import {
  listAdminDomainsQuerySchema,
  listAdminOrdersQuerySchema,
  listAdminStoresQuerySchema,
  listAdminUsersQuerySchema,
  parseAdminQuery
} from "./admin.schemas";

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
  @Get("users")
  listUsers(@Query() query: unknown) {
    return this.adminService.listUsers(parseAdminQuery(listAdminUsersQuerySchema, query));
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @PlatformRoles(PlatformRole.PLATFORM_ADMIN)
  @Get("orders")
  listOrders(@Query() query: unknown) {
    return this.adminService.listOrders(parseAdminQuery(listAdminOrdersQuerySchema, query));
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @PlatformRoles(PlatformRole.PLATFORM_ADMIN)
  @Get("domains")
  listDomains(@Query() query: unknown) {
    return this.adminService.listDomains(parseAdminQuery(listAdminDomainsQuerySchema, query));
  }
}
