import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DomainsRepository } from "./domains.repository";
import { HostResolution } from "./host-resolution.types";
import { CreateStoreDomainInput } from "./domains.schemas";

@Injectable()
export class DomainsService {
  constructor(
    private readonly domainsRepository: DomainsRepository,
    private readonly configService: ConfigService
  ) {}

  getBoundary() {
    return this.domainsRepository.getBoundary();
  }

  async getStoreDomain(storeId: string) {
    return {
      domain: await this.domainsRepository.findCustomDomainByStoreId(storeId)
    };
  }

  async createStoreDomain(input: CreateStoreDomainInput) {
    const store = await this.domainsRepository.findStoreById(input.storeId);

    if (!store) {
      throw new NotFoundException({
        message: "Store not found",
        code: "STORE_NOT_FOUND",
        storeId: input.storeId
      });
    }

    const host = this.normalizeCustomDomainHost(input.host);
    const existingDomain = await this.domainsRepository.findDomainByHost(host);

    if (existingDomain) {
      throw new ConflictException({
        message: "Domain host is already in use",
        code: "DOMAIN_HOST_ALREADY_IN_USE",
        host
      });
    }

    const existingStoreDomain = await this.domainsRepository.findCustomDomainByStoreId(
      input.storeId
    );

    if (existingStoreDomain) {
      throw new ConflictException({
        message: "Store already has a custom domain",
        code: "STORE_CUSTOM_DOMAIN_ALREADY_EXISTS",
        host: existingStoreDomain.host
      });
    }

    const dnsTargetValue = `${store.defaultSubdomain}.${this.configService
      .getOrThrow<string>("MARKETPLACE_ROOT_DOMAIN")
      .toLowerCase()}`;

    const domain = await this.domainsRepository.createCustomDomain({
      host,
      storeId: input.storeId,
      dnsTargetValue
    });

    return {
      domain
    };
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

  private normalizeCustomDomainHost(input: string) {
    const candidate = input.trim().toLowerCase();

    if (!candidate) {
      throw new BadRequestException({
        message: "Domain host is required",
        code: "DOMAIN_HOST_REQUIRED"
      });
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(
        candidate.startsWith("http://") || candidate.startsWith("https://")
          ? candidate
          : `https://${candidate}`
      );
    } catch {
      throw new BadRequestException({
        message: "Domain host is invalid",
        code: "DOMAIN_HOST_INVALID"
      });
    }

    const hostname = parsedUrl.hostname.toLowerCase().replace(/\.+$/, "");

    if (
      parsedUrl.username ||
      parsedUrl.password ||
      parsedUrl.port ||
      (parsedUrl.pathname && parsedUrl.pathname !== "/") ||
      parsedUrl.search ||
      parsedUrl.hash
    ) {
      throw new BadRequestException({
        message: "Domain host must contain only the host name",
        code: "DOMAIN_HOST_INVALID_FORMAT"
      });
    }

    if (hostname === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
      throw new BadRequestException({
        message: "Domain host must be a public hostname",
        code: "DOMAIN_HOST_INVALID"
      });
    }

    const labels = hostname.split(".");

    if (
      labels.length < 2 ||
      labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
    ) {
      throw new BadRequestException({
        message: "Domain host is invalid",
        code: "DOMAIN_HOST_INVALID"
      });
    }

    if (labels[0] !== "www") {
      throw new BadRequestException({
        message: "Only www custom domains are supported in the MVP",
        code: "DOMAIN_HOST_WWW_REQUIRED"
      });
    }

    if (labels.length < 3) {
      throw new BadRequestException({
        message: "Domain host is invalid",
        code: "DOMAIN_HOST_INVALID"
      });
    }

    const marketplaceRootDomain = this.configService
      .getOrThrow<string>("MARKETPLACE_ROOT_DOMAIN")
      .toLowerCase();

    if (hostname.endsWith(`.${marketplaceRootDomain}`) || hostname === marketplaceRootDomain) {
      throw new BadRequestException({
        message: "Marketplace hosts cannot be registered as custom domains",
        code: "DOMAIN_HOST_RESERVED"
      });
    }

    return hostname;
  }
}
