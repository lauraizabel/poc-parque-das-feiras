-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'AUTHORIZED', 'APPROVED', 'FAILED', 'CANCELED', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentTransactionKind" AS ENUM ('INTENT', 'AUTHORIZATION', 'CAPTURE', 'CANCELLATION', 'REFUND', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT,
    "phoneNumber" TEXT,
    "documentNumber" TEXT,
    "notes" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN "customerId" TEXT;

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "customerId" TEXT,
    "provider" "PaymentProvider" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "currencyCode" TEXT NOT NULL DEFAULT 'BRL',
    "amountCents" INTEGER NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "externalPaymentId" TEXT,
    "externalReference" TEXT,
    "providerPayload" TEXT,
    "metadata" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "kind" "PaymentTransactionKind" NOT NULL,
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT,
    "externalTransactionId" TEXT,
    "requestPayload" TEXT,
    "responsePayload" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "occurredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_id_storeId_key" ON "Customer"("id", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_storeId_email_key" ON "Customer"("storeId", "email");

-- CreateIndex
CREATE INDEX "Customer_storeId_status_idx" ON "Customer"("storeId", "status");

-- CreateIndex
CREATE INDEX "Cart_storeId_customerId_status_idx" ON "Cart"("storeId", "customerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_id_storeId_key" ON "Payment"("id", "storeId");

-- CreateIndex
CREATE INDEX "Payment_storeId_status_idx" ON "Payment"("storeId", "status");

-- CreateIndex
CREATE INDEX "Payment_storeId_cartId_idx" ON "Payment"("storeId", "cartId");

-- CreateIndex
CREATE INDEX "Payment_storeId_customerId_idx" ON "Payment"("storeId", "customerId");

-- CreateIndex
CREATE INDEX "Payment_provider_externalPaymentId_idx" ON "Payment"("provider", "externalPaymentId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_storeId_paymentId_idx" ON "PaymentTransaction"("storeId", "paymentId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_paymentId_kind_status_idx" ON "PaymentTransaction"("paymentId", "kind", "status");

-- CreateIndex
CREATE INDEX "PaymentTransaction_provider_externalTransactionId_idx" ON "PaymentTransaction"("provider", "externalTransactionId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_paymentId_idempotencyKey_idx" ON "PaymentTransaction"("paymentId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_customerId_storeId_fkey" FOREIGN KEY ("customerId", "storeId") REFERENCES "Customer"("id", "storeId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_cartId_storeId_fkey" FOREIGN KEY ("cartId", "storeId") REFERENCES "Cart"("id", "storeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_storeId_fkey" FOREIGN KEY ("customerId", "storeId") REFERENCES "Customer"("id", "storeId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_paymentId_storeId_fkey" FOREIGN KEY ("paymentId", "storeId") REFERENCES "Payment"("id", "storeId") ON DELETE CASCADE ON UPDATE CASCADE;
