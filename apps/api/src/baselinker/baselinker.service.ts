import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BaselinkerRepository } from "./baselinker.repository";
import { BaselinkerOrderSyncService } from "./baselinker-order-sync.service";
import { BaselinkerCatalogSyncService } from "./baselinker-catalog-sync.service";
import { BaselinkerClient } from "./baselinker.client";
import { encryptToken, decryptToken } from "./baselinker.crypto";
import { SaveBaselinkerConfigInput } from "./baselinker.schemas";

@Injectable()
export class BaselinkerService {
  constructor(
    private readonly repository: BaselinkerRepository,
    private readonly orderSyncService: BaselinkerOrderSyncService,
    private readonly catalogSyncService: BaselinkerCatalogSyncService,
    private readonly client: BaselinkerClient,
    private readonly configService: ConfigService
  ) {}

  private getEncryptionKey(): string | undefined {
    return this.configService.get<string>("BASELINKER_TOKEN_ENCRYPTION_KEY");
  }

  async getConfig(storeId: string) {
    const config = await this.repository.findConfig(storeId);
    if (!config) return null;
    return {
      configured: true,
      enabled: config.enabled,
      inventoryId: config.inventoryId,
      statusMappings: config.statusMappings,
      lastOrderImportAt: config.lastOrderImportAt,
      lastCatalogSyncAt: config.lastCatalogSyncAt,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    };
  }

  async saveConfig(storeId: string, input: SaveBaselinkerConfigInput) {
    const encryptionKey = this.getEncryptionKey();
    const tokenToStore = encryptionKey
      ? encryptToken(input.apiToken, encryptionKey)
      : input.apiToken;

    await this.repository.upsertConfig({
      storeId,
      apiToken: tokenToStore,
      inventoryId: input.inventoryId ?? null,
      enabled: input.enabled ?? true,
      statusMappings: input.statusMappings ?? null
    });

    return { success: true };
  }

  async deleteConfig(storeId: string) {
    await this.repository.deleteConfig(storeId);
    return { success: true };
  }

  async triggerOrderExport(storeId: string) {
    return this.orderSyncService.exportUnsyncedOrders(storeId);
  }

  async triggerOrderImport(storeId: string) {
    return this.orderSyncService.importOrdersFromBaselinker(storeId);
  }

  async triggerCatalogSync(storeId: string) {
    return this.catalogSyncService.syncCatalog(storeId);
  }

  async getSyncStatus(storeId: string) {
    return this.repository.listSyncRecords(storeId);
  }

  async getInventories(storeId: string) {
    return this.catalogSyncService.getInventories(storeId);
  }

  async testConnection(storeId: string): Promise<boolean> {
    const config = await this.repository.findConfig(storeId);
    if (!config) return false;

    try {
      const encryptionKey = this.getEncryptionKey();
      const token = encryptionKey
        ? decryptToken(config.apiToken, encryptionKey)
        : config.apiToken;

      await this.client.call<unknown>(token, "getOrders", {
        date_from: Math.floor(Date.now() / 1000) - 60
      });
      return true;
    } catch {
      return false;
    }
  }
}
