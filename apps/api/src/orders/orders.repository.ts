import { Injectable } from "@nestjs/common";
import { prisma } from "@acme/database";
import { OrderStatus, Prisma, ProductStatus, ShipmentStatus } from "@prisma/client";
import { DomainBoundary } from "../platform/domain-boundary";

@Injectable()
export class OrdersRepository {
  getBoundary(): DomainBoundary {
    return {
      module: "orders",
      description: "Order persistence, status transitions and fulfillment-facing state.",
      responsibilities: ["orders", "line items", "status history", "fulfillment metadata"],
      dependsOn: ["database", "checkout", "payments"]
    };
  }

  createOrder(input: {
    storeId: string;
    cartId?: string | null;
    customerId?: string | null;
    paymentId?: string | null;
    shippingMethodId?: string | null;
    publicAccessTokenHash?: string | null;
    status?: OrderStatus;
    currencyCode?: string;
    subtotalCents: number;
    shippingCents?: number;
    discountCents?: number;
    totalCents: number;
    customerEmail: string;
    customerFullName?: string | null;
    customerPhoneNumber?: string | null;
    shippingRecipientName?: string | null;
    shippingPhoneNumber?: string | null;
    shippingPostalCode?: string | null;
    shippingState?: string | null;
    shippingCity?: string | null;
    shippingDistrict?: string | null;
    shippingStreet?: string | null;
    shippingNumber?: string | null;
    shippingComplement?: string | null;
    billingRecipientName?: string | null;
    billingPhoneNumber?: string | null;
    billingPostalCode?: string | null;
    billingState?: string | null;
    billingCity?: string | null;
    billingDistrict?: string | null;
    billingStreet?: string | null;
    billingNumber?: string | null;
    billingComplement?: string | null;
    notes?: string | null;
  }) {
    return prisma.order.create({
      data: {
        storeId: input.storeId,
        cartId: input.cartId ?? null,
        customerId: input.customerId ?? null,
        paymentId: input.paymentId ?? null,
        shippingMethodId: input.shippingMethodId ?? null,
        publicAccessTokenHash: input.publicAccessTokenHash ?? null,
        status: input.status ?? OrderStatus.CREATED,
        currencyCode: input.currencyCode ?? "BRL",
        subtotalCents: input.subtotalCents,
        shippingCents: input.shippingCents ?? 0,
        discountCents: input.discountCents ?? 0,
        totalCents: input.totalCents,
        customerEmail: input.customerEmail,
        customerFullName: input.customerFullName ?? null,
        customerPhoneNumber: input.customerPhoneNumber ?? null,
        shippingRecipientName: input.shippingRecipientName ?? null,
        shippingPhoneNumber: input.shippingPhoneNumber ?? null,
        shippingPostalCode: input.shippingPostalCode ?? null,
        shippingState: input.shippingState ?? null,
        shippingCity: input.shippingCity ?? null,
        shippingDistrict: input.shippingDistrict ?? null,
        shippingStreet: input.shippingStreet ?? null,
        shippingNumber: input.shippingNumber ?? null,
        shippingComplement: input.shippingComplement ?? null,
        billingRecipientName: input.billingRecipientName ?? null,
        billingPhoneNumber: input.billingPhoneNumber ?? null,
        billingPostalCode: input.billingPostalCode ?? null,
        billingState: input.billingState ?? null,
        billingCity: input.billingCity ?? null,
        billingDistrict: input.billingDistrict ?? null,
        billingStreet: input.billingStreet ?? null,
        billingNumber: input.billingNumber ?? null,
        billingComplement: input.billingComplement ?? null,
        notes: input.notes ?? null
      }
    });
  }

  addOrderItem(input: {
    orderId: string;
    storeId: string;
    productId?: string | null;
    variantId?: string | null;
    variantName?: string | null;
    variantSku?: string | null;
    productName: string;
    productSlug: string;
    quantity: number;
    unitPriceCents: number;
    compareAtCents?: number | null;
    discountCents?: number;
    totalCents: number;
    currencyCode?: string;
    sku?: string | null;
    categoryName?: string | null;
    categorySlug?: string | null;
  }) {
    return prisma.orderItem.create({
      data: {
        orderId: input.orderId,
        storeId: input.storeId,
        productId: input.productId ?? null,
        variantId: input.variantId ?? null,
        variantName: input.variantName ?? null,
        variantSku: input.variantSku ?? null,
        productName: input.productName,
        productSlug: input.productSlug,
        quantity: input.quantity,
        unitPriceCents: input.unitPriceCents,
        compareAtCents: input.compareAtCents ?? null,
        discountCents: input.discountCents ?? 0,
        totalCents: input.totalCents,
        currencyCode: input.currencyCode ?? "BRL",
        sku: input.sku ?? null,
        categoryName: input.categoryName ?? null,
        categorySlug: input.categorySlug ?? null
      }
    });
  }

