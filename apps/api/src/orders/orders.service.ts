import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { OrderStatus, ShipmentStatus, StatusTransitionEntityType } from "@prisma/client";
import { AuditRepository } from "../audit/audit.repository";
import { AuthenticatedUser } from "../auth/auth.types";
import { OrdersRepository } from "./orders.repository";
import {
  canTransitionOrderStatus,
  getAllowedOperationalOrderStatuses
} from "./order-status.rules";
import {
  ListManagedOrdersQuery,
  UpdateManagedOrderStatusInput
} from "./orders.schemas";

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly auditRepository: AuditRepository
  ) {}

  getBoundary() {
    return this.ordersRepository.getBoundary();
  }

  async listManagedOrders(storeId: string, input: ListManagedOrdersQuery) {
    const orders = await this.ordersRepository.listOrdersByStore({
      storeId,
      status: input.status
    });

    return {
      orders: orders.map((order) => ({
        id: order.id,
        status: order.status,
        customerEmail: order.customerEmail,
        customerFullName: order.customerFullName,
        currencyCode: order.currencyCode,
        subtotalCents: order.subtotalCents,
        shippingCents: order.shippingCents,
        discountCents: order.discountCents,
        totalCents: order.totalCents,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        createdAt: order.createdAt,
        statusUpdatedAt: order.statusUpdatedAt,
        approvedAt: order.approvedAt,
        canceledAt: order.canceledAt,
        refundedAt: order.refundedAt,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        payment: order.payment
          ? {
              id: order.payment.id,
              status: order.payment.status,
              amountCents: order.payment.amountCents,
              paidAt: order.payment.paidAt
            }
          : null,
        shipment: order.shipment
          ? {
              id: order.shipment.id,
              status: order.shipment.status,
              shippingMethodName: order.shipment.shippingMethodName,
              carrierName: order.shipment.carrierName,
              serviceName: order.shipment.serviceName,
              trackingCode: order.shipment.trackingCode,
              trackingUrl: order.shipment.trackingUrl,
              estimatedDaysMin: order.shipment.estimatedDaysMin,
              estimatedDaysMax: order.shipment.estimatedDaysMax,
              postedAt: order.shipment.postedAt,
              shippedAt: order.shipment.shippedAt,
              deliveredAt: order.shipment.deliveredAt,
              canceledAt: order.shipment.canceledAt,
              notes: order.shipment.notes
            }
          : null,
        items: order.items.map((item) => ({
          id: item.id,
          productName: item.productName,
          quantity: item.quantity,
          totalCents: item.totalCents
        })),
        allowedActions: getAllowedOperationalOrderStatuses(order.status)
      }))
    };
  }

  async getPublicOrder(orderId: string, token: string) {
    const normalizedToken = token.trim();

    if (normalizedToken.length === 0) {
      throw new ForbiddenException({
        message: "Order access token is required",
        code: "ORDER_ACCESS_TOKEN_REQUIRED"
      });
    }

    const order = await this.ordersRepository.getOrderByIdAndPublicAccessHash(
      orderId,
      this.hashPublicAccessToken(normalizedToken)
    );

    if (!order) {
      throw new NotFoundException({
        message: "Order not found for this access token",
        code: "ORDER_PUBLIC_NOT_FOUND",
        orderId
      });
    }

    return {
      order: {
        id: order.id,
        status: order.status,
        customerEmail: order.customerEmail,
        customerFullName: order.customerFullName,
        subtotalCents: order.subtotalCents,
        shippingCents: order.shippingCents,
        discountCents: order.discountCents,
        totalCents: order.totalCents,
        currencyCode: order.currencyCode,
        approvedAt: order.approvedAt,
        canceledAt: order.canceledAt,
        refundedAt: order.refundedAt,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        shippingAddress: {
          recipientName: order.shippingRecipientName,
          postalCode: order.shippingPostalCode,
          state: order.shippingState,
          city: order.shippingCity,
          district: order.shippingDistrict,
          street: order.shippingStreet,
          number: order.shippingNumber,
          complement: order.shippingComplement
        },
        payment: order.payment
          ? {
              status: order.payment.status,
              amountCents: order.payment.amountCents,
              paidAt: order.payment.paidAt
            }
          : null,
        shippingMethod: order.shippingMethod
          ? {
              id: order.shippingMethod.id,
              name: order.shippingMethod.name,
              type: order.shippingMethod.type
            }
          : null,
        shipment: order.shipment
          ? {
              status: order.shipment.status,
              shippingMethodName: order.shipment.shippingMethodName,
              carrierName: order.shipment.carrierName,
              serviceName: order.shipment.serviceName,
              trackingCode: order.shipment.trackingCode,
              trackingUrl: order.shipment.trackingUrl,
              estimatedDaysMin: order.shipment.estimatedDaysMin,
              estimatedDaysMax: order.shipment.estimatedDaysMax
            }
          : null,
        items: order.items.map((item) => ({
          id: item.id,
          productName: item.productName,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          totalCents: item.totalCents
        }))
      }
    };
  }

  async updateManagedOrderStatus(
    actor: AuthenticatedUser,
    orderId: string,
    input: UpdateManagedOrderStatusInput
  ) {
    const order = await this.ordersRepository.getOrderByIdAndStore(orderId, input.storeId);

    if (!order) {
      throw new NotFoundException({
        message: "Order not found",
        code: "ORDER_NOT_FOUND",
        orderId
      });
    }

    const allowed = canTransitionOrderStatus(order.status, input.status);
    const source = "dashboard.orders";
    const metadata = {
      actorEmail: actor.email,
      shipmentDraft: {
        carrierName: input.carrierName ?? null,
        serviceName: input.serviceName ?? null,
        trackingCode: input.trackingCode ?? null,
        trackingUrl: input.trackingUrl ?? null,
        labelUrl: input.labelUrl ?? null
      }
    };

    if (!allowed) {
      await this.auditRepository.createStatusTransitionAudit({
        entityType: StatusTransitionEntityType.ORDER,
        entityId: order.id,
        storeId: order.storeId,
        fromStatus: order.status,
        toStatus: input.status,
        allowed: false,
        reason: input.reason ?? "Invalid dashboard transition",
        source,
        actorType: "user",
        actorId: actor.id,
        metadata: JSON.stringify(metadata)
      });

      throw new BadRequestException({
        message: "Order status transition is not allowed",
        code: "ORDER_STATUS_TRANSITION_INVALID",
        orderId,
        fromStatus: order.status,
        toStatus: input.status
      });
    }

    const now = new Date();
    await this.ordersRepository.updateOrder(order.id, {
      status: input.status,
      statusUpdatedAt: now,
      canceledAt: input.status === OrderStatus.CANCELED ? now : undefined,
      shippedAt: input.status === OrderStatus.SHIPPED ? now : undefined,
      deliveredAt: input.status === OrderStatus.DELIVERED ? now : undefined
    });

    if (order.shipment) {
      const shipmentUpdate = this.buildShipmentUpdate(order.shipment.status, input, now);
      await this.ordersRepository.updateShipmentByOrder(order.id, order.storeId, shipmentUpdate);
    }

    await this.auditRepository.createStatusTransitionAudit({
      entityType: StatusTransitionEntityType.ORDER,
      entityId: order.id,
      storeId: order.storeId,
      fromStatus: order.status,
      toStatus: input.status,
      allowed: true,
      reason: input.reason ?? null,
      source,
      actorType: "user",
      actorId: actor.id,
      metadata: JSON.stringify(metadata)
    });

    const refreshedOrder = await this.ordersRepository.getOrderByIdAndStore(orderId, input.storeId);

    return {
      order: {
        id: refreshedOrder!.id,
        status: refreshedOrder!.status,
        statusUpdatedAt: refreshedOrder!.statusUpdatedAt,
        canceledAt: refreshedOrder!.canceledAt,
        shippedAt: refreshedOrder!.shippedAt,
        deliveredAt: refreshedOrder!.deliveredAt,
        shipment: refreshedOrder!.shipment
          ? {
              status: refreshedOrder!.shipment.status,
              carrierName: refreshedOrder!.shipment.carrierName,
              serviceName: refreshedOrder!.shipment.serviceName,
              trackingCode: refreshedOrder!.shipment.trackingCode,
              trackingUrl: refreshedOrder!.shipment.trackingUrl,
              notes: refreshedOrder!.shipment.notes
            }
          : null,
        allowedActions: getAllowedOperationalOrderStatuses(refreshedOrder!.status)
      }
    };
  }

  private buildShipmentUpdate(
    currentStatus: ShipmentStatus,
    input: UpdateManagedOrderStatusInput,
    now: Date
  ) {
    const sharedFields = {
      ...(input.carrierName !== undefined ? { carrierName: input.carrierName } : {}),
      ...(input.serviceName !== undefined ? { serviceName: input.serviceName } : {}),
      ...(input.trackingCode !== undefined ? { trackingCode: input.trackingCode } : {}),
      ...(input.trackingUrl !== undefined ? { trackingUrl: input.trackingUrl } : {}),
      ...(input.labelUrl !== undefined ? { labelUrl: input.labelUrl } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {})
    };

    if (input.status === OrderStatus.PROCESSING) {
      return {
        status:
          currentStatus === ShipmentStatus.PENDING
            ? ShipmentStatus.READY_TO_SHIP
            : currentStatus,
        ...sharedFields
      };
    }

    if (input.status === OrderStatus.SHIPPED) {
      return {
        status: ShipmentStatus.SHIPPED,
        postedAt: now,
        shippedAt: now,
        ...sharedFields
      };
    }

    if (input.status === OrderStatus.DELIVERED) {
      return {
        status: ShipmentStatus.DELIVERED,
        deliveredAt: now,
        ...sharedFields
      };
    }

    if (input.status === OrderStatus.CANCELED) {
      return {
        status: ShipmentStatus.CANCELED,
        canceledAt: now,
        ...sharedFields
      };
    }

    return sharedFields;
  }

  private hashPublicAccessToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}
