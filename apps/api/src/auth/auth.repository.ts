import { Injectable } from "@nestjs/common";
import { PlatformRole, StoreMemberRole, User } from "@prisma/client";
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
      platformRole: user.platformRole
    };
  }
}
