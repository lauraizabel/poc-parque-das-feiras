import { Injectable } from "@nestjs/common";
import { StoreMemberRole } from "@prisma/client";
import { prisma } from "@acme/database";
import { DomainBoundary } from "../platform/domain-boundary";

@Injectable()
export class StoresRepository {
  getBoundary(): DomainBoundary {
    return {
      module: "stores",
      description: "Store lifecycle, settings and merchant memberships.",
      responsibilities: ["store profiles", "store settings", "store members", "merchant onboarding"],
      dependsOn: ["database", "auth"]
    };
  }

  createStore(input: {
    name: string;
    slug: string;
    defaultSubdomain: string;
    ownerId: string;
    supportEmail?: string;
    currencyCode?: string;
    locale?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          name: input.name,
          slug: input.slug,
          defaultSubdomain: input.defaultSubdomain,
          ownerId: input.ownerId,
          supportEmail: input.supportEmail,
          currencyCode: input.currencyCode,
          locale: input.locale,
          theme: {
            create: {}
          }
        }
      });

      await tx.storeMember.upsert({
        where: {
          userId_storeId: {
            userId: input.ownerId,
            storeId: store.id
          }
        },
        update: {
          role: StoreMemberRole.STORE_OWNER
        },
        create: {
          userId: input.ownerId,
          storeId: store.id,
          role: StoreMemberRole.STORE_OWNER
        }
      });

      return store;
    });
  }

  findStoreBySlug(slug: string) {
    return prisma.store.findUnique({
      where: { slug }
    });
  }

  findStoreBySubdomain(defaultSubdomain: string) {
    return prisma.store.findUnique({
      where: { defaultSubdomain }
    });
  }

  findStoreById(storeId: string) {
    return prisma.store.findUnique({
      where: { id: storeId },
      include: {
        owner: true
      }
    });
  }

  findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: {
        email: email.toLowerCase()
      }
    });
  }

  findStoreBySlugOrSubdomain(slug: string, defaultSubdomain: string) {
    return prisma.store.findFirst({
      where: {
        OR: [
          { slug },
          { defaultSubdomain }
        ]
      }
    });
  }

  addMember(input: {
    storeId: string;
    userId: string;
    role: StoreMemberRole;
  }) {
    return prisma.storeMember.create({
      data: input
    });
  }

  findStoreMembership(userId: string, storeId: string) {
    return prisma.storeMember.findUnique({
      where: {
        userId_storeId: {
          userId,
          storeId
        }
      }
    });
  }

  listMembers(storeId: string) {
    return prisma.storeMember.findMany({
      where: { storeId },
      include: {
        user: true
      },
      orderBy: [{ createdAt: "asc" }]
    });
  }

  findMemberById(memberId: string) {
    return prisma.storeMember.findUnique({
      where: { id: memberId },
      include: {
        user: true
      }
    });
  }

  updateMemberRole(memberId: string, role: StoreMemberRole) {
    return prisma.storeMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: true
      }
    });
  }

  removeMember(memberId: string) {
    return prisma.storeMember.delete({
      where: { id: memberId }
    });
  }

  listPendingInvites(storeId: string) {
    return prisma.storeMemberInvite.findMany({
      where: { storeId },
      include: {
        invitedByUser: true
      },
      orderBy: [{ createdAt: "asc" }]
    });
  }

  findPendingInviteByEmail(storeId: string, invitedEmail: string) {
    return prisma.storeMemberInvite.findUnique({
      where: {
        storeId_invitedEmail: {
          storeId,
          invitedEmail
        }
      }
    });
  }

  createPendingInvite(input: {
    storeId: string;
    invitedEmail: string;
    role: StoreMemberRole;
    invitedByUserId: string;
  }) {
    return prisma.storeMemberInvite.create({
      data: input,
      include: {
        invitedByUser: true
      }
    });
  }

  findPendingInviteById(inviteId: string) {
    return prisma.storeMemberInvite.findUnique({
      where: { id: inviteId },
      include: {
        invitedByUser: true
      }
    });
  }

  removePendingInvite(inviteId: string) {
    return prisma.storeMemberInvite.delete({
      where: { id: inviteId }
    });
  }

  findStoreTheme(storeId: string) {
    return prisma.storeTheme.findUnique({
      where: { storeId }
    });
  }

  upsertStoreTheme(input: {
    storeId: string;
    primaryColor: string;
    accentColor: string;
    surfaceColor: string;
    logoUrl?: string | null;
    bannerUrl?: string | null;
    heroTitle?: string | null;
    heroSubtitle?: string | null;
    announcementText?: string | null;
  }) {
    return prisma.storeTheme.upsert({
      where: { storeId: input.storeId },
      update: {
        primaryColor: input.primaryColor,
        accentColor: input.accentColor,
        surfaceColor: input.surfaceColor,
        logoUrl: input.logoUrl ?? null,
        bannerUrl: input.bannerUrl ?? null,
        heroTitle: input.heroTitle ?? null,
        heroSubtitle: input.heroSubtitle ?? null,
        announcementText: input.announcementText ?? null
      },
      create: {
        storeId: input.storeId,
        primaryColor: input.primaryColor,
        accentColor: input.accentColor,
        surfaceColor: input.surfaceColor,
        logoUrl: input.logoUrl ?? null,
        bannerUrl: input.bannerUrl ?? null,
        heroTitle: input.heroTitle ?? null,
        heroSubtitle: input.heroSubtitle ?? null,
        announcementText: input.announcementText ?? null
      }
    });
  }

  updateStore(
    storeId: string,
    input: {
      name?: string;
      supportEmail?: string | null;
      currencyCode?: string;
      locale?: string;
    }
  ) {
    return prisma.store.update({
      where: {
        id: storeId
      },
      data: input,
      include: {
        owner: true
      }
    });
  }
}
