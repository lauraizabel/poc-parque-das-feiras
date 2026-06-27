import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PlatformRole } from "@prisma/client";
import { AuthRepository } from "./auth.repository";
import {
  LoginInput,
  RefreshInput,
  RegisterInput,
  RegisterMerchantInput
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

    return this.issueAuthSession(user.id, user.email, user.platformRole, user.fullName);
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

    const session = await this.issueAuthSession(
      onboarding.user.id,
      onboarding.user.email,
      onboarding.user.platformRole,
      onboarding.user.fullName
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
