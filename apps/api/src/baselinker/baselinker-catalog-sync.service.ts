import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BaselinkerClient } from "./baselinker.client";
import { BaselinkerRepository } from "./baselinker.repository";
import { decryptToken } from "./baselinker.crypto";

type BaselinkerInventoriesResponse = {
  inventories: Array<{ inventory_id: number; name: string }>;
};

@Injectable()
export class BaselinkerCatalogSyncService {
  private readonly logger = new Logger(BaselinkerCatalogSyncService.name);

  constructor(
    private readonly client: BaselinkerClient,
    private readonly repository: BaselinkerRepository,
    private readonly configService: ConfigService
  ) {}

  private resolveToken(storedToken: string): string {
    const encryptionKey = this.configService.get<string>("BASELINKER_TOKEN_ENCRYPTION_KEY");
    if (encryptionKey) return decryptToken(storedToken, encryptionKey);
    return storedToken;
  }

  async syncCatalog(storeId: string): Promise<{ synced: number; errors: number }> {
    const config = await this.repository.findConfig(storeId);
    if (!config?.enabled || !config.inventoryId) {
      this.logger.warn(`BaseLinker catalog sync skipped for store ${storeId}: no inventoryId set`);
      return { synced: 0, errors: 0 };
    }

    const token = this.resolveToken(config.apiToken);
    const products = await this.repository.findProducts(storeId, config.lastCatalogSyncAt ?? undefined);

    let synced = 0;
    let errors = 0;

    for (const product of products) {
      try {
        await this.client.call<unknown>(token, "addInventoryProduct", {
          inventory_id: config.inventoryId,
          product_id: product.id,
          ean: "",
          sku: product.sku ?? "",
          tax_rate: 0,
          weight: 0,
          height: 0,
          width: 0,
          length: 0,
          star: 0,
          manufacturer_id: 0,
          category_id: 0,
          prices: { 1: product.priceCents / 100 },
          stock: { "bl_1": product.stockQuantity },
          locations: {},
          images: product.images[0]?.imageUrl
            ? { 1: product.images[0].imageUrl }
            : {},
          links: {},
          description: product.description ?? "",
          description_extra1: "",
          description_extra2: "",
          description_extra3: "",
          description_extra4: "",
          name: product.name,
          additional_images: {},
          attributes: {},
          text_fields: {
            name: product.name,
            description: product.description ?? ""
          }
        });
        synced++;
      } catch (err) {
        this.logger.error(`Failed to sync product ${product.id}: ${(err as Error).message}`);
        errors++;
      }
    }

    await this.repository.updateLastCatalogSyncAt(storeId, new Date());
    return { synced, errors };
  }

  async getInventories(storeId: string) {
    const config = await this.repository.findConfig(storeId);
    if (!config?.enabled) return [];

    const token = this.resolveToken(config.apiToken);
    const response = await this.client.call<BaselinkerInventoriesResponse>(
      token,
      "getInventories",
      {}
    );
    return response.inventories ?? [];
  }
}
