import { Injectable } from "@nestjs/common";
import {
  AuthFlowAuditAction,
  AuthFlowTokenPurpose,
  PlatformRole,
  StoreMemberRole,
  User
} from "@prisma/client";
import { prisma } from "@acme/database";
import { DomainBoundary } from "../platform/domain-boundary";

@Injectable()
export class AuthRepository {
  getBoundary(): DomainBoundary {
    return {
      module: "auth",
      description: "Identity, sessions, credentials and access entrypoints.",
      responsibilities: ["users", "sessions", "password credentials", "access tokens"],
      dependsOn: ["database", "config"]
    };
  }

  findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });
  }

  findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id }
    });
  }

  createUser(input: {
    email: string;
    passwordHash: string;
    fullName?: string;
    platformRole?: PlatformRole;
  }) {
    return prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        fullName: input.fullName,
        emailVerifiedAt: null,
        platformRole: input.platformRole
      }
    });
  }

  createMerchantOnboarding(input: {
    email: string;
    fullName: string;
    passwordHash: string;
    storeName: string;
    storeSlug: string;
    defaultSubdomain: string;
    supportEmail?: string;
    currencyCode?: string;
    locale?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          fullName: input.fullName,
          passwordHash: input.passwordHash,
          emailVerifiedAt: null,
          platformRole: PlatformRole.CUSTOMER
        }
      });

      const store = await tx.store.create({
        data: {
          name: input.storeName,
          slug: input.storeSlug,
          defaultSubdomain: input.defaultSubdomain,
          ownerId: user.id,
          supportEmail: input.supportEmail,
          currencyCode: input.currencyCode,
          locale: input.locale
        }
      });

      const membership = await tx.storeMember.create({
        data: {
          userId: user.id,
          storeId: store.id,
          role: StoreMemberRole.STORE_OWNER
        }
      });

      return { user, store, membership };
    });
  }

  updateRefreshTokenHash(userId: string, refreshTokenHash: string | null) {
    return prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash }
    });
  }

  updateUserCredentials(input: {
    userId: string;
    passwordHash?: string;
    refreshTokenHash?: string | null;
    emailVerifiedAt?: Date | null;
  }) {
    return prisma.user.update({
      where: {
        id: input.userId
      },
      data: {
        ...(input.passwordHash !== undefined ? { passwordHash: input.passwordHash } : {}),
        ...(input.refreshTokenHash !== undefined
          ? { refreshTokenHash: input.refreshTokenHash }
          : {}),
        ...(input.emailVerifiedAt !== undefined ? { emailVerifiedAt: input.emailVerifiedAt } : {})
      }
    });
  }

  invalidateActiveAuthFlowTokens(userId: string, purpose: AuthFlowTokenPurpose) {
    return prisma.authFlowToken.updateMany({
      where: {
        userId,
        purpose,
        consumedAt: null,
        invalidatedAt: null
      },
      data: {
        invalidatedAt: new Date()
      }
    });
  }

  createAuthFlowToken(input: {
    userId: string;
    purpose: AuthFlowTokenPurpose;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return prisma.authFlowToken.create({
      data: {
        userId: input.userId,
        purpose: input.purpose,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt
      }
    });
  }

  findActiveAuthFlowTokenByHash(tokenHash: string, purpose: AuthFlowTokenPurpose) {
    return prisma.authFlowToken.findFirst({
      where: {
        tokenHash,
        purpose,
        consumedAt: null,
        invalidatedAt: null
      },
      include: {
        user: true
      }
    });
  }

  consumeAuthFlowToken(tokenId: string) {
    return prisma.authFlowToken.update({
      where: {
        id: tokenId
      },
      data: {
        consumedAt: new Date()
      }
    });
  }

  touchAuthFlowTokenSentAt(tokenId: string) {
    return prisma.authFlowToken.update({
      where: {
        id: tokenId
      },
      data: {
        lastSentAt: new Date()
      }
    });
  }

  createAuthFlowAudit(input: {
    userId: string;
    tokenId?: string | null;
    action: AuthFlowAuditAction;
    purpose: AuthFlowTokenPurpose;
    success?: boolean;
    metadata?: string | null;
  }) {
    return prisma.authFlowAudit.create({
      data: {
        userId: input.userId,
        tokenId: input.tokenId ?? null,
        action: input.action,
        purpose: input.purpose,
        success: input.success ?? true,
        metadata: input.metadata ?? null
      }
    });
  }

  findStoreMembership(userId: string, storeId: string) {
    return prisma.storeMember.findUnique({
      where: {
        userId_storeId: {
          userId,
          storeId
        }
      }
    });
  }

  findStoreBySlugOrSubdomain(slug: string, defaultSubdomain: string) {
    return prisma.store.findFirst({
      where: {
        OR: [
          { slug },
          { defaultSubdomain }
        ]
      }
    });
  }

  listStoreMembershipsByUser(userId: string) {
    return prisma.storeMember.findMany({
      where: {
        userId
      },
      include: {
        store: true
      },
      orderBy: [{ createdAt: "asc" }]
    });
  }

  toAuthenticatedUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      emailVerifiedAt: user.emailVerifiedAt,
      platformRole: user.platformRole
    };
  }
}
