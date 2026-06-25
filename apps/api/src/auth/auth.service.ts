import {
  ConflictException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PlatformRole } from "@prisma/client";
import { AuthRepository } from "./auth.repository";
import { LoginInput, RefreshInput, RegisterInput } from "./auth.schemas";
import { PasswordService } from "./password.service";
import { AuthTokenPayload } from "./auth.types";

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  getBoundary() {
    return this.authRepository.getBoundary();
  }

  async register(input: RegisterInput) {
    const existingUser = await this.authRepository.findUserByEmail(input.email);

    if (existingUser) {
      throw new ConflictException("Email is already registered");
    }

    const user = await this.authRepository.createUser({
      email: input.email,
      fullName: input.fullName,
      passwordHash: this.passwordService.hashSecret(input.password),
      platformRole: PlatformRole.CUSTOMER
    });

    return this.issueAuthSession(user.id, user.email, user.platformRole, user.fullName);
  }

  async login(input: LoginInput) {
    const user = await this.authRepository.findUserByEmail(input.email);

    if (!user || !this.passwordService.verifySecret(input.password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return this.issueAuthSession(user.id, user.email, user.platformRole, user.fullName);
  }

  async refresh(input: RefreshInput) {
    const payload = await this.verifyToken(input.refreshToken, "refresh");
    const user = await this.authRepository.findUserById(payload.sub);

    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException("Refresh session not found");
    }

    const validRefreshToken = this.passwordService.verifySecret(
      input.refreshToken,
      user.refreshTokenHash
    );

    if (!validRefreshToken) {
      throw new UnauthorizedException("Refresh token is invalid");
    }

    return this.issueAuthSession(user.id, user.email, user.platformRole, user.fullName);
  }

  async logout(userId: string) {
    await this.authRepository.updateRefreshTokenHash(userId, null);

    return {
      success: true
    };
  }

  async me(userId: string) {
    const user = await this.authRepository.findUserById(userId);

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return this.authRepository.toAuthenticatedUser(user);
  }

  private async issueAuthSession(
    userId: string,
    email: string,
    platformRole: PlatformRole,
    fullName: string | null
  ) {
    const accessPayload: AuthTokenPayload = {
      sub: userId,
      email,
      platformRole,
      type: "access"
    };

    const refreshPayload: AuthTokenPayload = {
      ...accessPayload,
      type: "refresh"
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.configService.getOrThrow<string>("JWT_SECRET"),
        expiresIn: this.configService.getOrThrow<string>("JWT_ACCESS_TTL") as never
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.getOrThrow<string>("JWT_SECRET"),
        expiresIn: this.configService.getOrThrow<string>("JWT_REFRESH_TTL") as never
      })
    ]);

    await this.authRepository.updateRefreshTokenHash(
      userId,
      this.passwordService.hashSecret(refreshToken)
    );

    return {
      user: {
        id: userId,
        email,
        fullName,
        platformRole
      },
      tokens: {
        accessToken,
        refreshToken,
        tokenType: "Bearer"
      }
    };
  }

  private async verifyToken(token: string, type: AuthTokenPayload["type"]) {
    try {
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>("JWT_SECRET")
      });

      if (payload.type !== type) {
        throw new UnauthorizedException(`Invalid ${type} token`);
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException(`Invalid or expired ${type} token`);
    }
  }
}
