import { Module } from "@nestjs/common";
import { ApiSecurityMiddleware } from "./api-security.middleware";
import { AuthRateLimitMiddleware } from "./auth-rate-limit.middleware";
import { RequestRateLimitService } from "./request-rate-limit.service";
import { WebhookRateLimitMiddleware } from "./webhook-rate-limit.middleware";

@Module({
  providers: [
    RequestRateLimitService,
    ApiSecurityMiddleware,
    AuthRateLimitMiddleware,
    WebhookRateLimitMiddleware
  ],
  exports: [
    RequestRateLimitService,
    ApiSecurityMiddleware,
    AuthRateLimitMiddleware,
    WebhookRateLimitMiddleware
  ]
})
export class SecurityModule {}
