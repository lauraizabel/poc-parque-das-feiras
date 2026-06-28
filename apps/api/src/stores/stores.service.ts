import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { StoreMemberRole } from "@prisma/client";
import { StoresRepository } from "./stores.repository";
import {
  CreateStoreInput,
  InviteStoreMemberInput,
  UpdateStoreMemberRoleInput
} from "./stores.schemas";

const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "checkout",
  "dashboard",
  "help",
  "login",
  "panel",
  "root",
  "settings",
  "signup",
  "store",
  "stores",
  "support",
  "www"
]);

@Injectable()
export class StoresService {
  constructor(private readonly storesRepository: StoresRepository) {}

  getBoundary() {
    return this.storesRepository.getBoundary();
  }

  async checkSlugAvailability(input: { slug: string }) {
    const normalizedSlug = this.normalizeSlugCandidate(input.slug);

    if (normalizedSlug.length < 2) {
      return {
        requestedSlug: input.slug,
        normalizedSlug,
        defaultSubdomain: normalizedSlug,
        available: false,
        reason: "invalid",
        message: "Use ao menos 2 caracteres alfanuméricos no slug."
      };
    }

    if (RESERVED_SLUGS.has(normalizedSlug)) {
      return {
        requestedSlug: input.slug,
        normalizedSlug,
        defaultSubdomain: normalizedSlug,
        available: false,
        reason: "reserved",
        message: "Esse slug está reservado para a plataforma."
      };
    }

    const existingStore = await this.storesRepository.findStoreBySlugOrSubdomain(
      normalizedSlug,
      normalizedSlug
    );

    if (existingStore) {
      return {
        requestedSlug: input.slug,
        normalizedSlug,
        defaultSubdomain: normalizedSlug,
        available: false,
        reason: "in_use",
        message: "Esse slug já está em uso por outra loja."
      };
    }

    return {
      requestedSlug: input.slug,
      normalizedSlug,
      defaultSubdomain: normalizedSlug,
      available: true,
      reason: "available",
      message: "Slug disponível para criar a loja."
    };
  }

  async createAuthorizationFixture(input: {
    userId: string;
    role: StoreMemberRole;
    name?: string;
    slug?: string;
  }) {
    const suffix = Math.random().toString(36).slice(2, 8);
    const store = await this.createStore({
      ownerId: input.userId,
      name: input.name ?? `Store ${suffix}`,
      slug: input.slug ?? `store-${suffix}`,
      defaultSubdomain: input.slug ?? `store-${suffix}`
    });

    const membership = await this.storesRepository.addMember({
      storeId: store.id,
      userId: input.userId,
      role: input.role
    });

    return {
      store,
      membership
    };
  }

  async createStore(input: CreateStoreInput & { ownerId: string }) {
    const slug = this.normalizeSlug(input.slug);
    const requestedSubdomain = input.defaultSubdomain
      ? this.normalizeSlug(input.defaultSubdomain)
      : null;

    this.assertAllowedSlug(slug, "slug");
    if (requestedSubdomain) {
      this.assertAllowedSlug(requestedSubdomain, "defaultSubdomain");
    }

    const existingSlug = await this.storesRepository.findStoreBySlug(slug);

    if (existingSlug) {
      throw new BadRequestException("Store slug is already in use");
    }

    const defaultSubdomain = requestedSubdomain
      ? await this.ensureSpecificSubdomainAvailable(requestedSubdomain)
      : await this.generateUniqueDefaultSubdomain(slug);

    return this.storesRepository.createStore({
      ownerId: input.ownerId,
      name: input.name.trim(),
      slug,
      defaultSubdomain,
      supportEmail: input.supportEmail?.toLowerCase(),
      currencyCode: input.currencyCode?.toUpperCase() ?? "BRL",
      locale: input.locale ?? "pt-BR"
    });
  }

  async listMembers(storeId: string) {
    const [members, invites] = await Promise.all([
      this.storesRepository.listMembers(storeId),
      this.storesRepository.listPendingInvites(storeId)
    ]);

    return {
      members: members.map((member: (typeof members)[number]) => ({
        id: member.id,
        userId: member.userId,
        email: member.user.email,
        fullName: member.user.fullName,
        role: member.role,
        status: "ACTIVE",
        createdAt: member.createdAt
      })),
      invites: invites.map((invite: (typeof invites)[number]) => ({
        id: invite.id,
        email: invite.invitedEmail,
        role: invite.role,
        status: "PENDING",
        invitedBy: {
          id: invite.invitedByUser.id,
          email: invite.invitedByUser.email,
          fullName: invite.invitedByUser.fullName
        },
        createdAt: invite.createdAt
      }))
    };
  }

