const { scryptSync, randomBytes } = require("node:crypto");
const {
  PrismaClient,
  CategoryStatus,
  PlatformRole,
  ProductStatus,
  ShippingMethodStatus,
  ShippingMethodType,
  StoreMemberRole,
  StoreStatus
} = require("@prisma/client");

const prisma = new PrismaClient();

const DEFAULT_ADMIN_PASSWORD = "AdminSeed123";
const DEFAULT_STAFF_PASSWORD = "DemoStore123";

const seedConfig = {
  admin: {
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@acme.local",
    fullName: process.env.SEED_ADMIN_NAME ?? "Platform Admin",
    password: process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD
  },
  owner: {
    email: process.env.SEED_OWNER_EMAIL ?? "owner@demo-store.local",
    fullName: process.env.SEED_OWNER_NAME ?? "Demo Store Owner",
    password: process.env.SEED_OWNER_PASSWORD ?? DEFAULT_STAFF_PASSWORD
  },
  manager: {
    email: process.env.SEED_MANAGER_EMAIL ?? "manager@demo-store.local",
    fullName: process.env.SEED_MANAGER_NAME ?? "Demo Store Manager",
    password: process.env.SEED_MANAGER_PASSWORD ?? DEFAULT_STAFF_PASSWORD
  },
  support: {
    email: process.env.SEED_SUPPORT_EMAIL ?? "support@demo-store.local",
    fullName: process.env.SEED_SUPPORT_NAME ?? "Demo Store Support",
    password: process.env.SEED_SUPPORT_PASSWORD ?? DEFAULT_STAFF_PASSWORD
  },
  store: {
    name: process.env.SEED_STORE_NAME ?? "Loja Demo",
    slug: process.env.SEED_STORE_SLUG ?? "loja-demo",
    defaultSubdomain: process.env.SEED_STORE_SUBDOMAIN ?? "loja-demo",
    supportEmail: process.env.SEED_STORE_SUPPORT_EMAIL ?? "support@demo-store.local",
    currencyCode: process.env.SEED_STORE_CURRENCY ?? "BRL",
    locale: process.env.SEED_STORE_LOCALE ?? "pt-BR"
  },
  category: {
    name: process.env.SEED_CATEGORY_NAME ?? "Cafe Especial",
    slug: process.env.SEED_CATEGORY_SLUG ?? "cafe-especial"
  },
  product: {
    name: process.env.SEED_PRODUCT_NAME ?? "Moedor Premium",
    slug: process.env.SEED_PRODUCT_SLUG ?? "moedor-premium",
    sku: process.env.SEED_PRODUCT_SKU ?? "MP-001",
    description:
      process.env.SEED_PRODUCT_DESCRIPTION ??
      "Produto seedado para validar catalogo, carrinho e checkout no ambiente local.",
    priceCents: Number(process.env.SEED_PRODUCT_PRICE_CENTS ?? 18990),
    compareAtCents: Number(process.env.SEED_PRODUCT_COMPARE_AT_CENTS ?? 21990),
    stockQuantity: Number(process.env.SEED_PRODUCT_STOCK_QUANTITY ?? 12)
  },
  shippingMethod: {
    name: process.env.SEED_SHIPPING_NAME ?? "Entrega Padrao",
    description:
      process.env.SEED_SHIPPING_DESCRIPTION ??
      "Frete base seedado para validar checkout e operacao do pedido.",
    priceCents: Number(process.env.SEED_SHIPPING_PRICE_CENTS ?? 2400),
    estimatedDaysMin: Number(process.env.SEED_SHIPPING_DAYS_MIN ?? 2),
    estimatedDaysMax: Number(process.env.SEED_SHIPPING_DAYS_MAX ?? 5)
  },
  showcaseStore: {
    name: process.env.SEED_SHOWCASE_STORE_NAME ?? "Loja Vitrine",
    slug: process.env.SEED_SHOWCASE_STORE_SLUG ?? "loja-vitrine",
    defaultSubdomain: process.env.SEED_SHOWCASE_STORE_SUBDOMAIN ?? "loja-vitrine",
    supportEmail:
      process.env.SEED_SHOWCASE_STORE_SUPPORT_EMAIL ?? "support@showcase-store.local",
    currencyCode: process.env.SEED_SHOWCASE_STORE_CURRENCY ?? "BRL",
    locale: process.env.SEED_SHOWCASE_STORE_LOCALE ?? "pt-BR"
  }
};

