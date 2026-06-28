import { Reflector } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuthorizationGuard } from "./authorization.guard";
import { AuthController } from "./auth.controller";
import { AuthRepository } from "./auth.repository";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PasswordService } from "./password.service";

@Module({
  imports: [JwtModule.register({}), NotificationsModule],
  controllers: [AuthController],
  providers: [
    Reflector,
    AuthService,
    AuthRepository,
    PasswordService,
    JwtAuthGuard,
    AuthorizationGuard
  ],
  exports: [JwtModule, AuthService, AuthRepository, JwtAuthGuard, AuthorizationGuard]
})
export class AuthModule {}
