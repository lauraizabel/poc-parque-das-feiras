import { Injectable, NotFoundException } from "@nestjs/common";
import { AdminRepository } from "./admin.repository";
import {
  ListAdminDomainsQuery,
  ListAdminOrdersQuery,
  ListAdminPaymentsQuery,
  ListAdminStoresQuery,
  ListAdminUsersQuery,
  UpdateAdminStoreStatusInput
} from "./admin.schemas";

@Injectable()
export class AdminService {
  constructor(private readonly adminRepository: AdminRepository) {}

  getBoundary() {
    return this.adminRepository.getBoundary();
  }

  async getOverview() {
    const overview = await this.adminRepository.getOverview();

    return {
      totals: overview.totals,
      storesByStatus: overview.storesByStatus.map((entry) => ({
        status: entry.status,
        count: entry._count._all
      })),
      ordersByStatus: overview.ordersByStatus.map((entry) => ({
        status: entry.status,
        count: entry._count._all
      })),
      domainsByStatus: overview.domainsByStatus.map((entry) => ({
        status: entry.status,
        count: entry._count._all
      }))
    };
  }

  async listStores(input: ListAdminStoresQuery) {
    const stores = await this.adminRepository.listStores(input);

    return {
      stores: stores.map((store) => ({
        id: store.id,
        name: store.name,
        slug: store.slug,
        defaultSubdomain: store.defaultSubdomain,
        status: store.status,
        currencyCode: store.currencyCode,
        locale: store.locale,
        supportEmail: store.supportEmail,
        owner: {
          id: store.owner.id,
          email: store.owner.email,
          fullName: store.owner.fullName
        },
        activeDomain: store.domains[0]
          ? {
              id: store.domains[0].id,
              host: store.domains[0].host,
              status: store.domains[0].status
            }
          : null,
        membersCount: store._count.storeMembers,
        ordersCount: store._count.orders,
        createdAt: store.createdAt
      }))
    };
  }

  async getStoreDetail(storeId: string) {
    const store = await this.adminRepository.findStoreById(storeId);

    if (!store) {
      throw new NotFoundException("Store not found");
    }

    return {
      store: this.mapStoreDetail(store)
    };
  }

  async updateStoreStatus(storeId: string, input: UpdateAdminStoreStatusInput) {
    const store = await this.adminRepository.findStoreById(storeId);

    if (!store) {
      throw new NotFoundException("Store not found");
    }

    const updatedStore = await this.adminRepository.updateStoreStatus(storeId, input);

    return {
      store: this.mapStoreDetail(updatedStore)
    };
  }

