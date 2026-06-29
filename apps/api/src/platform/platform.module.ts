import { Module } from "@nestjs/common";
import { HttpExceptionFilter } from "./errors/http-exception.filter";
import { LoggingInterceptor } from "./logging/logging.interceptor";

@Module({
  providers: [HttpExceptionFilter, LoggingInterceptor],
  exports: [HttpExceptionFilter, LoggingInterceptor]
})
export class PlatformModule {}