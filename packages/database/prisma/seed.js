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
  customerUsers: [
    { email: "cliente1@demo.local", fullName: "Ana Lima" },
    { email: "cliente2@demo.local", fullName: "Bruno Souza" }
  ],
  store: {
    name: process.env.SEED_STORE_NAME ?? "Moda Demo",
    slug: process.env.SEED_STORE_SLUG ?? "moda-demo",
    defaultSubdomain: process.env.SEED_STORE_SUBDOMAIN ?? "moda-demo",
    supportEmail: process.env.SEED_STORE_SUPPORT_EMAIL ?? "support@demo-store.local",
    currencyCode: process.env.SEED_STORE_CURRENCY ?? "BRL",
    locale: process.env.SEED_STORE_LOCALE ?? "pt-BR"
  },
  categories: [
    { name: "Feminino", slug: "feminino", sortOrder: 1 },
    { name: "Masculino", slug: "masculino", sortOrder: 2 },
    { name: "Acessórios", slug: "acessorios", sortOrder: 3 }
  ],
  products: [
    {
      name: "Vestido Midi Floral",
      slug: "vestido-midi-floral",
      sku: "VMF-001",
      description: "Vestido midi com estampa floral, tecido leve e confortável para o dia a dia.",
      priceCents: 18990,
      compareAtCents: 21900,
      stockQuantity: 15,
      categorySlug: "feminino",
      isFeatured: true
    },
    {
      name: "Blusa Cropped Listrada",
      slug: "blusa-cropped-listrada",
      sku: "BCL-001",
      description: "Blusa cropped com listras horizontais, ideal para looks casuais.",
      priceCents: 7990,
      compareAtCents: 9990,
      stockQuantity: 30,
      categorySlug: "feminino",
      isFeatured: false
    },
    {
      name: "Calça Jogger Moletom",
      slug: "calca-jogger-moletom",
      sku: "CJM-001",
      description: "Calça jogger em moletom macio, perfeita para o conforto do dia a dia.",
      priceCents: 14990,
      compareAtCents: 17990,
      stockQuantity: 20,
      categorySlug: "masculino",
      isFeatured: true
    },
    {
      name: "Camiseta Básica Algodão",
      slug: "camiseta-basica-algodao",
      sku: "CBA-001",
      description: "Camiseta básica 100% algodão, corte regular, disponível em várias cores.",
      priceCents: 5990,
      compareAtCents: 7490,
      stockQuantity: 50,
      categorySlug: "masculino",
      isFeatured: false
    },
    {
      name: "Cinto de Couro",
      slug: "cinto-de-couro",
      sku: "CC-001",
      description: "Cinto de couro legítimo com fivela dourada, versátil para looks formais e casuais.",
      priceCents: 8990,
      compareAtCents: 10990,
      stockQuantity: 12,
      categorySlug: "acessorios",
      isFeatured: false
    },
    {
      name: "Bolsa Tote Canvas",
      slug: "bolsa-tote-canvas",
      sku: "BTC-001",
      description: "Bolsa tote espaçosa em canvas resistente, com alças reforçadas.",
      priceCents: 12990,
      compareAtCents: 14990,
      stockQuantity: 8,
      categorySlug: "acessorios",
      isFeatured: true
    }
  ],
  shippingMethod: {
    name: process.env.SEED_SHIPPING_NAME ?? "Entrega Padrão",
    description:
      process.env.SEED_SHIPPING_DESCRIPTION ??
      "Frete base seedado para validar checkout e operação do pedido.",
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

  for (const customerCfg of seedConfig.customerUsers) {
    await upsertUser({
      email: customerCfg.email,
      fullName: customerCfg.fullName,
      password: DEFAULT_STAFF_PASSWORD,
      platformRole: PlatformRole.CUSTOMER
    });
  }

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

  const categoryMap = {};
  for (const catCfg of seedConfig.categories) {
    const category = await upsertCategory(store.id, catCfg);
    categoryMap[catCfg.slug] = category;
  }

  const products = [];
  for (const productCfg of seedConfig.products) {
    const category = categoryMap[productCfg.categorySlug];
    const product = await prisma.product.upsert({
      where: {
        storeId_slug: {
          storeId: store.id,
          slug: productCfg.slug
        }
      },
      create: {
        storeId: store.id,
        categoryId: category.id,
        name: productCfg.name,
        slug: productCfg.slug,
        description: productCfg.description,
        sku: productCfg.sku,
        priceCents: productCfg.priceCents,
        compareAtCents: productCfg.compareAtCents,
        currencyCode: seedConfig.store.currencyCode,
        stockQuantity: productCfg.stockQuantity,
        status: ProductStatus.ACTIVE,
        isFeatured: productCfg.isFeatured
      },
      update: {
        categoryId: category.id,
        name: productCfg.name,
        description: productCfg.description,
        sku: productCfg.sku,
        priceCents: productCfg.priceCents,
        compareAtCents: productCfg.compareAtCents,
        currencyCode: seedConfig.store.currencyCode,
        stockQuantity: productCfg.stockQuantity,
        status: ProductStatus.ACTIVE,
        isFeatured: productCfg.isFeatured
      }
    });
    products.push(product);
  }

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
  console.log(`Clientes demo: ${seedConfig.customerUsers.map((c) => c.email).join(", ")}`);
  console.log(`Loja demo: ${store.slug}.${process.env.MARKETPLACE_ROOT_DOMAIN ?? "lvh.me"}`);
  console.log(
    `Loja vitrine: ${showcaseStore.slug}.${process.env.MARKETPLACE_ROOT_DOMAIN ?? "lvh.me"}`
  );
  console.log(`Categorias: ${seedConfig.categories.map((c) => c.slug).join(", ")}`);
  console.log(`Produtos: ${products.map((p) => p.slug).join(", ")}`);
  console.log(`Frete demo: ${shippingMethod.name}`);
  console.log("");
  console.log("Passwords seedadas:");
  console.log(`- admin: ${seedConfig.admin.password}`);
  console.log(`- owner/manager/support/clientes: ${seedConfig.owner.password}`);
}

async function upsertCategory(storeId, cfg) {
  return prisma.category.upsert({
    where: {
      storeId_slug: {
        storeId,
        slug: cfg.slug
      }
    },
    create: {
      storeId,
      name: cfg.name,
      slug: cfg.slug,
      status: CategoryStatus.ACTIVE,
      sortOrder: cfg.sortOrder
    },
    update: {
      name: cfg.name,
      status: CategoryStatus.ACTIVE,
      sortOrder: cfg.sortOrder
    }
  });
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
