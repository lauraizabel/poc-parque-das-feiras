import { createQueue, createWorker, getQueueMonitoringSnapshot, getQueuePolicySnapshot } from "@acme/queue";

export const BASELINKER_ORDER_EXPORT_QUEUE = "baselinker-order-export";
export const BASELINKER_ORDER_IMPORT_QUEUE = "baselinker-order-import";
export const BASELINKER_CATALOG_SYNC_QUEUE = "baselinker-catalog-sync";
export const BASELINKER_SHIPPING_LABEL_QUEUE = "baselinker-shipping-label";

export type BaselinkerOrderExportJob = { storeId: string };
export type BaselinkerOrderImportJob = { storeId: string };
export type BaselinkerCatalogSyncJob = { storeId: string };
export type BaselinkerShippingLabelJob = {
  storeId: string;
  orderId: string;
  courierCode: string;
  extraFields?: Record<string, string>;
};

export function createOrderExportQueue() {
  return createQueue(BASELINKER_ORDER_EXPORT_QUEUE, "baselinker-order-export");
}

export function createOrderImportQueue() {
  return createQueue(BASELINKER_ORDER_IMPORT_QUEUE, "baselinker-order-import");
}

export function createCatalogSyncQueue() {
  return createQueue(BASELINKER_CATALOG_SYNC_QUEUE, "baselinker-catalog-sync");
}

export function createShippingLabelQueue() {
  return createQueue(BASELINKER_SHIPPING_LABEL_QUEUE, "baselinker-shipping-label");
}

export function createOrderExportWorker(
  processor: (job: { data: BaselinkerOrderExportJob; id?: string }) => Promise<unknown>
) {
  return createWorker<BaselinkerOrderExportJob>(
    BASELINKER_ORDER_EXPORT_QUEUE,
    processor,
    "baselinker-order-export"
  );
}

export function createOrderImportWorker(
  processor: (job: { data: BaselinkerOrderImportJob; id?: string }) => Promise<unknown>
) {
  return createWorker<BaselinkerOrderImportJob>(
    BASELINKER_ORDER_IMPORT_QUEUE,
    processor,
    "baselinker-order-import"
  );
}

export function createCatalogSyncWorker(
  processor: (job: { data: BaselinkerCatalogSyncJob; id?: string }) => Promise<unknown>
) {
  return createWorker<BaselinkerCatalogSyncJob>(
    BASELINKER_CATALOG_SYNC_QUEUE,
    processor,
    "baselinker-catalog-sync"
  );
}

export function createShippingLabelWorker(
  processor: (job: { data: BaselinkerShippingLabelJob; id?: string }) => Promise<unknown>
) {
  return createWorker<BaselinkerShippingLabelJob>(
    BASELINKER_SHIPPING_LABEL_QUEUE,
    processor,
    "baselinker-shipping-label"
  );
}

export async function getBaselinkerQueuesMonitoring() {
  return Promise.all([
    getQueueMonitoringSnapshot(BASELINKER_ORDER_EXPORT_QUEUE, "baselinker-order-export"),
    getQueueMonitoringSnapshot(BASELINKER_ORDER_IMPORT_QUEUE, "baselinker-order-import"),
    getQueueMonitoringSnapshot(BASELINKER_CATALOG_SYNC_QUEUE, "baselinker-catalog-sync"),
    getQueueMonitoringSnapshot(BASELINKER_SHIPPING_LABEL_QUEUE, "baselinker-shipping-label")
  ]);
}
