import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { prisma } from "@acme/database";
import { BaselinkerSyncDirection, Order, OrderItem, Shipment } from "@prisma/client";
import { BaselinkerClient } from "./baselinker.client";
import { BaselinkerRepository } from "./baselinker.repository";
import { decryptToken } from "./baselinker.crypto";

type OrderWithRelations = Order & {
  items: OrderItem[];
  shipment: Shipment | null;
};

type BaselinkerAddOrderResponse = {
  order_id: number;
};

type BaselinkerGetOrdersResponse = {
  orders: BaselinkerExternalOrder[];
};

type BaselinkerExternalOrder = {
  order_id: number;
  order_status_id: number;
  date_add: number;
  currency: string;
  email: string;
};

@Injectable()
export class BaselinkerOrderSyncService {
  private readonly logger = new Logger(BaselinkerOrderSyncService.name);

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

  async exportUnsyncedOrders(storeId: string): Promise<{ exported: number; errors: number }> {
    const config = await this.repository.findConfig(storeId);
    if (!config?.enabled) return { exported: 0, errors: 0 };

    const orders = await this.repository.findUnsyncedOrders(storeId);
    const token = this.resolveToken(config.apiToken);
    const statusMappings = (config.statusMappings ?? {}) as Record<string, number>;

    let exported = 0;
    let errors = 0;

    for (const order of orders) {
      try {
        const baselinkerOrderId = await this.pushOrderToBaselinker(token, order, statusMappings);
        await this.repository.upsertOrderSync({
          storeId,
          orderId: order.id,
          baselinkerOrderId,
          direction: BaselinkerSyncDirection.EXPORT,
          lastStatus: order.status
        });
        exported++;
      } catch (err) {
        this.logger.error(`Failed to export order ${order.id}: ${(err as Error).message}`);
        errors++;
      }
    }

    return { exported, errors };
  }

  async syncOrderStatus(storeId: string, orderId: string, orderStatus: string): Promise<void> {
    const config = await this.repository.findConfig(storeId);
    if (!config?.enabled) return;

    const statusMappings = (config.statusMappings ?? {}) as Record<string, number>;
    const baselinkerStatusId = statusMappings[orderStatus];
    if (!baselinkerStatusId) return;

    const sync = await prisma.baselinkerOrderSync.findFirst({
      where: { storeId, orderId, direction: BaselinkerSyncDirection.EXPORT }
    });
    if (!sync) return;

    const token = this.resolveToken(config.apiToken);

    await this.client.call<unknown>(token, "setOrderStatus", {
      order_id: sync.baselinkerOrderId,
      status_id: baselinkerStatusId
    });

    await this.repository.upsertOrderSync({
      storeId,
      orderId,
      baselinkerOrderId: sync.baselinkerOrderId,
      direction: BaselinkerSyncDirection.EXPORT,
      lastStatus: orderStatus
    });
  }

  async importOrdersFromBaselinker(storeId: string): Promise<{ imported: number; errors: number }> {
    const config = await this.repository.findConfig(storeId);
    if (!config?.enabled) return { imported: 0, errors: 0 };

    const token = this.resolveToken(config.apiToken);
    const dateFrom = config.lastOrderImportAt
      ? Math.floor(config.lastOrderImportAt.getTime() / 1000)
      : Math.floor(Date.now() / 1000) - 7 * 24 * 3600;

    const response = await this.client.call<BaselinkerGetOrdersResponse>(token, "getOrders", {
      date_from: dateFrom,
      get_unconfirmed_orders: false
    });

    const orders = response.orders ?? [];
    let imported = 0;
    let errors = 0;

    for (const blOrder of orders) {
      try {
        const existing = await this.repository.findOrderSync(storeId, blOrder.order_id);
        if (existing) continue;

        await this.repository.upsertOrderSync({
          storeId,
          orderId: null,
          baselinkerOrderId: blOrder.order_id,
          direction: BaselinkerSyncDirection.IMPORT,
          lastStatus: String(blOrder.order_status_id)
        });

        imported++;
      } catch (err) {
        this.logger.error(
          `Failed to import BL order ${blOrder.order_id}: ${(err as Error).message}`
        );
        errors++;
      }
    }

    await this.repository.updateLastOrderImportAt(storeId, new Date());
    return { imported, errors };
  }

  private async pushOrderToBaselinker(
    token: string,
    order: OrderWithRelations,
    statusMappings: Record<string, number>
  ): Promise<number> {
    const products = order.items.map((item) => ({
      storage: "db",
      storage_id: 0,
      product_id: item.productId ?? "",
      variant_id: 0,
      name: item.productName,
      sku: item.sku ?? item.variantSku ?? "",
      ean: "",
      location: "",
      warehouse_id: 0,
      attributes: item.variantName ?? "",
      price_brutto: item.unitPriceCents / 100,
      tax_rate: 0,
      quantity: item.quantity,
      weight: 0
    }));

    const statusId = statusMappings[order.status] ?? 0;

    const response = await this.client.call<BaselinkerAddOrderResponse>(token, "addOrder", {
      order_status_id: statusId,
      custom_source_id: 0,
      date_add: Math.floor(order.createdAt.getTime() / 1000),
      currency: order.currencyCode,
      payment_method: "online",
      payment_method_cod: false,
      payment_done: 0,
      delivery_method: order.shipment?.shippingMethodName ?? "",
      delivery_price: order.shippingCents / 100,
      delivery_package_module: "",
      delivery_package_nr: order.shipment?.trackingCode ?? "",
      delivery_fullname: order.shippingRecipientName ?? order.customerFullName ?? "",
      delivery_company: "",
      delivery_address: [order.shippingStreet, order.shippingNumber, order.shippingComplement]
        .filter(Boolean)
        .join(", "),
      delivery_city: order.shippingCity ?? "",
      delivery_state: order.shippingState ?? "",
      delivery_postcode: order.shippingPostalCode ?? "",
      delivery_country_code: "BR",
      delivery_point_id: "",
      delivery_point_name: "",
      delivery_point_address: "",
      delivery_point_postcode: "",
      delivery_point_city: "",
      invoice_fullname: order.billingRecipientName ?? order.customerFullName ?? "",
      invoice_company: "",
      invoice_nip: "",
      invoice_address: [order.billingStreet, order.billingNumber, order.billingComplement]
        .filter(Boolean)
        .join(", "),
      invoice_city: order.billingCity ?? "",
      invoice_state: order.billingState ?? "",
      invoice_postcode: order.billingPostalCode ?? "",
      invoice_country_code: "BR",
      invoice_point_id: "",
      invoice_point_name: "",
      invoice_point_address: "",
      want_invoice: false,
      email: order.customerEmail,
      phone: order.customerPhoneNumber ?? order.shippingPhoneNumber ?? "",
      user_comments: order.notes ?? "",
      admin_comments: "",
      extra_field_1: order.id,
      extra_field_2: order.storeId,
      products
    });

    return response.order_id;
  }
}
