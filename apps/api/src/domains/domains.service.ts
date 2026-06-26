import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DomainsRepository } from "./domains.repository";
import { HostResolution } from "./host-resolution.types";

@Injectable()
export class DomainsService {
  constructor(
    private readonly domainsRepository: DomainsRepository,
    private readonly configService: ConfigService
  ) {}

  getBoundary() {
    return this.domainsRepository.getBoundary();
  }

  async resolveHost(request: {
    headers?: {
      host?: string;
      "x-forwarded-host"?: string;
    };
  }): Promise<HostResolution> {
    const forwardedHost = request.headers?.["x-forwarded-host"];
    const hostHeader = forwardedHost || request.headers?.host || "";
    const matchedHost = this.normalizeHost(hostHeader);

    if (!matchedHost) {
      return { kind: "unknown", matchedHost: "" };
    }

    const dashboardHost = this.extractHostname(
      this.configService.getOrThrow<string>("DASHBOARD_URL")
    );
    const apiHost = this.extractHostname(this.configService.getOrThrow<string>("API_URL"));
    const storefrontHost = this.extractHostname(
      this.configService.getOrThrow<string>("STOREFRONT_URL")
    );
    const marketplaceRootDomain = this.configService.getOrThrow<string>(
      "MARKETPLACE_ROOT_DOMAIN"
    );

    if (matchedHost === dashboardHost) {
      return { kind: "dashboard", matchedHost };
    }

    if (matchedHost === apiHost) {
      return { kind: "api", matchedHost };
    }

    if (matchedHost === storefrontHost) {
      return { kind: "storefront-root", matchedHost };
    }

    const customDomain = await this.domainsRepository.findActiveDomain(matchedHost);

    if (customDomain) {
      return {
        kind: "storefront-store",
        matchedHost,
        storeId: customDomain.store.id,
        storeSlug: customDomain.store.slug,
        source: "custom-domain"
      };
    }

    const rootSuffix = `.${marketplaceRootDomain.toLowerCase()}`;

    if (matchedHost.endsWith(rootSuffix)) {
      const defaultSubdomain = matchedHost.slice(0, -rootSuffix.length);

      if (defaultSubdomain) {
        const store = await this.domainsRepository.findStoreByDefaultSubdomain(defaultSubdomain);

        if (store) {
          return {
            kind: "storefront-store",
            matchedHost,
            storeId: store.id,
            storeSlug: store.slug,
            source: "subdomain"
          };
        }
      }
    }

    return { kind: "unknown", matchedHost };
  }

  private normalizeHost(host: string) {
    return host.toLowerCase().trim().replace(/:\d+$/, "");
  }

  private extractHostname(url: string) {
    return new URL(url).hostname.toLowerCase();
  }
}
