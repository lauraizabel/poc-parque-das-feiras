import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ProductStatus } from "@prisma/client";
import { PublicStorefrontContext } from "../auth/auth.types";
import { CatalogRepository } from "../catalog/catalog.repository";
import { CartRepository } from "./cart.repository";
import {
  AddCartItemInput,
  ClearCartInput,
  ResolveCartInput,
  UpdateCartItemInput
} from "./cart.schemas";

@Injectable()
export class CartService {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly catalogRepository: CatalogRepository
  ) {}

  getBoundary() {
    return this.cartRepository.getBoundary();
  }

  async getCurrentPublicContext(publicStore: PublicStorefrontContext, input: ResolveCartInput) {
    const cart = await this.ensureActiveCart(publicStore, input, false);

    return {
      store: publicStore,
      cart: cart ? this.serializeCart(cart) : null
    };
  }

  async createCart(publicStore: PublicStorefrontContext, input: ResolveCartInput) {
    const cart = await this.ensureActiveCart(publicStore, input, true);

    return {
      store: publicStore,
      cart: this.serializeCart(cart!)
    };
  }

  async addItem(publicStore: PublicStorefrontContext, input: AddCartItemInput) {
    const cart = await this.ensureActiveCart(publicStore, input, true);
    const purchase = await this.ensurePurchasableProduct(
      publicStore.storeId,
      input.productId,
      input.variantId ?? null,
      input.quantity
    );

    const existingItem = cart!.items.find(
      (item) => item.productId === input.productId && (item.variantId ?? null) === (purchase.variant?.id ?? null)
    ) ?? null;

    if (existingItem) {
      const nextQuantity = existingItem.quantity + input.quantity;
      this.assertStockAvailable(purchase.stockQuantity, nextQuantity);
      await this.cartRepository.updateCartItemQuantity(existingItem.id, nextQuantity);
    } else {
      await this.cartRepository.addCartItem({
        cartId: cart!.id,
        storeId: publicStore.storeId,
        productId: purchase.product.id,
        variantId: purchase.variant?.id ?? null,
        variantName: purchase.variant?.name ?? null,
        variantSku: purchase.variant?.sku ?? null,
        quantity: input.quantity,
        productName: purchase.product.name,
        productSlug: purchase.product.slug,
        unitPriceCents: purchase.unitPriceCents,
        compareAtCents: purchase.product.compareAtCents,
        currencyCode: purchase.product.currencyCode
      });
    }

    const refreshedCart = await this.cartRepository.getCartByIdAndStore(cart!.id, publicStore.storeId);

    return {
      store: publicStore,
      cart: this.serializeCart(refreshedCart!)
    };
  }

  async updateItem(
    publicStore: PublicStorefrontContext,
    cartItemId: string,
    input: UpdateCartItemInput
  ) {
    const cart = await this.ensureActiveCart(publicStore, input, false);

    if (!cart) {
      throw new NotFoundException({
        message: "Cart not found",
        code: "CART_NOT_FOUND"
      });
    }

    const item = await this.cartRepository.findCartItemById(cartItemId);

    if (!item || item.cartId !== cart.id || item.storeId !== publicStore.storeId) {
      throw new NotFoundException({
        message: "Cart item not found",
        code: "CART_ITEM_NOT_FOUND",
        cartItemId
      });
    }

    const purchase = await this.ensurePurchasableProduct(
      publicStore.storeId,
      item.productId,
      item.variantId ?? null,
      input.quantity
    );
    await this.cartRepository.updateCartItemQuantity(cartItemId, input.quantity);
    const refreshedCart = await this.cartRepository.getCartByIdAndStore(cart.id, publicStore.storeId);

    return {
      store: publicStore,
      cart: this.serializeCart(refreshedCart!),
      productStatus: purchase.product.status
    };
  }

  async removeItem(
    publicStore: PublicStorefrontContext,
    cartItemId: string,
    input: ResolveCartInput
  ) {
    const cart = await this.ensureActiveCart(publicStore, input, false);

    if (!cart) {
      throw new NotFoundException({
        message: "Cart not found",
        code: "CART_NOT_FOUND"
      });
    }

    const item = await this.cartRepository.findCartItemById(cartItemId);

    if (!item || item.cartId !== cart.id || item.storeId !== publicStore.storeId) {
      throw new NotFoundException({
        message: "Cart item not found",
        code: "CART_ITEM_NOT_FOUND",
        cartItemId
      });
    }

    await this.cartRepository.deleteCartItem(cartItemId);
    const refreshedCart = await this.cartRepository.getCartByIdAndStore(cart.id, publicStore.storeId);

    return {
      store: publicStore,
      cart: this.serializeCart(refreshedCart!)
    };
  }

  async clear(publicStore: PublicStorefrontContext, input: ClearCartInput) {
    const cart = await this.ensureActiveCart(publicStore, input, false);

    if (!cart) {
      throw new NotFoundException({
        message: "Cart not found",
        code: "CART_NOT_FOUND"
      });
    }

    await this.cartRepository.clearCart(cart.id);
    const refreshedCart = await this.cartRepository.getCartByIdAndStore(cart.id, publicStore.storeId);

    return {
      store: publicStore,
      cart: this.serializeCart(refreshedCart!)
    };
  }

  private async ensureActiveCart(
    publicStore: PublicStorefrontContext,
    input: ResolveCartInput,
    createWhenMissing: boolean
  ) {
    const sessionId = input.sessionId?.trim() || null;
    const customerEmail = input.customerEmail?.trim().toLowerCase() || null;

    let cart = sessionId
      ? await this.cartRepository.findActiveCartBySession(publicStore.storeId, sessionId)
      : null;

    if (!cart && customerEmail) {
      cart = await this.cartRepository.findActiveCartByCustomerEmail(
        publicStore.storeId,
        customerEmail
      );
    }

    if (!cart && createWhenMissing) {
      cart = await this.cartRepository.createCart({
        storeId: publicStore.storeId,
        sessionId,
        customerEmail,
        currencyCode: "BRL"
      });
    }

    return cart;
  }

  private async ensurePurchasableProduct(
    storeId: string,
    productId: string,
    variantId: string | null,
    quantity: number
  ) {
    const product = await this.catalogRepository.findProductById(productId);

    if (!product || product.storeId !== storeId) {
      throw new NotFoundException({
        message: "Product not found for this storefront",
        code: "PRODUCT_NOT_FOUND",
        productId
      });
    }

    if (product.status !== ProductStatus.ACTIVE) {
      throw new BadRequestException({
        message: "Product is not available for purchase",
        code: "PRODUCT_NOT_AVAILABLE",
        productId,
        status: product.status
      });
    }

    const variants = await this.catalogRepository.listProductVariantsByProductId(product.id);
    let variant = null;

    if (variants.length > 0 && !variantId) {
      throw new BadRequestException({
        message: "Product variant selection is required",
        code: "PRODUCT_VARIANT_REQUIRED",
        productId
      });
    }

    if (variantId) {
      variant = variants.find((item) => item.id === variantId) ?? null;

      if (!variant || variant.productId !== product.id) {
        throw new NotFoundException({
          message: "Product variant not found for this storefront",
          code: "PRODUCT_VARIANT_NOT_FOUND",
          productId,
          variantId
        });
      }

      this.assertStockAvailable(variant.stockQuantity, quantity);
    } else {
      this.assertStockAvailable(product.stockQuantity, quantity);
    }

    return {
      product,
      variant,
      unitPriceCents: variant?.priceCents ?? product.priceCents,
      stockQuantity: variant?.stockQuantity ?? product.stockQuantity
    };
  }

  private assertStockAvailable(stockQuantity: number, quantity: number) {
    if (stockQuantity < quantity) {
      throw new BadRequestException({
        message: "Insufficient stock for requested quantity",
        code: "INSUFFICIENT_STOCK",
        stockQuantity,
        quantity
      });
    }
  }

  private serializeCart(cart: {
    id: string;
    storeId: string;
    sessionId: string | null;
    customerEmail: string | null;
    status: string;
    currencyCode: string;
      items: Array<{
        id: string;
        productId: string;
        variantId: string | null;
        variantName: string | null;
        variantSku: string | null;
        productName: string;
        productSlug: string;
        quantity: number;
        unitPriceCents: number;
      compareAtCents: number | null;
      currencyCode: string;
    }>;
  }) {
    const subtotalCents = cart.items.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0
    );

    return {
      id: cart.id,
      storeId: cart.storeId,
      sessionId: cart.sessionId,
      customerEmail: cart.customerEmail,
      status: cart.status,
      currencyCode: cart.currencyCode,
      items: cart.items,
      summary: {
        itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        subtotalCents
      }
    };
  }
}
