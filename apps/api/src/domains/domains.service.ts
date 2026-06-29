import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuditLogChannel, DomainStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { AuthenticatedUser } from "../auth/auth.types";
import { DomainsDnsService } from "./domains-dns.service";
import { DomainsSslService } from "./domains-ssl.service";
import { DomainsRepository } from "./domains.repository";
import { HostResolution } from "./host-resolution.types";
import { CreateStoreDomainInput } from "./domains.schemas";
import {
  createDomainDnsVerificationQueue,
  createDomainSslProvisioningQueue,
  createDomainSslStatusQueue
} from "./domains.queue";

const SSL_STATUS_RECHECK_DELAY_MS = 30_000;

@Injectable()
export class DomainsService {
  constructor(
    private readonly domainsRepository: DomainsRepository,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly domainsDnsResolver: DomainsDnsService,
    private readonly domainsSslService: DomainsSslService
  ) {}

  getBoundary() {
    return this.domainsRepository.getBoundary();
  }

  async getStoreDomain(storeId: string) {
    return {
      domain: await this.domainsRepository.findCustomDomainByStoreId(storeId)
    };
  }

  async createStoreDomain(actor: AuthenticatedUser, input: CreateStoreDomainInput) {
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

    if (existingDomain && existingDomain.status !== DomainStatus.REMOVED) {
      throw new ConflictException({
        message: "Domain host is already in use",
        code: "DOMAIN_HOST_ALREADY_IN_USE",
        host
      });
    }

    const existingStoreDomain = await this.domainsRepository.findCustomDomainByStoreId(input.storeId);

    if (existingStoreDomain && existingStoreDomain.status !== DomainStatus.REMOVED) {
      throw new ConflictException({
        message: "Store already has a custom domain",
        code: "STORE_CUSTOM_DOMAIN_ALREADY_EXISTS",
        host: existingStoreDomain.host
      });
    }

    const dnsTargetValue = `${store.defaultSubdomain}.${this.configService
      .getOrThrow<string>("MARKETPLACE_ROOT_DOMAIN")
      .toLowerCase()}`;

    const domain =
      existingStoreDomain?.status === DomainStatus.REMOVED
        ? await this.domainsRepository.reactivateCustomDomain({
            domainId: existingStoreDomain.id,
            host,
            dnsTargetValue
          })
        : await this.domainsRepository.createCustomDomain({
            host,
            storeId: input.storeId,
            dnsTargetValue
          });

    await this.enqueueDnsVerification(domain.id);

    await this.auditService.recordEvent({
      action: "domain.updated",
      channel: AuditLogChannel.HTTP_API,
      userId: actor.id,
      storeId: input.storeId,
      entityType: "STORE_DOMAIN",
      entityId: domain.id,
      payloadSummary: {
        source: "domains.create",
        host: domain.host,
        status: domain.status,
        dnsTargetValue: domain.dnsTargetValue
      }
    });

    return {
      domain
    };
  }

  async removeStoreDomain(actor: AuthenticatedUser, storeId: string) {
    const domain = await this.domainsRepository.findCustomDomainByStoreId(storeId);

    if (!domain) {
      throw new NotFoundException({
        message: "Store custom domain not found",
        code: "STORE_CUSTOM_DOMAIN_NOT_FOUND",
        storeId
      });
    }

    const removedDomain = await this.domainsRepository.markDomainRemoved(domain.id, {
      dnsErrorMessage: "Domain removed by store operator",
      sslErrorMessage: "SSL provisioning cleared after domain removal"
    });

    await this.auditService.recordEvent({
      action: "domain.updated",
      channel: AuditLogChannel.HTTP_API,
      userId: actor.id,
      storeId,
      entityType: "STORE_DOMAIN",
      entityId: removedDomain.id,
      payloadSummary: {
        source: "domains.remove",
        host: removedDomain.host,
        status: removedDomain.status
      }
    });

    return {
      removed: true,
      domain: removedDomain
    };
  }

  async verifyStoreDomainDns(storeId: string) {
    const domain = await this.domainsRepository.findCustomDomainByStoreId(storeId);

    if (!domain) {
      throw new NotFoundException({
        message: "Store custom domain not found",
        code: "STORE_CUSTOM_DOMAIN_NOT_FOUND",
        storeId
      });
    }

    return this.enqueueDnsVerification(domain.id);
  }

