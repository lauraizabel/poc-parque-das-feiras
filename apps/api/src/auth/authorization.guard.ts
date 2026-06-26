import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PlatformRole, StoreMemberRole } from "@prisma/client";
import { AuthRepository } from "./auth.repository";
import {
  PLATFORM_ROLES_KEY,
  STORE_ACCESS_KEY,
  STORE_ROLES_KEY
} from "./auth.constants";
import { AuthenticatedRequest } from "./auth.types";

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authRepository: AuthRepository
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException("Authentication context not found");
    }

    const requiredPlatformRoles = this.reflector.getAllAndOverride<PlatformRole[]>(
      PLATFORM_ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (
      requiredPlatformRoles?.length &&
      !requiredPlatformRoles.includes(user.platformRole)
    ) {
      throw new ForbiddenException({
        message: "Missing required platform role",
        code: "AUTH_PLATFORM_ROLE_FORBIDDEN",
        requiredPlatformRoles
      });
    }

    const storeAccessRequired = this.reflector.getAllAndOverride<boolean>(
      STORE_ACCESS_KEY,
      [context.getHandler(), context.getClass()]
    );
    const requiredStoreRoles = this.reflector.getAllAndOverride<StoreMemberRole[]>(
      STORE_ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!storeAccessRequired && !requiredStoreRoles?.length) {
      return true;
    }

    const storeId = this.resolveStoreId(request);

    if (!storeId) {
      throw new ForbiddenException({
        message: "storeId is required for this route",
        code: "AUTH_STORE_CONTEXT_REQUIRED"
      });
    }

    const membership = await this.authRepository.findStoreMembership(user.sub, storeId);

    if (!membership) {
      throw new ForbiddenException({
        message: "User does not belong to this store",
        code: "AUTH_STORE_MEMBERSHIP_REQUIRED",
        storeId
      });
    }

    request.storeContext = {
      storeId,
      membershipRole: membership.role
    };

    if (
      requiredStoreRoles?.length &&
      !requiredStoreRoles.includes(membership.role)
    ) {
      throw new ForbiddenException({
        message: "Missing required store role",
        code: "AUTH_STORE_ROLE_FORBIDDEN",
        storeId,
        requiredStoreRoles,
        currentRole: membership.role
      });
    }

    return true;
  }

  private resolveStoreId(request: AuthenticatedRequest) {
    const candidates = [
      {
        source: "params",
        value: this.extractString(request.params?.storeId)
      },
      {
        source: "body",
        value: this.extractString(request.body?.storeId)
      },
      {
        source: "query",
        value: this.extractString(request.query?.storeId)
      },
      {
        source: "headers",
        value: this.extractString(request.headers["x-store-id"])
      }
    ].filter((candidate): candidate is { source: string; value: string } =>
      candidate.value !== null
    );

    const uniqueStoreIds = [...new Set(candidates.map((candidate) => candidate.value))];

    if (uniqueStoreIds.length > 1) {
      throw new ForbiddenException({
        message: "Conflicting storeId values detected in request",
        code: "AUTH_STORE_CONTEXT_CONFLICT",
        providedStoreIds: candidates
      });
    }

    return uniqueStoreIds[0] ?? null;
  }

  private extractString(value: unknown) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }

    return null;
  }
}
