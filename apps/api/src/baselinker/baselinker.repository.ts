import { Injectable } from "@nestjs/common";
import { prisma } from "@acme/database";
import { BaselinkerSyncDirection } from "@prisma/client";

export type UpsertBaselinkerConfigInput = {
  storeId: string;
  apiToken: string;
  inventoryId?: number | null;
  enabled?: boolean;
  statusMappings?: Record<string, number> | null;
};

export type UpsertOrderSyncInput = {
  storeId: string;
  orderId?: string | null;
  baselinkerOrderId: number;
  direction: BaselinkerSyncDirection;
  lastStatus?: string | null;
  errorMessage?: string | null;
};

@Injectable()
export class BaselinkerRepository {
  async findConfig(storeId: string) {
    return prisma.storeBaselinkerConfig.findUnique({ where: { storeId } });
  }

  async upsertConfig(input: UpsertBaselinkerConfigInput) {
    const data = {
      apiToken: input.apiToken,
      inventoryId: input.inventoryId ?? null,
      enabled: input.enabled ?? true,
      statusMappings: input.statusMappings ?? undefined
    };

    return prisma.storeBaselinkerConfig.upsert({
      where: { storeId: input.storeId },
      create: { storeId: input.storeId, ...data },
      update: data
    });
  }

  async deleteConfig(storeId: string) {
    return prisma.storeBaselinkerConfig.delete({ where: { storeId } }).catch(() => null);
  }

  async updateLastOrderImportAt(storeId: string, date: Date) {
    return prisma.storeBaselinkerConfig.update({
      where: { storeId },
      data: { lastOrderImportAt: date }
    });
  }

  async updateLastCatalogSyncAt(storeId: string, date: Date) {
    return prisma.storeBaselinkerConfig.update({
      where: { storeId },
      data: { lastCatalogSyncAt: date }
    });
  }

  async findOrderSync(storeId: string, baselinkerOrderId: number) {
    return prisma.baselinkerOrderSync.findUnique({
      where: { storeId_baselinkerOrderId: { storeId, baselinkerOrderId } }
    });
  }

  async upsertOrderSync(input: UpsertOrderSyncInput) {
    const data = {
      orderId: input.orderId ?? null,
      direction: input.direction,
      lastStatus: input.lastStatus ?? null,
      errorMessage: input.errorMessage ?? null,
      lastSyncedAt: new Date()
    };

    return prisma.baselinkerOrderSync.upsert({
      where: {
        storeId_baselinkerOrderId: {
          storeId: input.storeId,
          baselinkerOrderId: input.baselinkerOrderId
        }
      },
      create: {
        storeId: input.storeId,
        baselinkerOrderId: input.baselinkerOrderId,
        ...data
      },
      update: data
    });
  }

  async listSyncRecords(storeId: string, direction?: BaselinkerSyncDirection) {
    return prisma.baselinkerOrderSync.findMany({
      where: { storeId, ...(direction ? { direction } : {}) },
      orderBy: { lastSyncedAt: "desc" },
      take: 100
    });
  }

  async findUnsyncedOrders(storeId: string) {
    return prisma.order.findMany({
      where: {
        storeId,
        baselinkerSyncs: {
          none: { direction: BaselinkerSyncDirection.EXPORT }
        }
      },
      include: { items: true, shipment: true },
      orderBy: { createdAt: "asc" },
      take: 50
    });
  }

  async findAllEnabledConfigs() {
    return prisma.storeBaselinkerConfig.findMany({ where: { enabled: true } });
  }

  async findProducts(storeId: string, updatedSince?: Date) {
    return prisma.product.findMany({
      where: {
        storeId,
        ...(updatedSince ? { updatedAt: { gt: updatedSince } } : {})
      },
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 }, category: true },
      orderBy: { updatedAt: "asc" },
      take: 100
    });
  }
}
