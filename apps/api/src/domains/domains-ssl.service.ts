import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DomainProvisioningResult,
  DomainProvisioningStatusResult
} from "./domains-ssl.types";

@Injectable()
export class DomainsSslService {
  constructor(private readonly configService: ConfigService) {}

  async provisionDomain(input: {
    domainId: string;
    host: string;
  }): Promise<DomainProvisioningResult> {
    const provider = this.getProviderName();
    const externalId = `${provider.toLowerCase()}-${input.domainId}`;

    if (input.host.includes("ssl-error")) {
      return {
        externalId,
        status: "error",
        payload: {
          provider,
          host: input.host
        },
        errorMessage: "Provider rejected the custom hostname"
      };
    }

    return {
      externalId,
      status: "pending",
      payload: {
        provider,
        host: input.host,
        provisioningStage: "hostname-accepted"
      }
    };
  }

  async getProvisioningStatus(input: {
    externalId: string;
    host: string;
  }): Promise<DomainProvisioningStatusResult> {
    const provider = this.getProviderName();

    if (input.host.includes("ssl-error")) {
      return {
        status: "error",
        payload: {
          provider,
          externalId: input.externalId,
          host: input.host
        },
        errorMessage: "Certificate issuance failed"
      };
    }

    if (input.host.includes("ssl-pending")) {
      return {
        status: "pending",
        payload: {
          provider,
          externalId: input.externalId,
          host: input.host,
          provisioningStage: "certificate-pending"
        }
      };
    }

    return {
      status: "active",
      payload: {
        provider,
        externalId: input.externalId,
        host: input.host,
        provisioningStage: "certificate-active"
      }
    };
  }

  private getProviderName() {
    const domainsEnabled = this.configService.get<boolean>("DOMAINS_ENABLED") ?? false;
    const configuredProvider =
      this.configService.get<string>("DOMAIN_PROVIDER") ?? "CLOUDFLARE";

    if (!domainsEnabled) {
      return `LOCAL_${configuredProvider}`;
    }

    return configuredProvider;
  }
}
