import { Injectable } from "@nestjs/common";
import { prisma } from "@acme/database";
import { CartStatus, OrderStatus, ProductStatus } from "@prisma/client";
import { DomainBoundary } from "../platform/domain-boundary";

export type StoreBrief = {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  supportEmail: string | null;
};

@Injectable()
export class CheckoutRepository {
  getBoundary(): DomainBoundary {
    return {
      module: "checkout",
      description: "Checkout orchestration before payment authorization.",
      responsibilities: ["checkout sessions", "addresses", "shipping selection", "order draft creation"],
      dependsOn: ["database", "cart", "catalog", "payments"]
    };
  }

  async getStoreBrief(storeId: string): Promise<StoreBrief | null> {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: { owner: { select: { email: true } } }
    });

    if (!store) {
      return null;
    }

    return {
      id: store.id,
      name: store.name,
      slug: store.slug,
      ownerEmail: store.owner.email,
      supportEmail: store.supportEmail
    };
  }

  async createOrderFromCart(input: {
    storeId: string;
    cartId: string;
    customerId?: string | null;
    shippingMethodId: string;
    publicAccessTokenHash: string;
    shippingMethodName: string;
    shippingEstimatedDaysMin?: number | null;
    shippingEstimatedDaysMax?: number | null;
    currencyCode: string;
    subtotalCents: number;
    shippingCents: number;
    discountCents: number;
    totalCents: number;
    customerEmail: string;
    customerFullName: string;
    customerPhoneNumber?: string | null;
    shippingRecipientName: string;
    shippingPhoneNumber?: string | null;
    shippingPostalCode: string;
    shippingState: string;
    shippingCity: string;
    shippingDistrict: string;
    shippingStreet: string;
    shippingNumber: string;
    shippingComplement?: string | null;
    billingRecipientName: string;
    billingPhoneNumber?: string | null;
    billingPostalCode: string;
    billingState: string;
    billingCity: string;
    billingDistrict: string;
    billingStreet: string;
    billingNumber: string;
    billingComplement?: string | null;
    notes?: string | null;
    items: Array<{
      productId: string;
      variantId?: string | null;
      variantName?: string | null;
      variantSku?: string | null;
      productName: string;
      productSlug: string;
      quantity: number;
      unitPriceCents: number;
      compareAtCents: number | null;
      currencyCode: string;
      sku?: string | null;
      categoryName?: string | null;
      categorySlug?: string | null;
      totalCents: number;
    }>;
    stockAdjustments: Array<{
      productId: string;
      variantId?: string | null;
      nextVariantStockQuantity?: number | null;
      nextStockQuantity: number;
      nextStatus: ProductStatus;
    }>;
  }) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          storeId: input.storeId,
          cartId: input.cartId,
          customerId: input.customerId ?? null,
          shippingMethodId: input.shippingMethodId,
          publicAccessTokenHash: input.publicAccessTokenHash,
          status: OrderStatus.CREATED,
          currencyCode: input.currencyCode,
          subtotalCents: input.subtotalCents,
          shippingCents: input.shippingCents,
          discountCents: input.discountCents,
          totalCents: input.totalCents,
          customerEmail: input.customerEmail,
          customerFullName: input.customerFullName,
          customerPhoneNumber: input.customerPhoneNumber ?? null,
          shippingRecipientName: input.shippingRecipientName,
          shippingPhoneNumber: input.shippingPhoneNumber ?? null,
          shippingPostalCode: input.shippingPostalCode,
          shippingState: input.shippingState,
          shippingCity: input.shippingCity,
          shippingDistrict: input.shippingDistrict,
          shippingStreet: input.shippingStreet,
          shippingNumber: input.shippingNumber,
          shippingComplement: input.shippingComplement ?? null,
          billingRecipientName: input.billingRecipientName,
          billingPhoneNumber: input.billingPhoneNumber ?? null,
          billingPostalCode: input.billingPostalCode,
          billingState: input.billingState,
          billingCity: input.billingCity,
          billingDistrict: input.billingDistrict,
          billingStreet: input.billingStreet,
          billingNumber: input.billingNumber,
          billingComplement: input.billingComplement ?? null,
          notes: input.notes ?? null
        }
      });

      await tx.orderItem.createMany({
        data: input.items.map((item) => ({
          orderId: order.id,
          storeId: input.storeId,
          productId: item.productId,
          variantId: item.variantId ?? null,
          variantName: item.variantName ?? null,
          variantSku: item.variantSku ?? null,
          productName: item.productName,
          productSlug: item.productSlug,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          compareAtCents: item.compareAtCents,
          discountCents: 0,
          totalCents: item.totalCents,
          currencyCode: item.currencyCode,
          sku: item.sku ?? null,
          categoryName: item.categoryName ?? null,
          categorySlug: item.categorySlug ?? null
        }))
      });

      await tx.shipment.create({
        data: {
          orderId: order.id,
          storeId: input.storeId,
          shippingMethodId: input.shippingMethodId,
          shippingMethodName: input.shippingMethodName,
          priceCents: input.shippingCents,
          estimatedDaysMin: input.shippingEstimatedDaysMin ?? null,
          estimatedDaysMax: input.shippingEstimatedDaysMax ?? null,
          status: "PENDING"
        }
      });

      for (const adjustment of input.stockAdjustments) {
        if (adjustment.variantId) {
          await tx.productVariant.update({
            where: {
              id: adjustment.variantId
            },
            data: {
              stockQuantity: adjustment.nextVariantStockQuantity ?? 0
            }
          });
        }

        await tx.product.update({
          where: {
            id: adjustment.productId
          },
          data: {
            stockQuantity: adjustment.nextStockQuantity,
            status: adjustment.nextStatus
          }
        });
      }

      await tx.cart.update({
        where: {
          id: input.cartId
        },
        data: {
          customerId: input.customerId ?? null,
          customerEmail: input.customerEmail,
          status: CartStatus.CONVERTED
        }
      });

      return order;
    });
  }
}
