import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { PlatformRole, ProductStatus } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { prisma } from "@acme/database";
import { CartRepository } from "./cart.repository";

describe("cart modeling", () => {
  const suffix = Date.now().toString(36);
  const primaryEmail = `cart-primary-${suffix}@example.com`;
  const secondaryEmail = `cart-secondary-${suffix}@example.com`;
  const cartRepository = new CartRepository();

  let primaryUserId = "";
  let secondaryUserId = "";
  let primaryStoreId = "";
  let secondaryStoreId = "";
  let primaryProductId = "";
  let secondaryProductId = "";

  before(async () => {
    const primaryUser = await prisma.user.create({
      data: {
        email: primaryEmail,
        passwordHash: "test-password-hash",
        platformRole: PlatformRole.CUSTOMER
      }
    });
    primaryUserId = primaryUser.id;

    const secondaryUser = await prisma.user.create({
      data: {
        email: secondaryEmail,
        passwordHash: "test-password-hash",
        platformRole: PlatformRole.CUSTOMER
      }
    });
    secondaryUserId = secondaryUser.id;

    const primaryStore = await prisma.store.create({
      data: {
        name: "Primary Cart Store",
        slug: `primary-cart-${suffix}`,
        defaultSubdomain: `primary-cart-${suffix}`,
        ownerId: primaryUser.id
      }
    });
    primaryStoreId = primaryStore.id;

    const secondaryStore = await prisma.store.create({
      data: {
        name: "Secondary Cart Store",
        slug: `secondary-cart-${suffix}`,
        defaultSubdomain: `secondary-cart-${suffix}`,
        ownerId: secondaryUser.id
      }
    });
    secondaryStoreId = secondaryStore.id;

    const primaryProduct = await prisma.product.create({
      data: {
        storeId: primaryStore.id,
        name: "Cafe Especial",
        slug: "cafe-especial",
        priceCents: 2590,
        compareAtCents: 2990,
        currencyCode: "BRL",
        stockQuantity: 12,
        status: ProductStatus.ACTIVE
      }
    });
    primaryProductId = primaryProduct.id;

    const secondaryProduct = await prisma.product.create({
      data: {
        storeId: secondaryStore.id,
        name: "Cha Verde",
        slug: "cha-verde",
        priceCents: 1890,
        currencyCode: "BRL",
        stockQuantity: 8,
        status: ProductStatus.ACTIVE
      }
    });
    secondaryProductId = secondaryProduct.id;
  });

  after(async () => {
    if (primaryStoreId) {
      await prisma.store.delete({ where: { id: primaryStoreId } });
    }

    if (secondaryStoreId) {
      await prisma.store.delete({ where: { id: secondaryStoreId } });
    }

    if (primaryUserId) {
      await prisma.user.delete({ where: { id: primaryUserId } });
    }

    if (secondaryUserId) {
      await prisma.user.delete({ where: { id: secondaryUserId } });
    }
  });

  it("creates a store-scoped cart with item price snapshot", async () => {
    const cart = await cartRepository.createCart({
      storeId: primaryStoreId,
      sessionId: `sess-${suffix}`,
      currencyCode: "BRL"
    });

    assert.equal(cart.storeId, primaryStoreId);
    assert.equal(cart.sessionId, `sess-${suffix}`);
    assert.equal(cart.items.length, 0);

    await cartRepository.addCartItem({
      cartId: cart.id,
      storeId: primaryStoreId,
      productId: primaryProductId,
      quantity: 2,
      productName: "Cafe Especial",
      productSlug: "cafe-especial",
      unitPriceCents: 2590,
      compareAtCents: 2990,
      currencyCode: "BRL"
    });

    await prisma.product.update({
      where: {
        id: primaryProductId
      },
      data: {
        priceCents: 3190,
        compareAtCents: 3490
      }
    });

    const storedCart = await cartRepository.getCartById(cart.id);
    assert.ok(storedCart);
    assert.equal(storedCart.storeId, primaryStoreId);
    assert.equal(storedCart.items.length, 1);
    assert.equal(storedCart.items[0]?.unitPriceCents, 2590);
    assert.equal(storedCart.items[0]?.compareAtCents, 2990);
    assert.equal(storedCart.items[0]?.productName, "Cafe Especial");
    assert.equal(storedCart.items[0]?.productSlug, "cafe-especial");
  });

  it("blocks mixing products from different stores into the same cart", async () => {
    const cart = await cartRepository.createCart({
      storeId: primaryStoreId,
      customerEmail: `guest-${suffix}@example.com`,
      currencyCode: "BRL"
    });

    await assert.rejects(
      () =>
        cartRepository.addCartItem({
          cartId: cart.id,
          storeId: primaryStoreId,
          productId: secondaryProductId,
          quantity: 1,
          productName: "Cha Verde",
          productSlug: "cha-verde",
          unitPriceCents: 1890,
          currencyCode: "BRL"
        }),
      (error: unknown) =>
        error instanceof PrismaClientKnownRequestError && error.code === "P2003"
    );
  });
});