  async listUsers(input: ListAdminUsersQuery) {
    const users = await this.adminRepository.listUsers(input);

    return {
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        platformRole: user.platformRole,
        ownedStoresCount: user._count.ownedStores,
        membershipsCount: user._count.storeMembers,
        memberships: user.storeMembers.map((membership) => ({
          storeId: membership.storeId,
          role: membership.role,
          store: {
            id: membership.store.id,
            name: membership.store.name,
            slug: membership.store.slug
          }
        })),
        createdAt: user.createdAt
      }))
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.adminRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        platformRole: user.platformRole,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
        memberships: user.storeMembers.map((membership) => ({
          storeId: membership.storeId,
          role: membership.role,
          createdAt: membership.createdAt,
          store: {
            id: membership.store.id,
            name: membership.store.name,
            slug: membership.store.slug,
            status: membership.store.status
          }
        })),
        ownedStores: user.ownedStores.map((store) => ({
          id: store.id,
          name: store.name,
          slug: store.slug,
          status: store.status,
          defaultSubdomain: store.defaultSubdomain,
          activeDomain: store.domains[0]
            ? {
                id: store.domains[0].id,
                host: store.domains[0].host,
                status: store.domains[0].status
              }
            : null
        }))
      }
    };
  }

  async listOrders(input: ListAdminOrdersQuery) {
    const orders = await this.adminRepository.listOrders(input);

    return {
      orders: orders.map((order) => ({
        id: order.id,
        store: {
          id: order.store.id,
          name: order.store.name,
          slug: order.store.slug
        },
        status: order.status,
        customerEmail: order.customerEmail,
        customerFullName: order.customerFullName,
        totalCents: order.totalCents,
        currencyCode: order.currencyCode,
        shipment: order.shipment
          ? {
              id: order.shipment.id,
              status: order.shipment.status,
              trackingCode: order.shipment.trackingCode
            }
          : null,
        payment: order.payment
          ? {
              id: order.payment.id,
              provider: order.payment.provider,
              status: order.payment.status,
              amountCents: order.payment.amountCents
            }
          : null,
        itemsCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        createdAt: order.createdAt
      }))
    };
  }

  async getOrderDetail(orderId: string) {
    const order = await this.adminRepository.findOrderById(orderId);

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return {
      order: {
        id: order.id,
        status: order.status,
        currencyCode: order.currencyCode,
        subtotalCents: order.subtotalCents,
        shippingCents: order.shippingCents,
        discountCents: order.discountCents,
        totalCents: order.totalCents,
        customerEmail: order.customerEmail,
        customerFullName: order.customerFullName,
        customerPhoneNumber: order.customerPhoneNumber,
        store: {
          id: order.store.id,
          name: order.store.name,
          slug: order.store.slug
        },
        payment: order.payment
          ? {
              id: order.payment.id,
              provider: order.payment.provider,
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
              id: order.shipment.id,
              status: order.shipment.status,
              carrierName: order.shipment.carrierName,
              serviceName: order.shipment.serviceName,
              trackingCode: order.shipment.trackingCode,
              trackingUrl: order.shipment.trackingUrl
            }
          : null,
        items: order.items.map((item) => ({
          id: item.id,
          productName: item.productName,
          productSlug: item.productSlug,
          quantity: item.quantity,
          totalCents: item.totalCents
        })),
        createdAt: order.createdAt
      }
    };
  }

  async listPayments(input: ListAdminPaymentsQuery) {
    const payments = await this.adminRepository.listPayments(input);

    return {
      payments: payments.map((payment) => ({
        id: payment.id,
        store: {
          id: payment.store.id,
          name: payment.store.name,
          slug: payment.store.slug
        },
        customer: payment.customer
          ? {
              id: payment.customer.id,
              email: payment.customer.email,
              fullName: payment.customer.fullName
            }
          : null,
        provider: payment.provider,
        status: payment.status,
        amountCents: payment.amountCents,
        currencyCode: payment.currencyCode,
        attemptCount: payment.attemptCount,
        externalPaymentId: payment.externalPaymentId,
        failureCode: payment.failureCode,
        failureMessage: payment.failureMessage,
        orders: payment.orders.map((order) => ({
          id: order.id,
          status: order.status,
          customerEmail: order.customerEmail
        })),
        transactionsCount: payment.transactions.length,
        createdAt: payment.createdAt
      }))
    };
  }

  async getPaymentDetail(paymentId: string) {
    const payment = await this.adminRepository.findPaymentById(paymentId);

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    return {
      payment: {
        id: payment.id,
        provider: payment.provider,
        status: payment.status,
        currencyCode: payment.currencyCode,
        amountCents: payment.amountCents,
        attemptCount: payment.attemptCount,
        externalPaymentId: payment.externalPaymentId,
        externalReference: payment.externalReference,
        failureCode: payment.failureCode,
        failureMessage: payment.failureMessage,
        paidAt: payment.paidAt,
        expiresAt: payment.expiresAt,
        store: {
          id: payment.store.id,
          name: payment.store.name,
          slug: payment.store.slug
        },
        customer: payment.customer
          ? {
              id: payment.customer.id,
              email: payment.customer.email,
              fullName: payment.customer.fullName
            }
          : null,
        cart: payment.cart
          ? {
              id: payment.cart.id,
              sessionId: payment.cart.sessionId,
              customerEmail: payment.cart.customerEmail,
              itemsCount: payment.cart.items.reduce((sum, item) => sum + item.quantity, 0)
            }
          : null,
        orders: payment.orders.map((order) => ({
          id: order.id,
          status: order.status,
          customerEmail: order.customerEmail,
          totalCents: order.totalCents,
          shipment: order.shipment
            ? {
                id: order.shipment.id,
                status: order.shipment.status
              }
            : null
        })),
        transactions: payment.transactions.map((transaction) => ({
          id: transaction.id,
          kind: transaction.kind,
          status: transaction.status,
          externalTransactionId: transaction.externalTransactionId,
          errorCode: transaction.errorCode,
          errorMessage: transaction.errorMessage,
          occurredAt: transaction.occurredAt,
          createdAt: transaction.createdAt
        })),
        createdAt: payment.createdAt
      }
    };
  }

  async listDomains(input: ListAdminDomainsQuery) {
    const domains = await this.adminRepository.listDomains(input);

    return {
      domains: domains.map((domain) => ({
        id: domain.id,
        host: domain.host,
        status: domain.status,
        dnsTargetValue: domain.dnsTargetValue,
        activatedAt: domain.activatedAt,
        store: {
          id: domain.store.id,
          name: domain.store.name,
          slug: domain.store.slug
        },
        createdAt: domain.createdAt
      }))
    };
  }

  private mapStoreDetail(store: Awaited<ReturnType<AdminRepository["findStoreById"]>>) {
    const resolvedStore = store!;

    return {
      id: resolvedStore.id,
      name: resolvedStore.name,
      slug: resolvedStore.slug,
      defaultSubdomain: resolvedStore.defaultSubdomain,
      status: resolvedStore.status,
      supportEmail: resolvedStore.supportEmail,
      currencyCode: resolvedStore.currencyCode,
      locale: resolvedStore.locale,
      owner: {
        id: resolvedStore.owner.id,
        email: resolvedStore.owner.email,
        fullName: resolvedStore.owner.fullName
      },
      counts: {
        members: resolvedStore._count.storeMembers,
        pendingInvites: resolvedStore._count.memberInvites,
        orders: resolvedStore._count.orders,
        payments: resolvedStore._count.payments,
        products: resolvedStore._count.products
      },
      domains: resolvedStore.domains.map((domain) => ({
        id: domain.id,
        host: domain.host,
        status: domain.status,
        dnsTargetValue: domain.dnsTargetValue,
        dnsLastCheckedAt: domain.dnsLastCheckedAt,
        activatedAt: domain.activatedAt,
        createdAt: domain.createdAt
      })),
      createdAt: resolvedStore.createdAt,
      updatedAt: resolvedStore.updatedAt
    };
  }
}