async function main() {
  assertPasswordsAreDocumented();

  const adminUser = await upsertUser({
    email: seedConfig.admin.email,
    fullName: seedConfig.admin.fullName,
    password: seedConfig.admin.password,
    platformRole: PlatformRole.PLATFORM_ADMIN
  });

  const ownerUser = await upsertUser({
    email: seedConfig.owner.email,
    fullName: seedConfig.owner.fullName,
    password: seedConfig.owner.password,
    platformRole: PlatformRole.CUSTOMER
  });

  const managerUser = await upsertUser({
    email: seedConfig.manager.email,
    fullName: seedConfig.manager.fullName,
    password: seedConfig.manager.password,
    platformRole: PlatformRole.CUSTOMER
  });

  const supportUser = await upsertUser({
    email: seedConfig.support.email,
    fullName: seedConfig.support.fullName,
    password: seedConfig.support.password,
    platformRole: PlatformRole.CUSTOMER
  });

  const store = await prisma.store.upsert({
    where: {
      slug: seedConfig.store.slug
    },
    create: {
      name: seedConfig.store.name,
      slug: seedConfig.store.slug,
      defaultSubdomain: seedConfig.store.defaultSubdomain,
      ownerId: ownerUser.id,
      supportEmail: seedConfig.store.supportEmail,
      currencyCode: seedConfig.store.currencyCode,
      locale: seedConfig.store.locale,
      status: StoreStatus.ACTIVE
    },
    update: {
      name: seedConfig.store.name,
      defaultSubdomain: seedConfig.store.defaultSubdomain,
      ownerId: ownerUser.id,
      supportEmail: seedConfig.store.supportEmail,
      currencyCode: seedConfig.store.currencyCode,
      locale: seedConfig.store.locale,
      status: StoreStatus.ACTIVE
    }
  });

  await upsertMembership(ownerUser.id, store.id, StoreMemberRole.STORE_OWNER);
  await upsertMembership(managerUser.id, store.id, StoreMemberRole.STORE_MANAGER);
  await upsertMembership(supportUser.id, store.id, StoreMemberRole.STORE_SUPPORT);

  const showcaseStore = await prisma.store.upsert({
    where: {
      slug: seedConfig.showcaseStore.slug
    },
    create: {
      name: seedConfig.showcaseStore.name,
      slug: seedConfig.showcaseStore.slug,
      defaultSubdomain: seedConfig.showcaseStore.defaultSubdomain,
      ownerId: ownerUser.id,
      supportEmail: seedConfig.showcaseStore.supportEmail,
      currencyCode: seedConfig.showcaseStore.currencyCode,
      locale: seedConfig.showcaseStore.locale,
      status: StoreStatus.ACTIVE
    },
    update: {
      name: seedConfig.showcaseStore.name,
      defaultSubdomain: seedConfig.showcaseStore.defaultSubdomain,
      ownerId: ownerUser.id,
      supportEmail: seedConfig.showcaseStore.supportEmail,
      currencyCode: seedConfig.showcaseStore.currencyCode,
      locale: seedConfig.showcaseStore.locale,
      status: StoreStatus.ACTIVE
    }
  });

  await upsertMembership(ownerUser.id, showcaseStore.id, StoreMemberRole.STORE_OWNER);

  const category = await prisma.category.upsert({
    where: {
      storeId_slug: {
        storeId: store.id,
        slug: seedConfig.category.slug
      }
    },
    create: {
      storeId: store.id,
      name: seedConfig.category.name,
      slug: seedConfig.category.slug,
      status: CategoryStatus.ACTIVE,
      sortOrder: 1
    },
    update: {
      name: seedConfig.category.name,
      status: CategoryStatus.ACTIVE,
      sortOrder: 1
    }
  });

  const product = await prisma.product.upsert({
    where: {
      storeId_slug: {
        storeId: store.id,
        slug: seedConfig.product.slug
      }
    },
    create: {
      storeId: store.id,
      categoryId: category.id,
      name: seedConfig.product.name,
      slug: seedConfig.product.slug,
      description: seedConfig.product.description,
      sku: seedConfig.product.sku,
      priceCents: seedConfig.product.priceCents,
      compareAtCents: seedConfig.product.compareAtCents,
      currencyCode: seedConfig.store.currencyCode,
      stockQuantity: seedConfig.product.stockQuantity,
      status: ProductStatus.ACTIVE,
      isFeatured: true
    },
    update: {
      categoryId: category.id,
      name: seedConfig.product.name,
      description: seedConfig.product.description,
      sku: seedConfig.product.sku,
      priceCents: seedConfig.product.priceCents,
      compareAtCents: seedConfig.product.compareAtCents,
      currencyCode: seedConfig.store.currencyCode,
      stockQuantity: seedConfig.product.stockQuantity,
      status: ProductStatus.ACTIVE,
      isFeatured: true
    }
  });

  const shippingMethods = await prisma.shippingMethod.findMany({
    where: {
      storeId: store.id
    }
  });

  const defaultShippingMethod = shippingMethods.find((method) => method.isDefault);

  if (defaultShippingMethod && defaultShippingMethod.name !== seedConfig.shippingMethod.name) {
    await prisma.shippingMethod.update({
      where: {
        id: defaultShippingMethod.id
      },
      data: {
        isDefault: false
      }
    });
  }

  const shippingMethod = await prisma.shippingMethod.upsert({
    where: {
      id: defaultShippingMethod?.id ?? "__seed_shipping_method_missing__"
    },
    create: {
      storeId: store.id,
      name: seedConfig.shippingMethod.name,
      description: seedConfig.shippingMethod.description,
      type: ShippingMethodType.FIXED_PRICE,
      status: ShippingMethodStatus.ACTIVE,
      priceCents: seedConfig.shippingMethod.priceCents,
      estimatedDaysMin: seedConfig.shippingMethod.estimatedDaysMin,
      estimatedDaysMax: seedConfig.shippingMethod.estimatedDaysMax,
      minimumOrderCents: 0,
      maximumOrderCents: 200000,
      sortOrder: 1,
      isDefault: true
    },
    update: {
      name: seedConfig.shippingMethod.name,
      description: seedConfig.shippingMethod.description,
      type: ShippingMethodType.FIXED_PRICE,
      status: ShippingMethodStatus.ACTIVE,
      priceCents: seedConfig.shippingMethod.priceCents,
      estimatedDaysMin: seedConfig.shippingMethod.estimatedDaysMin,
      estimatedDaysMax: seedConfig.shippingMethod.estimatedDaysMax,
      minimumOrderCents: 0,
      maximumOrderCents: 200000,
      sortOrder: 1,
      isDefault: true
    }
  });

  console.log("");
  console.log("Seed concluida com sucesso.");
  console.log(`Admin global: ${adminUser.email}`);
  console.log(`Owner da loja demo: ${ownerUser.email}`);
  console.log(`Manager da loja demo: ${managerUser.email}`);
  console.log(`Support da loja demo: ${supportUser.email}`);
  console.log(`Loja demo: ${store.slug}.${process.env.MARKETPLACE_ROOT_DOMAIN ?? "lvh.me"}`);
  console.log(
    `Loja vitrine: ${showcaseStore.slug}.${process.env.MARKETPLACE_ROOT_DOMAIN ?? "lvh.me"}`
  );
  console.log(`Categoria demo: ${category.slug}`);
  console.log(`Produto demo: ${product.slug}`);
  console.log(`Frete demo: ${shippingMethod.name}`);
  console.log("");
  console.log("Passwords seedadas:");
  console.log(`- admin: ${seedConfig.admin.password}`);
  console.log(`- owner/manager/support: ${seedConfig.owner.password}`);
}

