import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PaymentStatus } from "@prisma/client";
import { NotificationsRepository } from "./notifications.repository";
import {
  createEmailNotificationQueue,
  EmailNotificationJob,
  getEmailNotificationQueueMonitoring
} from "./notifications.queue";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly notificationsRepository: NotificationsRepository) {}

  getBoundary() {
    return this.notificationsRepository.getBoundary();
  }

  getQueueMonitoring() {
    return {
      queue: getEmailNotificationQueueMonitoring()
    };
  }

  async enqueueEmailNotification(input: EmailNotificationJob) {
    const job = this.normalizeEmailJob(input);
    const queue = createEmailNotificationQueue();
    const jobId = this.buildEmailJobId(job);

    try {
      const queuedJob = await queue.add("send-email-notification", job, {
        jobId
      });

      return {
        queued: true,
        queue: getEmailNotificationQueueMonitoring(),
        jobId: queuedJob.id ?? jobId,
        notification: {
          to: job.to,
          subject: job.subject,
          templateKey: job.templateKey
        }
      };
    } finally {
      await queue.close();
    }
  }

  async processEmailNotificationJob(input: EmailNotificationJob) {
    const job = this.normalizeEmailJob(input);
    const deliveredAt = new Date().toISOString();
    const delivery = {
      channel: "email",
      provider: "console",
      to: job.to,
      subject: job.subject,
      templateKey: job.templateKey,
      deliveredAt,
      metadata: job.metadata ?? {},
      variables: job.variables ?? {}
    };

    this.logger.log(`Email notification delivered to ${job.to}`, JSON.stringify(delivery));

    return {
      delivered: true,
      delivery
    };
  }

  async notifyPaymentStatusChange(input: {
    storeId: string;
    orderId: string;
    customerEmail: string;
    customerFullName?: string | null;
    totalCents: number;
    currencyCode: string;
    paymentStatus: PaymentStatus;
  }) {
    const recipients = await this.notificationsRepository.getStoreNotificationRecipients(
      input.storeId
    );

    if (!recipients) {
      return {
        queued: false,
        notifications: []
      };
    }

    const template = this.resolvePaymentNotificationTemplate(input.paymentStatus);

    if (!template) {
      return {
        queued: false,
        notifications: []
      };
    }

    const jobs: EmailNotificationJob[] = [
      {
        to: input.customerEmail,
        subject: template.customerSubject,
        templateKey: template.customerTemplateKey,
        variables: {
          customerFullName: input.customerFullName ?? null,
          orderId: input.orderId,
          paymentStatus: input.paymentStatus,
          totalLabel: this.formatMoney(input.totalCents, input.currencyCode),
          storeName: recipients.storeName,
          storeSlug: recipients.storeSlug
        },
        metadata: {
          storeId: input.storeId,
          orderId: input.orderId,
          audience: "customer",
          paymentStatus: input.paymentStatus
        }
      },
      ...this.buildMerchantPaymentNotificationJobs(recipients, {
        orderId: input.orderId,
        customerEmail: input.customerEmail,
        paymentStatus: input.paymentStatus,
        totalLabel: this.formatMoney(input.totalCents, input.currencyCode)
      }, template)
    ];

    return {
      queued: true,
      notifications: await Promise.all(
        jobs.map((job) => this.enqueueEmailNotification(job))
      )
    };
  }

  private normalizeEmailJob(input: EmailNotificationJob) {
    const to = input.to.trim().toLowerCase();
    const subject = input.subject.trim();
    const templateKey = input.templateKey.trim();

    if (!to.includes("@")) {
      throw new BadRequestException({
        message: "Notification recipient email is invalid",
        code: "NOTIFICATION_EMAIL_INVALID",
        to: input.to
      });
    }

    if (subject.length < 2) {
      throw new BadRequestException({
        message: "Notification subject is required",
        code: "NOTIFICATION_SUBJECT_REQUIRED"
      });
    }

    if (templateKey.length < 2) {
      throw new BadRequestException({
        message: "Notification template is required",
        code: "NOTIFICATION_TEMPLATE_REQUIRED"
      });
    }

    return {
      to,
      subject,
      templateKey,
      variables: input.variables ?? {},
      metadata: input.metadata ?? {}
    };
  }

  private buildEmailJobId(job: {
    to: string;
    templateKey: string;
  }) {
    const sanitizeSegment = (value: string) =>
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "na";

    return [
      "email",
      sanitizeSegment(job.templateKey),
      sanitizeSegment(job.to),
      Date.now().toString(36)
    ].join("-");
  }

  private buildMerchantPaymentNotificationJobs(
    recipients: {
      storeId: string;
      storeName: string;
      storeSlug: string;
      ownerEmail: string;
      supportEmail: string | null;
    },
    context: {
      orderId: string;
      customerEmail: string;
      paymentStatus: PaymentStatus;
      totalLabel: string;
    },
    template: {
      storeSubject: string;
      storeTemplateKey: string;
    }
  ) {
    const merchantRecipients = Array.from(
      new Set(
        [recipients.supportEmail, recipients.ownerEmail]
          .map((email) => email?.trim().toLowerCase() ?? null)
          .filter((email): email is string => Boolean(email))
      )
    );

    return merchantRecipients.map<EmailNotificationJob>((to) => ({
      to,
      subject: template.storeSubject,
      templateKey: template.storeTemplateKey,
      variables: {
        orderId: context.orderId,
        customerEmail: context.customerEmail,
        paymentStatus: context.paymentStatus,
        totalLabel: context.totalLabel,
        storeName: recipients.storeName,
        storeSlug: recipients.storeSlug
      },
      metadata: {
        storeId: recipients.storeId,
        orderId: context.orderId,
        audience: "merchant",
        paymentStatus: context.paymentStatus
      }
    }));
  }

  private resolvePaymentNotificationTemplate(paymentStatus: PaymentStatus) {
    switch (paymentStatus) {
      case PaymentStatus.APPROVED:
        return {
          customerSubject: "Pagamento aprovado do seu pedido",
          customerTemplateKey: "payment-approved-customer",
          storeSubject: "Pagamento aprovado na sua loja",
          storeTemplateKey: "payment-approved-store"
        };
      case PaymentStatus.FAILED:
        return {
          customerSubject: "Falha no pagamento do seu pedido",
          customerTemplateKey: "payment-failed-customer",
          storeSubject: "Pagamento falhou na sua loja",
          storeTemplateKey: "payment-failed-store"
        };
      case PaymentStatus.EXPIRED:
        return {
          customerSubject: "Pagamento expirado do seu pedido",
          customerTemplateKey: "payment-expired-customer",
          storeSubject: "Pagamento expirado na sua loja",
          storeTemplateKey: "payment-expired-store"
        };
      case PaymentStatus.REFUNDED:
        return {
          customerSubject: "Reembolso confirmado do seu pedido",
          customerTemplateKey: "payment-refunded-customer",
          storeSubject: "Reembolso confirmado na sua loja",
          storeTemplateKey: "payment-refunded-store"
        };
      default:
        return null;
    }
  }

  private formatMoney(totalCents: number, currencyCode: string) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currencyCode
    }).format(totalCents / 100);
  }
}
