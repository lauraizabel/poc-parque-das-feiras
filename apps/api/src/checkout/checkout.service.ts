import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { OrderStatus, ProductStatus, ShippingMethodType } from "@prisma/client";
import { PublicStorefrontContext } from "../auth/auth.types";
import { CartRepository } from "../cart/cart.repository";
import { CatalogRepository } from "../catalog/catalog.repository";
import { OrdersRepository } from "../orders/orders.repository";
import { PaymentsRepository } from "../payments/payments.repository";
import { ShippingRepository } from "../shipping/shipping.repository";
import { CheckoutRepository } from "./checkout.repository";
import { CalculateShippingOptionsInput, CreateOrderFromCartInput } from "./checkout.schemas";

@Injectable()
export class CheckoutService {
  constructor(
    private readonly checkoutRepository: CheckoutRepository,
    private readonly cartRepository: CartRepository,
    private readonly catalogRepository: CatalogRepository,
    private readonly ordersRepository: OrdersRepository,
    private readonly paymentsRepository: PaymentsRepository,
    private readonly shippingRepository: ShippingRepository
  ) {}

  getBoundary() {
    return this.checkoutRepository.getBoundary();
  }

  async calculateShippingOptions(
    publicStore: PublicStorefrontContext,
    input: CalculateShippingOptionsInput
  ) {
    const cart = await this.findActiveCart(publicStore.storeId, input);

    if (!cart) {
      throw new NotFoundException({
        message: "Cart not found",
        code: "CART_NOT_FOUND"
      });
    }

    if (cart.items.length === 0) {
      throw new BadRequestException({
        message: "Cart is empty",
        code: "CART_EMPTY"
      });
    }

    const subtotalCents = cart.items.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0
    );
    const shippingOptions = await this.resolveShippingOptions(publicStore.storeId, subtotalCents);

