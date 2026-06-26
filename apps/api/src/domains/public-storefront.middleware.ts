import {
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

    request.publicStore = {
      storeId: resolution.storeId,
      storeSlug: resolution.storeSlug,
      source: resolution.source,
      matchedHost: resolution.matchedHost
    };

    next();
  }
}
