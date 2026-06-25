import { Injectable } from "@nestjs/common";
import { PlatformRole, User } from "@prisma/client";
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

  updateRefreshTokenHash(userId: string, refreshTokenHash: string | null) {
    return prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash }
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
