import { Controller, Get, ServiceUnavailableException, UseGuards } from "@nestjs/common";
import { PlatformRole } from "@prisma/client";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PlatformRoles } from "../auth/platform-roles.decorator";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth() {
    const health = await this.healthService.getHealth();

    if (health.status !== "ok") {
      throw new ServiceUnavailableException(health);
    }

    return health;
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @PlatformRoles(PlatformRole.PLATFORM_ADMIN)
  @Get("queues")
  async getQueueHealth() {
    return this.healthService.getQueueHealthDetails();
  }
}