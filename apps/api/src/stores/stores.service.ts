import { Injectable } from "@nestjs/common";
import { StoreMemberRole } from "@prisma/client";
import { StoresRepository } from "./stores.repository";

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
    const store = await this.storesRepository.createStore({
      name: input.name ?? `Store ${suffix}`,
      slug: input.slug ?? `store-${suffix}`
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
}