  getOrderById(orderId: string) {
    return prisma.order.findUnique({
      where: {
        id: orderId
      },
      include: {
        customer: true,
        payment: true,
        shippingMethod: true,
        shipment: true,
        cart: {
          include: {
            items: true
          }
        },
        items: {
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });
  }

  getOrderByIdAndStore(orderId: string, storeId: string) {
    return prisma.order.findFirst({
      where: {
        id: orderId,
        storeId
      },
      include: {
        customer: true,
        payment: true,
        shippingMethod: true,
        shipment: true,
        cart: {
          include: {
            items: true
          }
        },
        items: {
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });
  }

  getOrderByIdAndPublicAccessHash(orderId: string, publicAccessTokenHash: string) {
    return prisma.order.findFirst({
      where: {
        id: orderId,
        publicAccessTokenHash
      },
      include: {
        payment: true,
        shippingMethod: true,
        shipment: true,
        items: {
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });
  }

  listOrdersByStore(input: {
    storeId: string;
    status?: OrderStatus;
  }) {
    return prisma.order.findMany({
      where: {
        storeId: input.storeId,
        ...(input.status ? { status: input.status } : {})
      },
      include: {
        payment: true,
        shippingMethod: true,
        shipment: true,
        items: {
          orderBy: {
            createdAt: "asc"
          }
        }
      },
      orderBy: [{ createdAt: "desc" }]
    });
  }

  updateOrder(orderId: string, input: {
    paymentId?: string | null;
    shippingMethodId?: string | null;
    status?: OrderStatus;
    statusUpdatedAt?: Date;
    approvedAt?: Date | null;
    canceledAt?: Date | null;
    refundedAt?: Date | null;
    shippedAt?: Date | null;
    deliveredAt?: Date | null;
  }) {
    return prisma.order.update({
      where: {
        id: orderId
      },
      data: input
    });
  }

  async updateOrderWithInventory(orderId: string, input: {
    storeId: string;
    shouldRestoreStock?: boolean;
    paymentId?: string | null;
    shippingMethodId?: string | null;
    status?: OrderStatus;
    statusUpdatedAt?: Date;
    approvedAt?: Date | null;
    canceledAt?: Date | null;
    refundedAt?: Date | null;
    shippedAt?: Date | null;
    deliveredAt?: Date | null;
  }) {
    return prisma.$transaction(async (tx) => {
      if (input.shouldRestoreStock) {
        await this.restoreStockForOrderTransaction(tx, orderId, input.storeId);
      }

      return tx.order.update({
        where: {
          id: orderId
        },
        data: {
          paymentId: input.paymentId,
          shippingMethodId: input.shippingMethodId,
          status: input.status,
          statusUpdatedAt: input.statusUpdatedAt,
          approvedAt: input.approvedAt,
          canceledAt: input.canceledAt,
          refundedAt: input.refundedAt,
          shippedAt: input.shippedAt,
          deliveredAt: input.deliveredAt
        }
      });
    });
  }

  updateShipmentByOrder(orderId: string, storeId: string, input: {
    status?: ShipmentStatus;
    carrierName?: string | null;
    serviceName?: string | null;
    trackingCode?: string | null;
    trackingUrl?: string | null;
    labelUrl?: string | null;
    postedAt?: Date | null;
    shippedAt?: Date | null;
    deliveredAt?: Date | null;
    canceledAt?: Date | null;
    notes?: string | null;
  }) {
    return prisma.shipment.update({
      where: {
        orderId_storeId: {
          orderId,
          storeId
        }
      },
      data: input
    });
  }

  async restoreStockForOrder(orderId: string, storeId: string) {
    return prisma.$transaction(async (tx) => {
      await this.restoreStockForOrderTransaction(tx, orderId, storeId);
    });
  }

  private async restoreStockForOrderTransaction(
    tx: Prisma.TransactionClient,
    orderId: string,
    storeId: string
  ) {
    const orderItems = await tx.orderItem.findMany({
      where: {
        orderId,
        storeId,
        productId: {
          not: null
        }
      },
      select: {
        productId: true,
        variantId: true,
        quantity: true
      }
    });

    for (const item of orderItems) {
      if (!item.productId) {
        continue;
      }

      const product = await tx.product.findFirst({
        where: {
          id: item.productId,
          storeId
        },
        select: {
          id: true,
          status: true,
          stockQuantity: true
        }
      });

      if (!product) {
        continue;
      }

      if (item.variantId) {
        const variant = await tx.productVariant.findUnique({
          where: {
            id: item.variantId
          },
          select: {
            id: true,
            stockQuantity: true
          }
        });

        if (variant) {
          await tx.productVariant.update({
            where: {
              id: variant.id
            },
            data: {
              stockQuantity: variant.stockQuantity + item.quantity
            }
          });
        }
      }

      const nextStockQuantity = product.stockQuantity + item.quantity;
      const nextStatus =
        product.status === ProductStatus.OUT_OF_STOCK && nextStockQuantity > 0
          ? ProductStatus.ACTIVE
          : product.status;

      await tx.product.update({
        where: {
          id: product.id
        },
        data: {
          stockQuantity: nextStockQuantity,
          status: nextStatus
        }
      });
    }
  }
}
