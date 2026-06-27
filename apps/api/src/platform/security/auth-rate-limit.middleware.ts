import { Injectable, NestMiddleware } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RequestRateLimitService } from "./request-rate-limit.service";
import {
  normalizeRateLimitIdentity,
  resolveClientIp
} from "./rate-limit.utils";

type AuthRateLimitRequest = {
  headers: Record<string, string | string[] | undefined>;
  body?: {
    email?: unknown;
  };
  ip?: string;
  originalUrl?: string;
  path?: string;
  socket?: {
    remoteAddress?: string;
  };
};

type AuthRateLimitResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): AuthRateLimitResponse;
  json(body: unknown): void;
};

type NextFunction = () => void;

@Injectable()
export class AuthRateLimitMiddleware implements NestMiddleware {
  constructor(
    private readonly configService: ConfigService,
    private readonly requestRateLimitService: RequestRateLimitService
  ) {}

  use(request: AuthRateLimitRequest, response: AuthRateLimitResponse, next: NextFunction) {
    const path = request.path ?? request.originalUrl ?? "";
    const ip = resolveClientIp(request);
    const email = normalizeRateLimitIdentity(request.body?.email);
    const maxRequests = this.configService.get<number>("AUTH_RATE_LIMIT_MAX") ?? 10;
    const windowMs = this.configService.get<number>("AUTH_RATE_LIMIT_WINDOW_MS") ?? 60_000;

    const result = this.requestRateLimitService.consume({
      scope: path,
      key: `${ip}:${email}`,
      maxRequests,
      windowMs
    });

    response.setHeader("X-RateLimit-Limit", String(maxRequests));
    response.setHeader("X-RateLimit-Remaining", String(result.remaining));
    response.setHeader("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

    if (!result.allowed) {
      response.setHeader("Retry-After", String(result.retryAfterSeconds));
      response.status(429).json({
        message: "Too many authentication attempts",
        code: "AUTH_RATE_LIMIT_EXCEEDED",
        retryAfterSeconds: result.retryAfterSeconds
      });
      return;
    }

    next();
  }
}