  async inviteMember(input: InviteStoreMemberInput & { storeId: string; invitedByUserId: string }) {
    const email = input.email.toLowerCase();
    const existingInvite = await this.storesRepository.findPendingInviteByEmail(input.storeId, email);

    if (existingInvite) {
      throw new ConflictException("Já existe um convite pendente para este e-mail.");
    }

    const existingUser = await this.storesRepository.findUserByEmail(email);

    if (existingUser) {
      const existingMembership = await this.storesRepository.findStoreMembership(
        existingUser.id,
        input.storeId
      );

      if (existingMembership) {
        throw new ConflictException("Este usuário já participa da loja.");
      }

      const membership = await this.storesRepository.addMember({
        storeId: input.storeId,
        userId: existingUser.id,
        role: input.role
      });

      return {
        status: "ACTIVE" as const,
        member: {
          id: membership.id,
          userId: membership.userId,
          email: existingUser.email,
          fullName: existingUser.fullName,
          role: membership.role,
          createdAt: membership.createdAt
        }
      };
    }

    const invite = await this.storesRepository.createPendingInvite({
      storeId: input.storeId,
      invitedEmail: email,
      role: input.role,
      invitedByUserId: input.invitedByUserId
    });

    return {
      status: "PENDING" as const,
      invite: {
        id: invite.id,
        email: invite.invitedEmail,
        role: invite.role,
        createdAt: invite.createdAt
      }
    };
  }

  async updateMemberRole(
    input: UpdateStoreMemberRoleInput & {
      storeId: string;
      memberId: string;
      actorUserId: string;
    }
  ) {
    const member = await this.storesRepository.findMemberById(input.memberId);

    if (!member || member.storeId !== input.storeId) {
      throw new NotFoundException("Membro da loja não encontrado.");
    }

    if (member.role === StoreMemberRole.STORE_OWNER) {
      throw new ForbiddenException("Não é permitido alterar o papel do owner da loja.");
    }

    if (member.userId === input.actorUserId) {
      throw new ForbiddenException("Você não pode alterar o seu próprio papel.");
    }

    const updatedMember = await this.storesRepository.updateMemberRole(input.memberId, input.role);

    return {
      member: {
        id: updatedMember.id,
        userId: updatedMember.userId,
        email: updatedMember.user.email,
        fullName: updatedMember.user.fullName,
        role: updatedMember.role,
        status: "ACTIVE" as const,
        createdAt: updatedMember.createdAt
      }
    };
  }

  async removeMember(input: { storeId: string; memberId: string; actorUserId: string }) {
    const member = await this.storesRepository.findMemberById(input.memberId);

    if (!member || member.storeId !== input.storeId) {
      throw new NotFoundException("Membro da loja não encontrado.");
    }

    if (member.role === StoreMemberRole.STORE_OWNER) {
      throw new ForbiddenException("Não é permitido remover o owner da loja.");
    }

    if (member.userId === input.actorUserId) {
      throw new ForbiddenException("Você não pode remover a si mesma da loja.");
    }

    await this.storesRepository.removeMember(input.memberId);

    return {
      removed: true
    };
  }

  async removePendingInvite(input: { storeId: string; inviteId: string }) {
    const invite = await this.storesRepository.findPendingInviteById(input.inviteId);

    if (!invite || invite.storeId !== input.storeId) {
      throw new NotFoundException("Convite pendente não encontrado.");
    }

    await this.storesRepository.removePendingInvite(input.inviteId);

    return {
      removed: true
    };
  }

  private normalizeSlug(value: string) {
    const normalized = this.normalizeSlugCandidate(value);

    if (normalized.length < 2) {
      throw new BadRequestException("Slug must contain at least 2 alphanumeric characters");
    }

    return normalized;
  }

  private normalizeSlugCandidate(value: string) {
    return value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private assertAllowedSlug(value: string, field: "slug" | "defaultSubdomain") {
    if (RESERVED_SLUGS.has(value)) {
      throw new BadRequestException(`${field} is reserved`);
    }
  }

  private async ensureSpecificSubdomainAvailable(subdomain: string) {
    const existingSubdomain = await this.storesRepository.findStoreBySubdomain(subdomain);

    if (existingSubdomain) {
      throw new BadRequestException("Default subdomain is already in use");
    }

    return subdomain;
  }

  private async generateUniqueDefaultSubdomain(baseSlug: string) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
      const candidate = `${baseSlug}${suffix}`;
      const existingSubdomain = await this.storesRepository.findStoreBySubdomain(candidate);

      if (!existingSubdomain) {
        return candidate;
      }
    }

    throw new BadRequestException("Could not generate a unique default subdomain");
  }
}
