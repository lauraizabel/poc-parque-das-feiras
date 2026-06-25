import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import {
  loginSchema,
  parseBody,
  refreshSchema,
  registerSchema
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
