import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import {
  loginSchema,
  parseBody,
  requestEmailVerificationSchema,
  requestPasswordResetSchema,
  refreshSchema,
  resetPasswordSchema,
  registerMerchantSchema,
  registerSchema,
  verifyEmailSchema
} from "./auth.schemas";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { AuthenticatedRequest } from "./auth.types";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("boundary")
  getBoundary() {
    return this.authService.getBoundary();
  }

  @Post("register")
  register(@Body() body: unknown) {
    return this.authService.register(parseBody(registerSchema, body));
  }

  @Post("register-merchant")
  registerMerchant(@Body() body: unknown) {
    return this.authService.registerMerchant(parseBody(registerMerchantSchema, body));
  }

  @Post("login")
  @HttpCode(200)
  login(@Body() body: unknown) {
    return this.authService.login(parseBody(loginSchema, body));
  }

  @Post("refresh")
  @HttpCode(200)
  refresh(@Body() body: unknown) {
    return this.authService.refresh(parseBody(refreshSchema, body));
  }

  @Post("request-email-verification")
  @HttpCode(202)
  requestEmailVerification(@Body() body: unknown) {
    return this.authService.requestEmailVerification(
      parseBody(requestEmailVerificationSchema, body)
    );
  }

  @Post("verify-email")
  @HttpCode(200)
  verifyEmail(@Body() body: unknown) {
    return this.authService.verifyEmail(parseBody(verifyEmailSchema, body));
  }

  @Post("request-password-reset")
  @HttpCode(202)
  requestPasswordReset(@Body() body: unknown) {
    return this.authService.requestPasswordReset(
      parseBody(requestPasswordResetSchema, body)
    );
  }

  @Post("reset-password")
  @HttpCode(200)
  resetPassword(@Body() body: unknown) {
    return this.authService.resetPassword(parseBody(resetPasswordSchema, body));
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  @HttpCode(200)
  logout(@Req() request: AuthenticatedRequest) {
    return this.authService.logout(request.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.me(request.user.sub);
  }
}
