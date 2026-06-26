import { Injectable } from "@nestjs/common";
import { prisma } from "@acme/database";
import { CartStatus } from "@prisma/client";
import { DomainBoundary } from "../platform/domain-boundary";

@Injectable()
export class CartRepository {
  getBoundary(): DomainBoundary {
    return {
      module: "cart",
      description: "Single-store cart state and cart item persistence.",
      responsibilities: ["cart sessions", "cart items", "cart totals", "cart ownership"],
      dependsOn: ["database", "catalog", "stores"]
    };
  }

  findActiveCartBySession(storeId: string, sessionId: string) {
    return prisma.cart.findFirst({
      where: {
        storeId,
        sessionId,
        status: CartStatus.ACTIVE
      },
      include: {
        items: true
      },
      orderBy: {
        updatedAt: "desc"
      }
    });
  }

  findActiveCartByUser(storeId: string, userId: string) {
    return prisma.cart.findFirst({
      where: {
        storeId,
        userId,
        status: CartStatus.ACTIVE
      },
      include: {
        items: true
      },
      orderBy: {
        updatedAt: "desc"
      }
    });
  }

  createCart(input: {
    storeId: string;
    userId?: string | null;
    sessionId?: string | null;
    customerEmail?: string | null;
    currencyCode?: string;
    expiresAt?: Date | null;
  }) {
    return prisma.cart.create({
      data: {
        storeId: input.storeId,
        userId: input.userId ?? null,
        sessionId: input.sessionId ?? null,
        customerEmail: input.customerEmail ?? null,
        currencyCode: input.currencyCode ?? "BRL",
        expiresAt: input.expiresAt ?? null
      },
      include: {
        items: true
      }
    });
  }

  getCartById(cartId: string) {
    return prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });
  }

  addCartItem(input: {
    cartId: string;
    storeId: string;
    productId: string;
    quantity: number;
    productName: string;
    productSlug: string;
    unitPriceCents: number;
    compareAtCents?: number | null;
    currencyCode?: string;
  }) {
    return prisma.cartItem.create({
      data: {
        cartId: input.cartId,
        storeId: input.storeId,
        productId: input.productId,
        quantity: input.quantity,
        productName: input.productName,
        productSlug: input.productSlug,
        unitPriceCents: input.unitPriceCents,
        compareAtCents: input.compareAtCents ?? null,
        currencyCode: input.currencyCode ?? "BRL"
      }
    });
  }
}
