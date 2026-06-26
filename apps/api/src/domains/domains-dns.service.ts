import { resolveCname } from "node:dns/promises";
import { Injectable } from "@nestjs/common";
import { DnsLookupResult, DomainDnsResolver } from "./domains-dns.types";

@Injectable()
export class DomainsDnsService implements DomainDnsResolver {
  async resolveCname(host: string): Promise<DnsLookupResult> {
    const records = await resolveCname(host);
    const firstRecord = records[0];

    return {
      configuredTarget: firstRecord ? this.normalizeTarget(firstRecord) : null
    };
  }

  private normalizeTarget(value: string) {
    return value.toLowerCase().replace(/\.+$/, "");
  }
}
