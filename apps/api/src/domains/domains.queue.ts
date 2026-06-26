import { createQueue, createWorker } from "@acme/queue";

export const DOMAIN_DNS_VERIFICATION_QUEUE = "domain-dns-verification";

export type DomainDnsVerificationJob = {
  domainId: string;
};

export function createDomainDnsVerificationQueue() {
  return createQueue(DOMAIN_DNS_VERIFICATION_QUEUE);
}

export function createDomainDnsVerificationWorker(
  processor: (job: { data: DomainDnsVerificationJob; id?: string }) => Promise<unknown>
) {
  return createWorker<DomainDnsVerificationJob>(
    DOMAIN_DNS_VERIFICATION_QUEUE,
    processor
  );
}
