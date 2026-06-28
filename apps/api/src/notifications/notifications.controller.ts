import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { StoreMemberRole } from "@prisma/client";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StoreAccess } from "../auth/store-access.decorator";
import { StoreRoles } from "../auth/store-roles.decorator";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get("boundary")
  getBoundary() {
    return this.notificationsService.getBoundary();
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @StoreAccess()
  @StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
  @Get(":storeId/settings")
  getStoreNotificationSettings(@Param("storeId") storeId: string) {
    return this.notificationsService.getStoreNotificationSettings(storeId);
  }
}
