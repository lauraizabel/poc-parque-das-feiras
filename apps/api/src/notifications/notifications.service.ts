import { BadRequestException, Injectable, Logger } from "@nestjs/common";
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
    const jobId = `email:${job.templateKey}:${job.to}:${Date.now()}`;

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
}
