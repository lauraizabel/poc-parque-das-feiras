import { BadRequestException, Injectable } from "@nestjs/common";
import { StoreMemberRole } from "@prisma/client";
import { StoresRepository } from "./stores.repository";
import { CreateStoreInput } from "./stores.schemas";

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
    const defaultSubdomain = this.normalizeSlug(input.defaultSubdomain ?? slug);

    this.assertAllowedSlug(slug, "slug");
    this.assertAllowedSlug(defaultSubdomain, "defaultSubdomain");

    const [existingSlug, existingSubdomain] = await Promise.all([
      this.storesRepository.findStoreBySlug(slug),
      this.storesRepository.findStoreBySubdomain(defaultSubdomain)
    ]);

    if (existingSlug) {
      throw new BadRequestException("Store slug is already in use");
    }

    if (existingSubdomain) {
      throw new BadRequestException("Default subdomain is already in use");
    }

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

  private normalizeSlug(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (normalized.length < 2) {
      throw new BadRequestException("Slug must contain at least 2 alphanumeric characters");
    }

    return normalized;
  }

  private assertAllowedSlug(value: string, field: "slug" | "defaultSubdomain") {
    if (RESERVED_SLUGS.has(value)) {
      throw new BadRequestException(`${field} is reserved`);
    }
  }
}
