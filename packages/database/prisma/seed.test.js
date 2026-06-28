const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");
const { PrismaClient, StoreMemberRole } = require("@prisma/client");

const prisma = new PrismaClient();
const prismaDir = __dirname;

test("seed creates owner, manager and support memberships with demo stores", async () => {
  const suffix = Date.now().toString(36);
  const ownerEmail = `owner-${suffix}@seed.local`;
  const managerEmail = `manager-${suffix}@seed.local`;
  const supportEmail = `support-${suffix}@seed.local`;
  const adminEmail = `admin-${suffix}@seed.local`;
  const storeSlug = `seed-store-${suffix}`;
  const showcaseSlug = `seed-showcase-${suffix}`;

  execFileSync("node", ["seed.js"], {
    cwd: prismaDir,
    env: {
      ...process.env,
      SEED_ADMIN_EMAIL: adminEmail,
      SEED_OWNER_EMAIL: ownerEmail,
      SEED_MANAGER_EMAIL: managerEmail,
      SEED_SUPPORT_EMAIL: supportEmail,
      SEED_STORE_SLUG: storeSlug,
      SEED_STORE_SUBDOMAIN: storeSlug,
      SEED_SHOWCASE_STORE_SLUG: showcaseSlug,
      SEED_SHOWCASE_STORE_SUBDOMAIN: showcaseSlug,
      SEED_CATEGORY_SLUG: `seed-category-${suffix}`,
      SEED_PRODUCT_SLUG: `seed-product-${suffix}`,
      SEED_PRODUCT_SKU: `SEED-${suffix}`,
      SEED_SHIPPING_NAME: `Entrega ${suffix}`
    },
    stdio: "pipe"
  });

  const store = await prisma.store.findUniqueOrThrow({
    where: {
      slug: storeSlug
    },
    include: {
      storeMembers: {
        include: {
          user: true
        }
      }
    }
  });

  const showcaseStore = await prisma.store.findUniqueOrThrow({
    where: {
      slug: showcaseSlug
    },
    include: {
      storeMembers: {
        include: {
          user: true
        }
      }
    }
  });

  assert.equal(store.defaultSubdomain, storeSlug);
  assert.equal(showcaseStore.defaultSubdomain, showcaseSlug);
  assert.ok(store.storeMembers.some((member) => member.user.email === ownerEmail && member.role === StoreMemberRole.STORE_OWNER));
  assert.ok(store.storeMembers.some((member) => member.user.email === managerEmail && member.role === StoreMemberRole.STORE_MANAGER));
  assert.ok(store.storeMembers.some((member) => member.user.email === supportEmail && member.role === StoreMemberRole.STORE_SUPPORT));
  assert.ok(showcaseStore.storeMembers.some((member) => member.user.email === ownerEmail && member.role === StoreMemberRole.STORE_OWNER));

  await prisma.store.delete({ where: { id: showcaseStore.id } }).catch(() => null);
  await prisma.store.delete({ where: { id: store.id } }).catch(() => null);

  for (const email of [supportEmail, managerEmail, ownerEmail, adminEmail]) {
    await prisma.user.delete({ where: { email } }).catch(() => null);
  }
});

test.after(async () => {
  await prisma.$disconnect();
});
