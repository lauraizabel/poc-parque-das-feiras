import { createQueue, createWorker } from "@acme/queue";

export const DOMAIN_DNS_VERIFICATION_QUEUE = "domain-dns-verification";
export const DOMAIN_SSL_PROVISIONING_QUEUE = "domain-ssl-provisioning";
export const DOMAIN_SSL_STATUS_QUEUE = "domain-ssl-status";

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

export function createDomainSslProvisioningQueue() {
  return createQueue(DOMAIN_SSL_PROVISIONING_QUEUE);
}

export function createDomainSslStatusQueue() {
  return createQueue(DOMAIN_SSL_STATUS_QUEUE);
}

export function createDomainSslProvisioningWorker(
  processor: (job: { data: DomainDnsVerificationJob; id?: string }) => Promise<unknown>
) {
  return createWorker<DomainDnsVerificationJob>(DOMAIN_SSL_PROVISIONING_QUEUE, processor);
}

export function createDomainSslStatusWorker(
  processor: (job: { data: DomainDnsVerificationJob; id?: string }) => Promise<unknown>
) {
  return createWorker<DomainDnsVerificationJob>(DOMAIN_SSL_STATUS_QUEUE, processor);
}
