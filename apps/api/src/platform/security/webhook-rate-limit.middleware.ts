import { Injectable, NestMiddleware } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RequestRateLimitService } from "./request-rate-limit.service";
import { resolveClientIp } from "./rate-limit.utils";

type WebhookRateLimitRequest = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
};

type WebhookRateLimitResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): WebhookRateLimitResponse;
  json(body: unknown): void;
};

type NextFunction = () => void;

@Injectable()
export class WebhookRateLimitMiddleware implements NestMiddleware {
  constructor(
    private readonly configService: ConfigService,
    private readonly requestRateLimitService: RequestRateLimitService
  ) {}

  use(request: WebhookRateLimitRequest, response: WebhookRateLimitResponse, next: NextFunction) {
    const maxRequests = this.configService.get<number>("WEBHOOK_RATE_LIMIT_MAX") ?? 30;
    const windowMs = this.configService.get<number>("WEBHOOK_RATE_LIMIT_WINDOW_MS") ?? 60_000;
    const ip = resolveClientIp(request);

    const result = this.requestRateLimitService.consume({
      scope: "payments:webhooks:stripe",
      key: ip,
      maxRequests,
      windowMs
    });

    response.setHeader("X-RateLimit-Limit", String(maxRequests));
    response.setHeader("X-RateLimit-Remaining", String(result.remaining));
    response.setHeader("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

    if (!result.allowed) {
      response.setHeader("Retry-After", String(result.retryAfterSeconds));
      response.status(429).json({
        message: "Too many webhook deliveries",
        code: "WEBHOOK_RATE_LIMIT_EXCEEDED",
        retryAfterSeconds: result.retryAfterSeconds
      });
      return;
    }

    next();
  }
}