    return {
      store: publicStore,
      cart: {
        id: cart.id,
        currencyCode: cart.currencyCode,
        subtotalCents
      },
      shippingOptions
    };
  }

  async createOrderFromCart(
    publicStore: PublicStorefrontContext,
    input: CreateOrderFromCartInput
  ) {
    const cart = await this.findActiveCart(publicStore.storeId, input);

    if (!cart) {
      throw new NotFoundException({
        message: "Cart not found",
        code: "CART_NOT_FOUND"
      });
    }

    if (cart.items.length === 0) {
      throw new BadRequestException({
        message: "Cart is empty",
        code: "CART_EMPTY"
      });
    }

    const products = await this.catalogRepository.findProductsByIds(
      publicStore.storeId,
      cart.items.map((item) => item.productId)
    );
    const productsById = new Map(products.map((product) => [product.id, product]));

    const stockAdjustments = cart.items.map((item) => {
      const product = productsById.get(item.productId);

      if (!product) {
        throw new NotFoundException({
          message: "Product not found for this storefront",
          code: "PRODUCT_NOT_FOUND",
          productId: item.productId
        });
      }

      if (product.status !== ProductStatus.ACTIVE) {
        throw new BadRequestException({
          message: "Product is not available for checkout",
          code: "PRODUCT_NOT_AVAILABLE",
          productId: item.productId,
          status: product.status
        });
      }

      if (product.stockQuantity < item.quantity) {
        throw new BadRequestException({
          message: "Insufficient stock for requested quantity",
          code: "INSUFFICIENT_STOCK",
          productId: item.productId,
          stockQuantity: product.stockQuantity,
          quantity: item.quantity
        });
      }

      const nextStockQuantity = product.stockQuantity - item.quantity;

      return {
        productId: item.productId,
        nextStockQuantity,
        nextStatus:
          nextStockQuantity > 0 ? ProductStatus.ACTIVE : ProductStatus.OUT_OF_STOCK
      };
    });

    const customerEmail = input.customerEmail.trim().toLowerCase();
    const existingCustomer = await this.paymentsRepository.findCustomerByEmail(
      publicStore.storeId,
      customerEmail
    );
    const customer =
      existingCustomer ??
      (await this.paymentsRepository.createCustomer({
        storeId: publicStore.storeId,
        email: customerEmail,
        fullName: input.customerFullName.trim(),
        phoneNumber: input.customerPhoneNumber?.trim()
      }));

    const subtotalCents = cart.items.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0
    );
    const shippingOptions = await this.resolveShippingOptions(publicStore.storeId, subtotalCents);
    const selectedShippingOption = shippingOptions.find(
      (option) => option.id === input.shippingMethodId
    );

    if (!selectedShippingOption) {
      throw new BadRequestException({
        message: "Shipping method is not available for this order",
        code: "SHIPPING_METHOD_UNAVAILABLE",
        shippingMethodId: input.shippingMethodId
      });
    }

    const shippingCents = selectedShippingOption.priceCents;
    const discountCents = input.discountCents ?? 0;
    const totalCents = subtotalCents + shippingCents - discountCents;

    if (totalCents < 0) {
      throw new BadRequestException({
        message: "Order total cannot be negative",
        code: "INVALID_ORDER_TOTAL",
        subtotalCents,
        shippingCents,
        discountCents
      });
    }

    const billingRecipientName = input.billingRecipientName?.trim() || input.shippingRecipientName.trim();
    const billingPhoneNumber = input.billingPhoneNumber?.trim() || input.shippingPhoneNumber?.trim() || null;
    const billingPostalCode = input.billingPostalCode?.trim() || input.shippingPostalCode.trim();
    const billingState = input.billingState?.trim() || input.shippingState.trim();
    const billingCity = input.billingCity?.trim() || input.shippingCity.trim();
    const billingDistrict = input.billingDistrict?.trim() || input.shippingDistrict.trim();
    const billingStreet = input.billingStreet?.trim() || input.shippingStreet.trim();
    const billingNumber = input.billingNumber?.trim() || input.shippingNumber.trim();
    const billingComplement = input.billingComplement?.trim() || input.shippingComplement?.trim() || null;
    const publicAccessToken = randomBytes(24).toString("hex");
    const publicAccessTokenHash = this.hashPublicAccessToken(publicAccessToken);

    const order = await this.checkoutRepository.createOrderFromCart({
      storeId: publicStore.storeId,
      cartId: cart.id,
      customerId: customer.id,
      shippingMethodId: selectedShippingOption.id,
      publicAccessTokenHash,
      shippingMethodName: selectedShippingOption.name,
      shippingEstimatedDaysMin: selectedShippingOption.estimatedDaysMin,
      shippingEstimatedDaysMax: selectedShippingOption.estimatedDaysMax,
      currencyCode: cart.currencyCode,
      subtotalCents,
      shippingCents,
      discountCents,
      totalCents,
      customerEmail,
      customerFullName: input.customerFullName.trim(),
      customerPhoneNumber: input.customerPhoneNumber?.trim() || null,
      shippingRecipientName: input.shippingRecipientName.trim(),
      shippingPhoneNumber: input.shippingPhoneNumber?.trim() || null,
      shippingPostalCode: input.shippingPostalCode.trim(),
      shippingState: input.shippingState.trim(),
      shippingCity: input.shippingCity.trim(),
      shippingDistrict: input.shippingDistrict.trim(),
      shippingStreet: input.shippingStreet.trim(),
      shippingNumber: input.shippingNumber.trim(),
      shippingComplement: input.shippingComplement?.trim() || null,
      billingRecipientName,
      billingPhoneNumber,
      billingPostalCode,
      billingState,
      billingCity,
      billingDistrict,
      billingStreet,
      billingNumber,
      billingComplement,
      notes: input.notes?.trim() || null,
      items: cart.items.map((item) => {
        const product = productsById.get(item.productId)!;

        return {
          productId: item.productId,
          productName: item.productName,
          productSlug: item.productSlug,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          compareAtCents: item.compareAtCents,
          currencyCode: item.currencyCode,
          sku: product.sku ?? null,
          categoryName: product.category?.name ?? null,
          categorySlug: product.category?.slug ?? null,
          totalCents: item.unitPriceCents * item.quantity
        };
      }),
      stockAdjustments
    });

    const storedOrder = await this.ordersRepository.getOrderById(order.id);

    return {
      store: publicStore,
      customerAccess: {
        orderId: order.id,
        token: publicAccessToken,
        path: `/orders/${order.id}?token=${publicAccessToken}`
      },
      order: {
        ...storedOrder,
        status: storedOrder?.status ?? OrderStatus.CREATED
      }
    };
  }

  private async findActiveCart(
    storeId: string,
    input: Pick<CreateOrderFromCartInput, "sessionId" | "customerEmail"> | CalculateShippingOptionsInput
  ) {
    const sessionId = input.sessionId?.trim() || null;
    const customerEmail = input.customerEmail.trim().toLowerCase();

    return sessionId
      ? await this.cartRepository.findActiveCartBySession(storeId, sessionId)
      : await this.cartRepository.findActiveCartByCustomerEmail(storeId, customerEmail);
  }

  private async resolveShippingOptions(storeId: string, subtotalCents: number) {
    const shippingMethods = await this.shippingRepository.listActiveShippingMethodsByStore(storeId);

    const eligibleMethods = shippingMethods.filter((method) => {
      const meetsMinimum =
        method.minimumOrderCents === null || subtotalCents >= method.minimumOrderCents;
      const meetsMaximum =
        method.maximumOrderCents === null || subtotalCents <= method.maximumOrderCents;

      return meetsMinimum && meetsMaximum;
    });

    if (eligibleMethods.length === 0) {
      throw new BadRequestException({
        message: "No shipping methods are available for this order",
        code: "NO_SHIPPING_METHODS_AVAILABLE",
        subtotalCents
      });
    }

    return eligibleMethods.map((method) => ({
      id: method.id,
      name: method.name,
      description: method.description,
      type: method.type,
      priceCents: method.priceCents,
      estimatedDaysMin: method.estimatedDaysMin,
      estimatedDaysMax: method.estimatedDaysMax,
      isDefault: method.isDefault,
      totalCents: subtotalCents + method.priceCents,
      note:
        method.type === ShippingMethodType.LOCAL_PICKUP
          ? "Retirada local sem integracao logística no MVP."
          : "Frete calculado por regra fixa simples no MVP."
    }));
  }

  private hashPublicAccessToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}
