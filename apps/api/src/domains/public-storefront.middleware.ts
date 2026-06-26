import {
  ForbiddenException,
  Injectable,
  NestMiddleware,
  NotFoundException
} from "@nestjs/common";
import { PublicStorefrontRequest } from "../auth/auth.types";
import { DomainsService } from "./domains.service";

@Injectable()
export class PublicStorefrontMiddleware implements NestMiddleware {
  constructor(private readonly domainsService: DomainsService) {}

  async use(request: PublicStorefrontRequest, _response: unknown, next: () => void) {
    const resolution = await this.domainsService.resolveHost(request);

    if (resolution.kind !== "storefront-store") {
      throw new NotFoundException({
        message: "No storefront store found for host",
        code: "STOREFRONT_HOST_NOT_RESOLVED",
        resolution
      });
    }

    this.assertStoreContextConsistency(request, resolution.storeId);

    request.publicStore = {
      storeId: resolution.storeId,
      storeSlug: resolution.storeSlug,
      source: resolution.source,
      matchedHost: resolution.matchedHost
    };

    next();
  }

  private assertStoreContextConsistency(
    request: PublicStorefrontRequest,
    resolvedStoreId: string
  ) {
    const candidates = [
      this.extractString(request.params?.storeId),
      this.extractString(request.body?.storeId),
      this.extractString(request.headers["x-store-id"]),
      this.extractString(request.query?.storeId)
    ].filter((value): value is string => value !== null);

    const conflictingStoreId = candidates.find((value) => value !== resolvedStoreId);

    if (conflictingStoreId) {
      throw new ForbiddenException({
        message: "Provided storeId does not match the resolved storefront host",
        code: "STOREFRONT_STORE_CONTEXT_CONFLICT",
        resolvedStoreId,
        conflictingStoreId
      });
    }
  }

  private extractString(value: unknown): string | null {
    if (Array.isArray(value)) {
      return this.extractString(value[0]);
    }

    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }

    return null;
  }
}
