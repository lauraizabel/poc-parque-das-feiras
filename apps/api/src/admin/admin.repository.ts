import { Injectable } from "@nestjs/common";
import { prisma } from "@acme/database";
import { Prisma } from "@prisma/client";
import { DomainBoundary } from "../platform/domain-boundary";
import {
  ListAdminDomainsQuery,
  ListAdminOrdersQuery,
  ListAdminPaymentsQuery,
  ListAdminStoresQuery,
  ListAdminUsersQuery,
  UpdateAdminStoreStatusInput
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
      ...((input.createdFrom || input.createdTo)
        ? {
            createdAt: {
              ...(input.createdFrom ? { gte: input.createdFrom } : {}),
              ...(input.createdTo ? { lte: input.createdTo } : {})
            }
          }
        : {}),
      ...(input.hasActiveDomain === undefined
        ? {}
        : input.hasActiveDomain
          ? {
              domains: {
                some: {
                  status: "ACTIVE"
                }
              }
            }
          : {
              domains: {
                none: {
                  status: "ACTIVE"
                }
              }
            }),
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

  findStoreById(storeId: string) {
    return prisma.store.findUnique({
      where: {
        id: storeId
      },
      include: {
        owner: true,
        domains: {
          orderBy: [{ createdAt: "desc" }]
        },
        _count: {
          select: {
            storeMembers: true,
            memberInvites: true,
            orders: true,
            payments: true,
            products: true
          }
        }
      }
    });
  }

  updateStoreStatus(storeId: string, input: UpdateAdminStoreStatusInput) {
    return prisma.store.update({
      where: {
        id: storeId
      },
      data: {
        status: input.status
      },
      include: {
        owner: true,
        domains: {
          orderBy: [{ createdAt: "desc" }]
        },
        _count: {
          select: {
            storeMembers: true,
            memberInvites: true,
            orders: true,
            payments: true,
            products: true
          }
        }
      }
    });
  }

  listUsers(input: ListAdminUsersQuery) {
    const search = input.search?.toLowerCase();
    const where: Prisma.UserWhereInput = {
      ...(input.platformRole ? { platformRole: input.platformRole } : {}),
      ...((input.storeId || input.membershipRole)
        ? {
            storeMembers: {
              some: {
                ...(input.storeId ? { storeId: input.storeId } : {}),
                ...(input.membershipRole ? { role: input.membershipRole } : {})
              }
            }
          }
        : {}),
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
        storeMembers: {
          include: {
            store: true
          },
          orderBy: [{ createdAt: "asc" }]
        },
        ownedStores: {
          orderBy: [{ createdAt: "asc" }]
        },
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

  findUserById(userId: string) {
    return prisma.user.findUnique({
      where: {
        id: userId
      },
      include: {
        storeMembers: {
          include: {
            store: true
          },
          orderBy: [{ createdAt: "asc" }]
        },
        ownedStores: {
          include: {
            domains: {
              where: {
                status: {
                  not: "REMOVED"
                }
              },
              orderBy: [{ createdAt: "desc" }],
              take: 1
            }
          },
          orderBy: [{ createdAt: "asc" }]
        }
      }
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
        customer: true,
        payment: true,
        shippingMethod: true,
        shipment: true,
        items: {
          orderBy: [{ createdAt: "asc" }]
        }
      },
      orderBy: [{ createdAt: "desc" }],
      take: input.limit
    });
  }

  findOrderById(orderId: string) {
    return prisma.order.findUnique({
      where: {
        id: orderId
      },
      include: {
        store: true,
        customer: true,
        payment: true,
        shippingMethod: true,
        shipment: true,
        items: {
          orderBy: [{ createdAt: "asc" }]
        }
      }
    });
  }

  listPayments(input: ListAdminPaymentsQuery) {
    const where: Prisma.PaymentWhereInput = {
      ...(input.storeId ? { storeId: input.storeId } : {}),
      ...(input.customerEmail
        ? {
            customer: {
              email: input.customerEmail
            }
          }
        : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.provider ? { provider: input.provider } : {}),
      ...(input.orderId
        ? {
            orders: {
              some: {
                id: input.orderId
              }
            }
          }
        : {})
    };

    return prisma.payment.findMany({
      where,
      include: {
        store: true,
        customer: true,
        orders: {
          orderBy: [{ createdAt: "desc" }]
        },
        transactions: {
          orderBy: [{ createdAt: "asc" }]
        }
      },
      orderBy: [{ createdAt: "desc" }],
      take: input.limit
    });
  }

  findPaymentById(paymentId: string) {
    return prisma.payment.findUnique({
      where: {
        id: paymentId
      },
      include: {
        store: true,
        customer: true,
        cart: {
          include: {
            items: true
          }
        },
        orders: {
          include: {
            shipment: true
          },
          orderBy: [{ createdAt: "desc" }]
        },
        transactions: {
          orderBy: [{ createdAt: "asc" }]
        }
      }
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
