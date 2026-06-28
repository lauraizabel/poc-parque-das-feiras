import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes } from "node:crypto";
import {
  AuthFlowAuditAction,
  AuthFlowTokenPurpose,
  PlatformRole
} from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";
import { AuthRepository } from "./auth.repository";
import {
  LoginInput,
  RequestEmailVerificationInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  RefreshInput,
  RegisterInput,
  RegisterMerchantInput,
  VerifyEmailInput
} from "./auth.schemas";
import { PasswordService } from "./password.service";
import { AuthTokenPayload } from "./auth.types";

const RESERVED_STORE_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "checkout",
  "dashboard",
  "help",
  "login",
  "panel",
  "root",
  "settings",
  "signup",
  "store",
  "stores",
  "support",
  "www"
]);

const EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24;
const PASSWORD_RESET_TTL_MS = 1000 * 60 * 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService
  ) {}

  getBoundary() {
    return this.authRepository.getBoundary();
  }

  normalizeStoreSlug(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (normalized.length < 2) {
      throw new BadRequestException("Store slug must contain at least 2 alphanumeric characters");
    }

    return normalized;
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

    await this.issueEmailVerificationToken(user.id, user.email);

    return this.issueAuthSession(
      user.id,
      user.email,
      user.platformRole,
      user.fullName,
      user.emailVerifiedAt
    );
  }

  async registerMerchant(input: RegisterMerchantInput) {
    const existingUser = await this.authRepository.findUserByEmail(input.email);

    if (existingUser) {
      throw new ConflictException("Email is already registered");
    }

    const reservedSlug = this.normalizeStoreSlug(input.storeSlug);
    this.assertAllowedStoreSlug(reservedSlug);
    const existingSlug = await this.authRepository.findStoreBySlugOrSubdomain(
      reservedSlug,
      "__unused__"
    );

    if (existingSlug?.slug === reservedSlug) {
      throw new ConflictException("Store slug is already in use");
    }

    const defaultSubdomain = await this.generateDefaultSubdomain(reservedSlug);

    const onboarding = await this.authRepository.createMerchantOnboarding({
      email: input.email,
      fullName: input.fullName,
      passwordHash: this.passwordService.hashSecret(input.password),
      storeName: input.storeName.trim(),
      storeSlug: reservedSlug,
      defaultSubdomain,
      supportEmail: input.supportEmail?.toLowerCase(),
      currencyCode: input.currencyCode?.toUpperCase() ?? "BRL",
      locale: input.locale ?? "pt-BR"
    });

    await this.issueEmailVerificationToken(onboarding.user.id, onboarding.user.email);

    const session = await this.issueAuthSession(
      onboarding.user.id,
      onboarding.user.email,
      onboarding.user.platformRole,
      onboarding.user.fullName,
      onboarding.user.emailVerifiedAt
    );

    return {
      ...session,
      store: onboarding.store,
      membership: onboarding.membership
    };
  }

  async login(input: LoginInput) {
    const user = await this.authRepository.findUserByEmail(input.email);

    if (!user || !this.passwordService.verifySecret(input.password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return this.issueAuthSession(
      user.id,
      user.email,
      user.platformRole,
      user.fullName,
      user.emailVerifiedAt
    );
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

    return this.issueAuthSession(
      user.id,
      user.email,
      user.platformRole,
      user.fullName,
      user.emailVerifiedAt
    );
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

    const memberships = await this.authRepository.listStoreMembershipsByUser(userId);

    return {
      ...this.authRepository.toAuthenticatedUser(user),
      memberships: memberships.map((membership) => ({
        storeId: membership.storeId,
        role: membership.role,
        createdAt: membership.createdAt,
        store: {
          id: membership.store.id,
          name: membership.store.name,
          slug: membership.store.slug,
          defaultSubdomain: membership.store.defaultSubdomain,
          currencyCode: membership.store.currencyCode,
          locale: membership.store.locale,
          supportEmail: membership.store.supportEmail
        }
      }))
    };
  }

  async requestEmailVerification(input: RequestEmailVerificationInput) {
    const user = await this.authRepository.findUserByEmail(input.email);

    if (!user || user.emailVerifiedAt) {
      return {
        success: true
      };
    }

    await this.issueEmailVerificationToken(user.id, user.email);

    return {
      success: true
    };
  }

  async verifyEmail(input: VerifyEmailInput) {
    const token = await this.resolveActiveFlowToken(
      input.token,
      AuthFlowTokenPurpose.EMAIL_VERIFICATION
    );

    if (token.user.emailVerifiedAt) {
      await this.authRepository.consumeAuthFlowToken(token.id);

      return {
        success: true,
        user: this.authRepository.toAuthenticatedUser(token.user)
      };
    }

    const now = new Date();

    await this.authRepository.updateUserCredentials({
      userId: token.userId,
      emailVerifiedAt: now
    });
    await this.authRepository.consumeAuthFlowToken(token.id);
    await this.authRepository.createAuthFlowAudit({
      userId: token.userId,
      tokenId: token.id,
      action: AuthFlowAuditAction.EMAIL_VERIFICATION_CONFIRMED,
      purpose: AuthFlowTokenPurpose.EMAIL_VERIFICATION,
      metadata: JSON.stringify({
        confirmedAt: now.toISOString()
      })
    });

    const refreshedUser = await this.authRepository.findUserById(token.userId);

    return {
      success: true,
      user: this.authRepository.toAuthenticatedUser(refreshedUser!)
    };
  }

  async requestPasswordReset(input: RequestPasswordResetInput) {
    const user = await this.authRepository.findUserByEmail(input.email);

    if (!user) {
      return {
        success: true
      };
    }

    await this.issuePasswordResetToken(user.id, user.email);

    return {
      success: true
    };
  }

  async resetPassword(input: ResetPasswordInput) {
    const token = await this.resolveActiveFlowToken(
      input.token,
      AuthFlowTokenPurpose.PASSWORD_RESET
    );

    await this.authRepository.updateUserCredentials({
      userId: token.userId,
      passwordHash: this.passwordService.hashSecret(input.password),
      refreshTokenHash: null
    });
    await this.authRepository.consumeAuthFlowToken(token.id);
    await this.authRepository.createAuthFlowAudit({
      userId: token.userId,
      tokenId: token.id,
      action: AuthFlowAuditAction.PASSWORD_RESET_COMPLETED,
      purpose: AuthFlowTokenPurpose.PASSWORD_RESET,
      metadata: JSON.stringify({
        completedAt: new Date().toISOString()
      })
    });

    return {
      success: true
    };
  }

  private async issueAuthSession(
    userId: string,
    email: string,
    platformRole: PlatformRole,
    fullName: string | null,
    emailVerifiedAt: Date | null
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
        emailVerifiedAt,
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

  private async issueEmailVerificationToken(userId: string, email: string) {
    const flow = await this.issueFlowToken(userId, AuthFlowTokenPurpose.EMAIL_VERIFICATION);

    await this.notificationsService.enqueueEmailNotification({
      to: email,
      subject: "Confirme o seu e-mail",
      templateKey: "auth-email-verification",
      variables: {
        verificationUrl: `${this.configService.getOrThrow<string>("DASHBOARD_URL")}/verify-email?token=${flow.rawToken}`,
        token: flow.rawToken
      },
      metadata: {
        userId,
        purpose: AuthFlowTokenPurpose.EMAIL_VERIFICATION
      }
    });
    await this.authRepository.touchAuthFlowTokenSentAt(flow.token.id);
    await this.authRepository.createAuthFlowAudit({
      userId,
      tokenId: flow.token.id,
      action: AuthFlowAuditAction.EMAIL_VERIFICATION_REQUESTED,
      purpose: AuthFlowTokenPurpose.EMAIL_VERIFICATION,
      metadata: JSON.stringify({
        email
      })
    });
  }

  private async issuePasswordResetToken(userId: string, email: string) {
    const flow = await this.issueFlowToken(userId, AuthFlowTokenPurpose.PASSWORD_RESET);

    await this.notificationsService.enqueueEmailNotification({
      to: email,
      subject: "Redefina a sua senha",
      templateKey: "auth-password-reset",
      variables: {
        resetUrl: `${this.configService.getOrThrow<string>("DASHBOARD_URL")}/reset-password?token=${flow.rawToken}`,
        token: flow.rawToken
      },
      metadata: {
        userId,
        purpose: AuthFlowTokenPurpose.PASSWORD_RESET
      }
    });
    await this.authRepository.touchAuthFlowTokenSentAt(flow.token.id);
    await this.authRepository.createAuthFlowAudit({
      userId,
      tokenId: flow.token.id,
      action: AuthFlowAuditAction.PASSWORD_RESET_REQUESTED,
      purpose: AuthFlowTokenPurpose.PASSWORD_RESET,
      metadata: JSON.stringify({
        email
      })
    });
  }

  private async issueFlowToken(userId: string, purpose: AuthFlowTokenPurpose) {
    await this.authRepository.invalidateActiveAuthFlowTokens(userId, purpose);

    const rawToken = randomBytes(24).toString("hex");
    const token = await this.authRepository.createAuthFlowToken({
      userId,
      purpose,
      tokenHash: this.hashFlowToken(rawToken),
      expiresAt: new Date(
        Date.now() +
          (purpose === AuthFlowTokenPurpose.EMAIL_VERIFICATION
            ? EMAIL_VERIFICATION_TTL_MS
            : PASSWORD_RESET_TTL_MS)
      )
    });

    return {
      rawToken,
      token
    };
  }

  private async resolveActiveFlowToken(rawToken: string, purpose: AuthFlowTokenPurpose) {
    const tokenHash = this.hashFlowToken(rawToken);
    const token = await this.authRepository.findActiveAuthFlowTokenByHash(tokenHash, purpose);

    if (!token) {
      throw new NotFoundException({
        message: "Token not found",
        code: "AUTH_FLOW_TOKEN_NOT_FOUND",
        purpose
      });
    }

    if (token.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException({
        message: "Token has expired",
        code: "AUTH_FLOW_TOKEN_EXPIRED",
        purpose
      });
    }

    return token;
  }

  private hashFlowToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private async generateDefaultSubdomain(storeSlug: string) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
      const candidate = `${storeSlug}${suffix}`;
      const existingStore = await this.authRepository.findStoreBySlugOrSubdomain(
        storeSlug,
        candidate
      );

      if (!existingStore) {
        return candidate;
      }
    }

    throw new ConflictException("Could not generate a unique default subdomain");
  }

  private assertAllowedStoreSlug(slug: string) {
    if (RESERVED_STORE_SLUGS.has(slug)) {
      throw new BadRequestException("Store slug is reserved");
    }
  }
}
