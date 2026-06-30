import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { prisma } from "@acme/database";
import { BaselinkerClient } from "./baselinker.client";
import { BaselinkerRepository } from "./baselinker.repository";
import { decryptToken } from "./baselinker.crypto";
import { BaselinkerSyncDirection } from "@prisma/client";

type BaselinkerCouriersResponse = {
  couriers: Array<{ courier_code: string; courier_name: string }>;
};

type BaselinkerCreatePackageResponse = {
  package_id: number;
  package_number: string;
};

type BaselinkerGetLabelResponse = {
  label: string;
  label_type: string;
};

@Injectable()
export class BaselinkerShippingService {
  private readonly logger = new Logger(BaselinkerShippingService.name);

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

  async getCouriers(storeId: string) {
    const config = await this.repository.findConfig(storeId);
    if (!config?.enabled) return [];

    const token = this.resolveToken(config.apiToken);
    const response = await this.client.call<BaselinkerCouriersResponse>(
      token,
      "getCouriersList",
      {}
    );
    return response.couriers ?? [];
  }

  async generateShippingLabel(
    storeId: string,
    orderId: string,
    courierCode: string,
    extraFields?: Record<string, string>
  ): Promise<{ packageId: number; trackingNumber: string; labelUrl: string }> {
    const config = await this.repository.findConfig(storeId);
    if (!config?.enabled) {
      throw new NotFoundException("BaseLinker integration not configured for this store");
    }

    const sync = await prisma.baselinkerOrderSync.findFirst({
      where: { storeId, orderId, direction: BaselinkerSyncDirection.EXPORT }
    });

    if (!sync) {
      throw new NotFoundException(`Order ${orderId} has not been synced to BaseLinker yet`);
    }

    const token = this.resolveToken(config.apiToken);

    const packageResponse = await this.client.call<BaselinkerCreatePackageResponse>(
      token,
      "createPackage",
      {
        order_id: sync.baselinkerOrderId,
        courier_code: courierCode,
        ...(extraFields ?? {})
      }
    );

    const labelResponse = await this.client.call<BaselinkerGetLabelResponse>(token, "getLabel", {
      courier_code: courierCode,
      package_id: packageResponse.package_id
    });

    const labelUrl = labelResponse.label ?? "";
    const trackingNumber = packageResponse.package_number;

    await prisma.shipment.updateMany({
      where: { orderId, storeId },
      data: {
        carrierName: courierCode,
        trackingCode: trackingNumber,
        labelUrl
      }
    });

    this.logger.log(
      `Generated shipping label for order ${orderId}, tracking: ${trackingNumber}`
    );

    return {
      packageId: packageResponse.package_id,
      trackingNumber,
      labelUrl
    };
  }
}
