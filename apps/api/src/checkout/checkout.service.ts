import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { OrderStatus, ProductStatus } from "@prisma/client";
import { PublicStorefrontContext } from "../auth/auth.types";
import { CartRepository } from "../cart/cart.repository";
import { CatalogRepository } from "../catalog/catalog.repository";
import { OrdersRepository } from "../orders/orders.repository";
import { PaymentsRepository } from "../payments/payments.repository";
import { CheckoutRepository } from "./checkout.repository";
import { CreateOrderFromCartInput } from "./checkout.schemas";

@Injectable()
export class CheckoutService {
  constructor(
    private readonly checkoutRepository: CheckoutRepository,
    private readonly cartRepository: CartRepository,
    private readonly catalogRepository: CatalogRepository,
    private readonly ordersRepository: OrdersRepository,
    private readonly paymentsRepository: PaymentsRepository
  ) {}

  getBoundary() {
    return this.checkoutRepository.getBoundary();
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
    const shippingCents = input.shippingCents ?? 0;
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

    const order = await this.checkoutRepository.createOrderFromCart({
      storeId: publicStore.storeId,
      cartId: cart.id,
      customerId: customer.id,
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
      order: {
        ...storedOrder,
        status: storedOrder?.status ?? OrderStatus.CREATED
      }
    };
  }

  private async findActiveCart(storeId: string, input: CreateOrderFromCartInput) {
    const sessionId = input.sessionId?.trim() || null;
    const customerEmail = input.customerEmail.trim().toLowerCase();

    return sessionId
      ? await this.cartRepository.findActiveCartBySession(storeId, sessionId)
      : await this.cartRepository.findActiveCartByCustomerEmail(storeId, customerEmail);
  }
}
