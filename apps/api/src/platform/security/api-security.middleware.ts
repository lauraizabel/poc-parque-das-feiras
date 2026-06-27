import { Injectable, NestMiddleware } from "@nestjs/common";
import { appendHeader } from "./rate-limit.utils";

type SecurityRequest = {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  path?: string;
  url?: string;
  secure?: boolean;
  protocol?: string;
};

type SecurityResponse = {
  getHeader(name: string): string | string[] | number | undefined;
  setHeader(name: string, value: string): void;
  status(code: number): SecurityResponse;
  json(body: unknown): void;
};

type NextFunction = () => void;

@Injectable()
export class ApiSecurityMiddleware implements NestMiddleware {
  use(request: SecurityRequest, response: SecurityResponse, next: NextFunction) {
    const path = request.path ?? request.url ?? "";
    const method = request.method?.toUpperCase() ?? "GET";

    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-DNS-Prefetch-Control", "off");
    response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    response.setHeader("Cross-Origin-Resource-Policy", "same-site");
    response.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=()"
    );
    appendHeader(response, "Vary", "Origin");
    appendHeader(response, "Vary", "Authorization");

    if (this.isSecureRequest(request)) {
      response.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload"
      );
    }

    if (path.startsWith("/auth")) {
      response.setHeader("Cache-Control", "no-store, max-age=0");
      response.setHeader("Pragma", "no-cache");
    }

    const hasCookieHeader =
      typeof request.headers.cookie === "string" && request.headers.cookie.trim().length > 0;
    const hasBearerHeader =
      typeof request.headers.authorization === "string" &&
      request.headers.authorization.startsWith("Bearer ");
    const isMutatingRequest = !["GET", "HEAD", "OPTIONS"].includes(method);

    if (hasCookieHeader && (path.startsWith("/auth") || (hasBearerHeader && isMutatingRequest))) {
      response.status(400).json({
        message: "Cookie-based sessions are not supported for this API",
        code: "AUTH_COOKIE_SESSION_NOT_SUPPORTED"
      });
      return;
    }

    next();
  }

  private isSecureRequest(request: SecurityRequest) {
    if (request.secure || request.protocol === "https") {
      return true;
    }

    const forwardedProto = request.headers["x-forwarded-proto"];
    const protoValue = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
    return protoValue === "https";
  }
}
