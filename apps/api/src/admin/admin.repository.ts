import { Injectable } from "@nestjs/common";
import { prisma } from "@acme/database";
import { Prisma } from "@prisma/client";
import { DomainBoundary } from "../platform/domain-boundary";
import {
  ListAdminDomainsQuery,
  ListAdminOrdersQuery,
  ListAdminStoresQuery,
  ListAdminUsersQuery
} from "./admin.schemas";

@Injectable()
export class AdminRepository {
  getBoundary(): DomainBoundary {
    return {
      module: "admin",
      description: "Operational platform administration and cross-tenant oversight.",
      responsibilities: ["platform metrics", "tenant moderation", "manual interventions", "support tooling"],
      dependsOn: ["database", "auth", "stores", "orders"]
    };
  }

  async getOverview() {
    const [
      totalUsers,
      totalStores,
      totalOrders,
      totalDomains,
      totalPayments,
      storesByStatus,
      ordersByStatus,
      domainsByStatus
    ] = await Promise.all([
      prisma.user.count(),
      prisma.store.count(),
      prisma.order.count(),
      prisma.storeDomain.count(),
      prisma.payment.count(),
      prisma.store.groupBy({
        by: ["status"],
        _count: {
          _all: true
        }
      }),
      prisma.order.groupBy({
        by: ["status"],
        _count: {
          _all: true
        }
      }),
      prisma.storeDomain.groupBy({
        by: ["status"],
        _count: {
          _all: true
        }
      })
    ]);

    return {
      totals: {
        users: totalUsers,
        stores: totalStores,
        orders: totalOrders,
        domains: totalDomains,
        payments: totalPayments
      },
      storesByStatus,
      ordersByStatus,
      domainsByStatus
    };
  }

  listStores(input: ListAdminStoresQuery) {
    const search = input.search?.toLowerCase();
    const where: Prisma.StoreWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } },
              { defaultSubdomain: { contains: search, mode: "insensitive" } },
              { supportEmail: { contains: search, mode: "insensitive" } },
              { owner: { email: { contains: search, mode: "insensitive" } } }
            ]
          }
        : {})
    };

    return prisma.store.findMany({
      where,
      include: {
        owner: true,
        domains: {
          where: {
            status: {
              not: "REMOVED"
            }
          },
          orderBy: [{ createdAt: "desc" }],
          take: 1
        },
        _count: {
          select: {
            storeMembers: true,
            orders: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }],
      take: input.limit
    });
  }

  listUsers(input: ListAdminUsersQuery) {
    const search = input.search?.toLowerCase();
    const where: Prisma.UserWhereInput = {
      ...(input.platformRole ? { platformRole: input.platformRole } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { fullName: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    return prisma.user.findMany({
      where,
      include: {
        _count: {
          select: {
            ownedStores: true,
            storeMembers: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }],
      take: input.limit
    });
  }

  listOrders(input: ListAdminOrdersQuery) {
    const where: Prisma.OrderWhereInput = {
      ...(input.storeId ? { storeId: input.storeId } : {}),
      ...(input.customerEmail ? { customerEmail: input.customerEmail } : {}),
      ...(input.status ? { status: input.status } : {})
    };

    return prisma.order.findMany({
      where,
      include: {
        store: true,
        payment: true,
        items: {
          orderBy: [{ createdAt: "asc" }]
        }
      },
      orderBy: [{ createdAt: "desc" }],
      take: input.limit
    });
  }

  listDomains(input: ListAdminDomainsQuery) {
    const search = input.search?.toLowerCase();
    const where: Prisma.StoreDomainWhereInput = {
      ...(input.storeId ? { storeId: input.storeId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(search
        ? {
            OR: [
              { host: { contains: search, mode: "insensitive" } },
              { store: { name: { contains: search, mode: "insensitive" } } },
              { store: { slug: { contains: search, mode: "insensitive" } } }
            ]
          }
        : {})
    };

    return prisma.storeDomain.findMany({
      where,
      include: {
        store: true
      },
      orderBy: [{ createdAt: "desc" }],
      take: input.limit
    });
  }
}
