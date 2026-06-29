import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from "@nestjs/common";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const requestId = request.headers["x-request-id"] || `req_${Date.now()}`;
    const user = request.user;
    const storeId = request.store?.id;

    let status: number;
    let message: string;
    let errors: any;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "string") {
        message = exceptionResponse;
        errors = null;
      } else if (typeof exceptionResponse === "object") {
        message = (exceptionResponse as any).message || "Error";
        errors = (exceptionResponse as any).errors || null;
      } else {
        message = "Error";
        errors = null;
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = "Internal server error";
      errors = null;

      this.logger.error({
        level: "error",
        message: "Unhandled exception",
        context: {
          requestId,
          error: {
            name: exception.name,
            message: this.sanitizeErrorMessage(exception.message),
            stack: exception.stack
          },
          user: user
            ? {
                id: user.id,
                email: user.email,
                role: user.role
              }
            : null,
          storeId,
          url: request.url,
          method: request.method
        }
      });
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = "Unknown error";
      errors = null;
    }

    const logLevel = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

    this.logger.log({
      level: logLevel,
      message: `HTTP ${status} - ${message}`,
      context: {
        requestId,
        statusCode: status,
        method: request.method,
        url: request.url,
        message,
        errors,
        user: user
          ? {
              id: user.id,
              email: user.email,
              role: user.role
            }
          : null,
        storeId,
        responseTime: `${Date.now() - (request as any).startTime}ms`
      }
    });

    response.status(status).json({
      statusCode: status,
      message,
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId
    });
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