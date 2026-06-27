import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { OrdersRepository } from "./orders.repository";

@Injectable()
export class OrdersService {
  constructor(private readonly ordersRepository: OrdersRepository) {}

  getBoundary() {
    return this.ordersRepository.getBoundary();
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

  private hashPublicAccessToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}
