import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { PlatformRole } from "@prisma/client";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PlatformRoles } from "../auth/platform-roles.decorator";
import { AuditService } from "./audit.service";

@Controller("audit")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get("boundary")
  getBoundary() {
    return this.auditService.getBoundary();
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @PlatformRoles(PlatformRole.PLATFORM_ADMIN)
  @Get("logs")
  listLogs(
    @Query("storeId") storeId?: string,
    @Query("userId") userId?: string,
    @Query("action") action?: string,
    @Query("take") take?: string
  ) {
    return this.auditService.listAuditLogs({
      storeId,
      userId,
      action,
      take:
        typeof take === "string" && Number.isFinite(Number(take))
          ? Math.max(1, Math.min(200, Number(take)))
          : undefined
    });
  }
}
