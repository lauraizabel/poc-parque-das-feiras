import { Injectable, NotFoundException } from "@nestjs/common";
import { AdminRepository } from "./admin.repository";
import {
  ListAdminDomainsQuery,
  ListAdminOrdersQuery,
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
