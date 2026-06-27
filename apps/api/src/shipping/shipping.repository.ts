import { Injectable } from "@nestjs/common";
import { prisma } from "@acme/database";
import { ShipmentStatus, ShippingMethodStatus, ShippingMethodType } from "@prisma/client";
import { DomainBoundary } from "../platform/domain-boundary";

@Injectable()
export class ShippingRepository {
  getBoundary(): DomainBoundary {
    return {
      module: "shipping",
      description: "Simple shipping configuration and shipment tracking for the MVP.",
      responsibilities: ["shipping methods", "shipping pricing bands", "shipment snapshots", "tracking metadata"],
      dependsOn: ["database", "stores", "orders"]
    };
  }

  findShippingMethodById(shippingMethodId: string) {
    return prisma.shippingMethod.findUnique({
      where: {
        id: shippingMethodId
      }
    });
  }

  listShippingMethodsByStore(storeId: string) {
    return prisma.shippingMethod.findMany({
      where: {
        storeId
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
  }

  createShippingMethod(input: {
    storeId: string;
    name: string;
    description?: string | null;
    type: ShippingMethodType;
    status?: ShippingMethodStatus;
    priceCents: number;
    estimatedDaysMin?: number | null;
    estimatedDaysMax?: number | null;
    minimumOrderCents?: number | null;
    maximumOrderCents?: number | null;
    sortOrder?: number;
    isDefault?: boolean;
  }) {
    return prisma.shippingMethod.create({
      data: {
        storeId: input.storeId,
        name: input.name,
        description: input.description ?? null,
        type: input.type,
        status: input.status ?? ShippingMethodStatus.ACTIVE,
        priceCents: input.priceCents,
        estimatedDaysMin: input.estimatedDaysMin ?? null,
        estimatedDaysMax: input.estimatedDaysMax ?? null,
        minimumOrderCents: input.minimumOrderCents ?? null,
        maximumOrderCents: input.maximumOrderCents ?? null,
        sortOrder: input.sortOrder ?? 0,
        isDefault: input.isDefault ?? false
      }
    });
  }

  updateShippingMethod(shippingMethodId: string, input: {
    name?: string;
    description?: string | null;
    type?: ShippingMethodType;
    status?: ShippingMethodStatus;
    priceCents?: number;
    estimatedDaysMin?: number | null;
    estimatedDaysMax?: number | null;
    minimumOrderCents?: number | null;
    maximumOrderCents?: number | null;
    sortOrder?: number;
    isDefault?: boolean;
  }) {
    return prisma.shippingMethod.update({
      where: {
        id: shippingMethodId
      },
      data: input
    });
  }

  createShipment(input: {
    orderId: string;
    storeId: string;
    shippingMethodId?: string | null;
    status?: ShipmentStatus;
    shippingMethodName: string;
    carrierName?: string | null;
    serviceName?: string | null;
    trackingCode?: string | null;
    trackingUrl?: string | null;
    labelUrl?: string | null;
    priceCents?: number;
    estimatedDaysMin?: number | null;
    estimatedDaysMax?: number | null;
    notes?: string | null;
  }) {
    return prisma.shipment.create({
      data: {
        orderId: input.orderId,
        storeId: input.storeId,
        shippingMethodId: input.shippingMethodId ?? null,
        status: input.status ?? ShipmentStatus.PENDING,
        shippingMethodName: input.shippingMethodName,
        carrierName: input.carrierName ?? null,
        serviceName: input.serviceName ?? null,
        trackingCode: input.trackingCode ?? null,
        trackingUrl: input.trackingUrl ?? null,
        labelUrl: input.labelUrl ?? null,
        priceCents: input.priceCents ?? 0,
        estimatedDaysMin: input.estimatedDaysMin ?? null,
        estimatedDaysMax: input.estimatedDaysMax ?? null,
        notes: input.notes ?? null
      }
    });
  }

  getShipmentByOrder(orderId: string, storeId: string) {
    return prisma.shipment.findFirst({
      where: {
        orderId,
        storeId
      },
      include: {
        shippingMethod: true,
        order: true
      }
    });
  }
}
