import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Logger } from "@nestjs/common";
import { Observable, throwError } from "rxjs";
import { catchError, tap } from "rxjs/operators";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, headers, query, params } = request;
    const requestId = headers["x-request-id"] || this.generateRequestId();
    const user = request.user;
    const storeId = request.store?.id;

    const startTime = Date.now();

    this.logger.log({
      level: "info",
      message: "Incoming request",
      context: {
        requestId,
        method,
        url,
        query,
        params,
        user: user
          ? {
              id: user.id,
              email: user.email,
              role: user.role
            }
          : null,
        storeId,
        userAgent: headers["user-agent"],
        ip: request.ip || request.connection.remoteAddress
      }
    });

    return next.handle().pipe(
      tap((response) => {
        const responseTime = Date.now() - startTime;
        this.logger.log({
          level: "info",
          message: "Request completed successfully",
          context: {
            requestId,
            method,
            url,
            statusCode: context.switchToHttp().getResponse().statusCode,
            responseTime: `${responseTime}ms`
          }
        });
      }),
      catchError((error) => {
        const responseTime = Date.now() - startTime;
        const statusCode = error.status || 500;

        this.logger.error({
          level: "error",
          message: "Request failed",
          context: {
            requestId,
            method,
            url,
            statusCode,
            error: {
              name: error.name,
              message: this.sanitizeErrorMessage(error.message),
              stack: error.stack
            },
            responseTime: `${responseTime}ms`,
            user: user
              ? {
                  id: user.id,
                  email: user.email,
                  role: user.role
                }
              : null,
            storeId
          }
        });

        return throwError(() => error);
      })
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private sanitizeErrorMessage(message: string): string {
    const sensitivePatterns = [
      /password[=:]\s*\S+/gi,
      /token[=:]\s*\S+/gi,
      /secret[=:]\s*\S+/gi,
      /authorization[=:]\s*\S+/gi,
      /bearer\s+\S+/gi
    ];

    let sanitized = message;
    sensitivePatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, "[REDACTED]");
    });

    return sanitized;
  }
}