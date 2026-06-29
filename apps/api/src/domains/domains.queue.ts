import { createQueue, createWorker, getQueueMonitoringSnapshot, getQueuePolicySnapshot } from "@acme/queue";

export const DOMAIN_DNS_VERIFICATION_QUEUE = "domain-dns-verification";
export const DOMAIN_SSL_PROVISIONING_QUEUE = "domain-ssl-provisioning";
export const DOMAIN_SSL_STATUS_QUEUE = "domain-ssl-status";

export type DomainDnsVerificationJob = {
  domainId: string;
};

export function createDomainDnsVerificationQueue() {
  return createQueue(DOMAIN_DNS_VERIFICATION_QUEUE, "domain-dns-verification");
}

export function createDomainDnsVerificationWorker(
  processor: (job: { data: DomainDnsVerificationJob; id?: string }) => Promise<unknown>
) {
  return createWorker<DomainDnsVerificationJob>(
    DOMAIN_DNS_VERIFICATION_QUEUE,
    processor,
    "domain-dns-verification"
  );
}

export function createDomainSslProvisioningQueue() {
  return createQueue(DOMAIN_SSL_PROVISIONING_QUEUE, "domain-ssl-provisioning");
}

export function createDomainSslStatusQueue() {
  return createQueue(DOMAIN_SSL_STATUS_QUEUE, "domain-ssl-status");
}

export function createDomainSslProvisioningWorker(
  processor: (job: { data: DomainDnsVerificationJob; id?: string }) => Promise<unknown>
) {
  return createWorker<DomainDnsVerificationJob>(
    DOMAIN_SSL_PROVISIONING_QUEUE,
    processor,
    "domain-ssl-provisioning"
  );
}

export function createDomainSslStatusWorker(
  processor: (job: { data: DomainDnsVerificationJob; id?: string }) => Promise<unknown>
) {
  return createWorker<DomainDnsVerificationJob>(
    DOMAIN_SSL_STATUS_QUEUE,
    processor,
    "domain-ssl-status"
  );
}

export function getDomainQueuePolicySnapshots() {
  return [
    getQueuePolicySnapshot(DOMAIN_DNS_VERIFICATION_QUEUE, "domain-dns-verification"),
    getQueuePolicySnapshot(DOMAIN_SSL_PROVISIONING_QUEUE, "domain-ssl-provisioning"),
    getQueuePolicySnapshot(DOMAIN_SSL_STATUS_QUEUE, "domain-ssl-status")
  ];
}

export async function getDomainQueueMonitoring() {
  return [
    await getQueueMonitoringSnapshot(DOMAIN_DNS_VERIFICATION_QUEUE, "domain-dns-verification"),
    await getQueueMonitoringSnapshot(DOMAIN_SSL_PROVISIONING_QUEUE, "domain-ssl-provisioning"),
    await getQueueMonitoringSnapshot(DOMAIN_SSL_STATUS_QUEUE, "domain-ssl-status")
  ];
}