  async syncStoreDomainSsl(storeId: string) {
    const domain = await this.domainsRepository.findCustomDomainByStoreId(storeId);

    if (!domain) {
      throw new NotFoundException({
        message: "Store custom domain not found",
        code: "STORE_CUSTOM_DOMAIN_NOT_FOUND",
        storeId
      });
    }

    return this.enqueueSslStatusSync(domain.id);
  }

  async enqueueDnsVerification(domainId: string) {
    const queue = createDomainDnsVerificationQueue();

    try {
      const domain = await this.domainsRepository.findDomainById(domainId);

      if (!domain) {
        throw new NotFoundException({
          message: "Domain not found",
          code: "DOMAIN_NOT_FOUND",
          domainId
        });
      }

      await this.domainsRepository.updateDomainDnsStatus(domainId, {
        status: DomainStatus.VERIFYING,
        dnsLastCheckedAt: new Date(),
        dnsErrorMessage: null
      });

      const job = await queue.add("verify-domain-dns", {
        domainId
      });

      return {
        queued: true,
        jobId: job.id ?? null,
        domainId
      };
    } finally {
      await queue.close();
    }
  }

  async processDnsVerificationJob(domainId: string) {
    const domain = await this.domainsRepository.findDomainById(domainId);

    if (!domain) {
      throw new NotFoundException({
        message: "Domain not found",
        code: "DOMAIN_NOT_FOUND",
        domainId
      });
    }

    const checkedAt = new Date();

    try {
      const dnsResult = await this.domainsDnsResolver.resolveCname(domain.host);
      const expectedTarget = this.normalizeDnsTarget(domain.dnsTargetValue);
      const configuredTarget = this.normalizeDnsTarget(dnsResult.configuredTarget);

      if (expectedTarget && configuredTarget === expectedTarget) {
        const updatedDomain = await this.domainsRepository.updateDomainDnsStatus(domainId, {
          status: DomainStatus.SSL_PENDING,
          dnsConfiguredValue: configuredTarget,
          dnsLastCheckedAt: checkedAt,
          dnsVerifiedAt: checkedAt,
          dnsErrorMessage: null
        });

        await this.enqueueSslProvisioning(domainId);
        return updatedDomain;
      }

      return this.domainsRepository.updateDomainDnsStatus(domainId, {
        status: DomainStatus.AWAITING_DNS,
        dnsConfiguredValue: configuredTarget,
        dnsLastCheckedAt: checkedAt,
        dnsVerifiedAt: null,
        dnsErrorMessage: configuredTarget
          ? `CNAME mismatch: expected ${expectedTarget}, received ${configuredTarget}`
          : "No CNAME record found for this host"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown DNS verification error";

      await this.domainsRepository.updateDomainDnsStatus(domainId, {
        status: DomainStatus.ERROR,
        dnsConfiguredValue: null,
        dnsLastCheckedAt: checkedAt,
        dnsVerifiedAt: null,
        dnsErrorMessage: message
      });

      throw error;
    }
  }

  async enqueueSslProvisioning(domainId: string) {
    const queue = createDomainSslProvisioningQueue();

    try {
      const domain = await this.domainsRepository.findDomainById(domainId);

      if (!domain) {
        throw new NotFoundException({
          message: "Domain not found",
          code: "DOMAIN_NOT_FOUND",
          domainId
        });
      }

      const job = await queue.add("provision-domain-ssl", {
        domainId
      });

      return {
        queued: true,
        jobId: job.id ?? null,
        domainId
      };
    } finally {
      await queue.close();
    }
  }

  async enqueueSslStatusSync(domainId: string, delayMs = 0) {
    const queue = createDomainSslStatusQueue();

    try {
      const domain = await this.domainsRepository.findDomainById(domainId);

      if (!domain) {
        throw new NotFoundException({
          message: "Domain not found",
          code: "DOMAIN_NOT_FOUND",
          domainId
        });
      }

      const job = await queue.add(
        "sync-domain-ssl-status",
        {
          domainId
        },
        {
          delay: delayMs
        }
      );

      return {
        queued: true,
        jobId: job.id ?? null,
        domainId
      };
    } finally {
      await queue.close();
    }
  }

  async processSslProvisioningJob(domainId: string) {
    const domain = await this.domainsRepository.findDomainById(domainId);

    if (!domain) {
      throw new NotFoundException({
        message: "Domain not found",
        code: "DOMAIN_NOT_FOUND",
        domainId
      });
    }

    const checkedAt = new Date();
    const result = await this.domainsSslService.provisionDomain({
      domainId: domain.id,
      host: domain.host
    });

    const provisioningMetadata = JSON.stringify(result.payload ?? {});

    if (result.status === "active") {
      return this.domainsRepository.updateDomainSslStatus(domainId, {
        status: DomainStatus.ACTIVE,
        sslProvisioningId: result.externalId,
        sslProvisioningMetadata: provisioningMetadata,
        sslLastCheckedAt: checkedAt,
        sslIssuedAt: checkedAt,
        sslErrorMessage: null,
        activatedAt: checkedAt
      });
    }

    if (result.status === "error") {
      return this.domainsRepository.updateDomainSslStatus(domainId, {
        status: DomainStatus.ERROR,
        sslProvisioningId: result.externalId,
        sslProvisioningMetadata: provisioningMetadata,
        sslLastCheckedAt: checkedAt,
        sslIssuedAt: null,
        sslErrorMessage: result.errorMessage ?? "SSL provisioning failed",
        activatedAt: null
      });
    }

    const updatedDomain = await this.domainsRepository.updateDomainSslStatus(domainId, {
      status: DomainStatus.SSL_PENDING,
      sslProvisioningId: result.externalId,
      sslProvisioningMetadata: provisioningMetadata,
      sslLastCheckedAt: checkedAt,
      sslIssuedAt: null,
      sslErrorMessage: null,
      activatedAt: null
    });

    await this.enqueueSslStatusSync(domainId);
    return updatedDomain;
  }

  async processSslStatusSyncJob(domainId: string) {
    const domain = await this.domainsRepository.findDomainById(domainId);

    if (!domain) {
      throw new NotFoundException({
        message: "Domain not found",
        code: "DOMAIN_NOT_FOUND",
        domainId
      });
    }

    if (!domain.sslProvisioningId) {
      throw new BadRequestException({
        message: "SSL provisioning was not started for this domain",
        code: "DOMAIN_SSL_PROVISIONING_MISSING",
        domainId
      });
    }

    const checkedAt = new Date();
    const result = await this.domainsSslService.getProvisioningStatus({
      externalId: domain.sslProvisioningId,
      host: domain.host
    });
    const provisioningMetadata = JSON.stringify(result.payload ?? {});

    if (result.status === "active") {
      return this.domainsRepository.updateDomainSslStatus(domainId, {
        status: DomainStatus.ACTIVE,
        sslProvisioningId: domain.sslProvisioningId,
        sslProvisioningMetadata: provisioningMetadata,
        sslLastCheckedAt: checkedAt,
        sslIssuedAt: checkedAt,
        sslErrorMessage: null,
        activatedAt: checkedAt
      });
    }

    if (result.status === "error") {
      return this.domainsRepository.updateDomainSslStatus(domainId, {
        status: DomainStatus.ERROR,
        sslProvisioningId: domain.sslProvisioningId,
        sslProvisioningMetadata: provisioningMetadata,
        sslLastCheckedAt: checkedAt,
        sslIssuedAt: null,
        sslErrorMessage: result.errorMessage ?? "SSL provisioning failed",
        activatedAt: null
      });
    }

    const updatedDomain = await this.domainsRepository.updateDomainSslStatus(domainId, {
      status: DomainStatus.SSL_PENDING,
      sslProvisioningId: domain.sslProvisioningId,
      sslProvisioningMetadata: provisioningMetadata,
      sslLastCheckedAt: checkedAt,
      sslIssuedAt: null,
      sslErrorMessage: null,
      activatedAt: null
    });

    await this.enqueueSslStatusSync(domainId, SSL_STATUS_RECHECK_DELAY_MS);
    return updatedDomain;
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

  private normalizeDnsTarget(value: string | null | undefined) {
    return value ? value.toLowerCase().replace(/\.+$/, "") : null;
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
