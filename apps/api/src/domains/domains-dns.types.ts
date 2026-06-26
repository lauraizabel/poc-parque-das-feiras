export type DnsLookupResult = {
  configuredTarget: string | null;
};

export interface DomainDnsResolver {
  resolveCname(host: string): Promise<DnsLookupResult>;
}
