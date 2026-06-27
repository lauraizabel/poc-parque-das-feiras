import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ShipmentStatus, ShippingMethodStatus, ShippingMethodType } from "@prisma/client";
import { OrdersRepository } from "../orders/orders.repository";
import { ShippingRepository } from "./shipping.repository";
import {
  CreateShipmentInput,
  CreateShippingMethodInput,
  UpdateShippingMethodInput
} from "./shipping.schemas";

@Injectable()
export class ShippingService {
  constructor(
    private readonly shippingRepository: ShippingRepository,
    private readonly ordersRepository: OrdersRepository
  ) {}

  getBoundary() {
    return this.shippingRepository.getBoundary();
  }

  async listStoreShippingMethods(storeId: string) {
    return {
      shippingMethods: await this.shippingRepository.listShippingMethodsByStore(storeId)
    };
  }

  async createShippingMethod(input: CreateShippingMethodInput) {
    this.assertShippingMethodWindow(input.estimatedDaysMin ?? null, input.estimatedDaysMax ?? null);
    this.assertOrderBand(input.minimumOrderCents ?? null, input.maximumOrderCents ?? null);

    return {
      shippingMethod: await this.shippingRepository.createShippingMethod({
        storeId: input.storeId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        type: input.type,
        status: input.status ?? ShippingMethodStatus.ACTIVE,
        priceCents: input.priceCents,
        estimatedDaysMin: input.estimatedDaysMin ?? null,
        estimatedDaysMax: input.estimatedDaysMax ?? null,
        minimumOrderCents: input.minimumOrderCents ?? null,
        maximumOrderCents: input.maximumOrderCents ?? null,
        sortOrder: input.sortOrder ?? 0,
        isDefault: input.isDefault ?? false
      })
    };
  }

  async updateShippingMethod(shippingMethodId: string, input: UpdateShippingMethodInput) {
    const shippingMethod = await this.shippingRepository.findShippingMethodById(shippingMethodId);

    if (!shippingMethod || shippingMethod.storeId !== input.storeId) {
      throw new NotFoundException({
        message: "Shipping method not found",
        code: "SHIPPING_METHOD_NOT_FOUND",
        shippingMethodId
      });
    }

    const estimatedDaysMin =
      input.estimatedDaysMin === undefined ? shippingMethod.estimatedDaysMin : input.estimatedDaysMin;
    const estimatedDaysMax =
      input.estimatedDaysMax === undefined ? shippingMethod.estimatedDaysMax : input.estimatedDaysMax;
    const minimumOrderCents =
      input.minimumOrderCents === undefined ? shippingMethod.minimumOrderCents : input.minimumOrderCents;
    const maximumOrderCents =
      input.maximumOrderCents === undefined ? shippingMethod.maximumOrderCents : input.maximumOrderCents;

    this.assertShippingMethodWindow(estimatedDaysMin, estimatedDaysMax);
    this.assertOrderBand(minimumOrderCents, maximumOrderCents);

    return {
      shippingMethod: await this.shippingRepository.updateShippingMethod(shippingMethodId, {
        name: input.name?.trim(),
        description: input.description === undefined ? undefined : input.description?.trim() || null,
        type: input.type,
        status: input.status,
        priceCents: input.priceCents,
        estimatedDaysMin: input.estimatedDaysMin,
        estimatedDaysMax: input.estimatedDaysMax,
        minimumOrderCents: input.minimumOrderCents,
        maximumOrderCents: input.maximumOrderCents,
        sortOrder: input.sortOrder,
        isDefault: input.isDefault
      })
    };
  }

  async createShipment(input: CreateShipmentInput) {
    this.assertShippingMethodWindow(input.estimatedDaysMin ?? null, input.estimatedDaysMax ?? null);

    const order = await this.ordersRepository.getOrderByIdAndStore(input.orderId, input.storeId);

    if (!order) {
      throw new NotFoundException({
        message: "Order not found",
        code: "ORDER_NOT_FOUND",
        orderId: input.orderId
      });
    }

    if (input.shippingMethodId) {
      const shippingMethod = await this.shippingRepository.findShippingMethodById(input.shippingMethodId);

      if (!shippingMethod || shippingMethod.storeId !== input.storeId) {
        throw new NotFoundException({
          message: "Shipping method not found",
          code: "SHIPPING_METHOD_NOT_FOUND",
          shippingMethodId: input.shippingMethodId
        });
      }
    }

    return {
      shipment: await this.shippingRepository.createShipment({
        orderId: input.orderId,
        storeId: input.storeId,
        shippingMethodId: input.shippingMethodId ?? null,
        status: input.status ?? ShipmentStatus.PENDING,
        shippingMethodName: input.shippingMethodName.trim(),
        carrierName: input.carrierName?.trim() || null,
        serviceName: input.serviceName?.trim() || null,
        trackingCode: input.trackingCode?.trim() || null,
        trackingUrl: input.trackingUrl?.trim() || null,
        labelUrl: input.labelUrl?.trim() || null,
        priceCents: input.priceCents,
        estimatedDaysMin: input.estimatedDaysMin ?? null,
        estimatedDaysMax: input.estimatedDaysMax ?? null,
        notes: input.notes?.trim() || null
      })
    };
  }

  private assertShippingMethodWindow(minDays: number | null, maxDays: number | null) {
    if (minDays !== null && maxDays !== null && maxDays < minDays) {
      throw new BadRequestException({
        message: "Estimated delivery window is invalid",
        code: "SHIPPING_ESTIMATE_INVALID",
        estimatedDaysMin: minDays,
        estimatedDaysMax: maxDays
      });
    }
  }

  private assertOrderBand(minimumOrderCents: number | null, maximumOrderCents: number | null) {
    if (
      minimumOrderCents !== null &&
      maximumOrderCents !== null &&
      maximumOrderCents < minimumOrderCents
    ) {
      throw new BadRequestException({
        message: "Shipping order band is invalid",
        code: "SHIPPING_ORDER_BAND_INVALID",
        minimumOrderCents,
        maximumOrderCents
      });
    }
  }
}