async function upsertUser(input) {
  return prisma.user.upsert({
    where: {
      email: input.email.toLowerCase()
    },
    create: {
      email: input.email.toLowerCase(),
      fullName: input.fullName,
      passwordHash: hashSecret(input.password),
      platformRole: input.platformRole
    },
    update: {
      fullName: input.fullName,
      passwordHash: hashSecret(input.password),
      platformRole: input.platformRole
    }
  });
}

async function upsertMembership(userId, storeId, role) {
  return prisma.storeMember.upsert({
    where: {
      userId_storeId: {
        userId,
        storeId
      }
    },
    create: {
      userId,
      storeId,
      role
    },
    update: {
      role
    }
  });
}

function hashSecret(secret) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(secret, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

function assertPasswordsAreDocumented() {
  if (
    seedConfig.admin.password === DEFAULT_ADMIN_PASSWORD ||
    seedConfig.owner.password === DEFAULT_STAFF_PASSWORD ||
    seedConfig.manager.password === DEFAULT_STAFF_PASSWORD ||
    seedConfig.support.password === DEFAULT_STAFF_PASSWORD
  ) {
    console.warn(
      "[seed] usando credenciais padrão documentadas; sobrescreva com SEED_ADMIN_PASSWORD e SEED_*_PASSWORD fora de ambientes locais/QA."
    );
  }
}

main()
  .catch(async (error) => {
    console.error("Seed falhou.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
