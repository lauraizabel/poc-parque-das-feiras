import { Injectable } from "@nestjs/common";
import { prisma } from "@acme/database";
import {
  PaymentProvider,
  PaymentStatus,
  PaymentTransactionKind,
  PaymentTransactionStatus
} from "@prisma/client";
import { DomainBoundary } from "../platform/domain-boundary";

@Injectable()
export class PaymentsRepository {
  getBoundary(): DomainBoundary {
    return {
      module: "payments",
      description: "Payment providers, intents, webhooks and account mapping.",
      responsibilities: ["payment accounts", "payment intents", "provider payloads", "webhook events"],
      dependsOn: ["database", "queue", "integrations", "stores"]
    };
  }

  findCustomerByEmail(storeId: string, email: string) {
    return prisma.customer.findUnique({
      where: {
        storeId_email: {
          storeId,
          email
        }
      }
    });
  }

  createCustomer(input: {
    storeId: string;
    email: string;
    fullName?: string | null;
    phoneNumber?: string | null;
    documentNumber?: string | null;
    notes?: string | null;
  }) {
    return prisma.customer.create({
      data: {
        storeId: input.storeId,
        email: input.email,
        fullName: input.fullName ?? null,
        phoneNumber: input.phoneNumber ?? null,
        documentNumber: input.documentNumber ?? null,
        notes: input.notes ?? null
      }
    });
  }

  createPayment(input: {
    storeId: string;
    cartId: string;
    customerId?: string | null;
    provider: PaymentProvider;
    status?: PaymentStatus;
    currencyCode?: string;
    amountCents: number;
    attemptCount?: number;
    externalPaymentId?: string | null;
    externalReference?: string | null;
    providerPayload?: string | null;
    metadata?: string | null;
    failureCode?: string | null;
    failureMessage?: string | null;
    expiresAt?: Date | null;
    paidAt?: Date | null;
  }) {
    return prisma.payment.create({
      data: {
        storeId: input.storeId,
        cartId: input.cartId,
        customerId: input.customerId ?? null,
        provider: input.provider,
        status: input.status ?? PaymentStatus.CREATED,
        currencyCode: input.currencyCode ?? "BRL",
        amountCents: input.amountCents,
        attemptCount: input.attemptCount ?? 0,
        externalPaymentId: input.externalPaymentId ?? null,
        externalReference: input.externalReference ?? null,
        providerPayload: input.providerPayload ?? null,
        metadata: input.metadata ?? null,
        failureCode: input.failureCode ?? null,
        failureMessage: input.failureMessage ?? null,
        expiresAt: input.expiresAt ?? null,
        paidAt: input.paidAt ?? null
      }
    });
  }

  getPaymentById(paymentId: string) {
    return prisma.payment.findUnique({
      where: {
        id: paymentId
      },
      include: {
        customer: true,
        cart: {
          include: {
            items: true
          }
        },
        transactions: {
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });
  }

  updatePayment(paymentId: string, input: {
    status?: PaymentStatus;
    attemptCount?: number;
    externalPaymentId?: string | null;
    externalReference?: string | null;
    providerPayload?: string | null;
    metadata?: string | null;
    failureCode?: string | null;
    failureMessage?: string | null;
    expiresAt?: Date | null;
    paidAt?: Date | null;
  }) {
    return prisma.payment.update({
      where: {
        id: paymentId
      },
      data: input
    });
  }

  createPaymentTransaction(input: {
    paymentId: string;
    storeId: string;
    provider: PaymentProvider;
    kind: PaymentTransactionKind;
    status?: PaymentTransactionStatus;
    idempotencyKey?: string | null;
    externalTransactionId?: string | null;
    requestPayload?: string | null;
    responsePayload?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    occurredAt?: Date | null;
  }) {
    return prisma.paymentTransaction.create({
      data: {
        paymentId: input.paymentId,
        storeId: input.storeId,
        provider: input.provider,
        kind: input.kind,
        status: input.status ?? PaymentTransactionStatus.PENDING,
        idempotencyKey: input.idempotencyKey ?? null,
        externalTransactionId: input.externalTransactionId ?? null,
        requestPayload: input.requestPayload ?? null,
        responsePayload: input.responsePayload ?? null,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        occurredAt: input.occurredAt ?? null
      }
    });
  }
}
