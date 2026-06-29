import { Injectable } from "@nestjs/common";
import { prisma } from "@acme/database";
import Redis from "ioredis";
import { getEmailNotificationQueueMonitoring } from "../notifications/notifications.queue";
import { getPaymentQueueMonitoring } from "../payments/payments.queue";
import { getDomainQueueMonitoring } from "../domains/domains.queue";

type DependencyStatus = "up" | "down";

type HealthCheckResult = {
  status: DependencyStatus;
  message?: string;
  endpoint?: string;
};

type QueueCheckResult = {
  queueName: string;
  profile: string;
  status: DependencyStatus;
  counts: {
    wait: number | null;
    active: number | null;
    completed: number | null;
    failed: number | null;
    delayed: number | null;
    paused: number | null;
  } | null;
};

@Injectable()
export class HealthService {
  async getHealth() {
    const [database, redis, storage, queues] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkStorage(),
      this.checkQueues()
    ]);

    const allUp = [database, redis, storage].every((check) => check.status === "up");
    const allQueuesUp = queues.every((q) => q.status === "up");
    const status = allUp && allQueuesUp ? "ok" : "degraded";

    return {
      status,
      service: "api",
      timestamp: new Date().toISOString(),
      checks: {
        database,
        redis,
        storage,
        queues
      }
    };
  }

  async getQueueHealthDetails() {
    const [email, payment, domain] = await Promise.all([
      getEmailNotificationQueueMonitoring(),
      getPaymentQueueMonitoring(),
      getDomainQueueMonitoring()
    ]);

    return {
      queues: [
        email,
        payment,
        ...domain
      ]
    };
  }

  private async checkQueues(): Promise<QueueCheckResult[]> {
    const [email, payment, domain] = await Promise.allSettled([
      getEmailNotificationQueueMonitoring(),
      getPaymentQueueMonitoring(),
      getDomainQueueMonitoring()
    ]);

    const results: QueueCheckResult[] = [];

    if (email.status === "fulfilled") {
      results.push({
        queueName: email.value.queueName,
        profile: email.value.profile,
        status: email.value.counts !== null ? "up" : "down",
        counts: email.value.counts
      });
    }

    if (payment.status === "fulfilled") {
      results.push({
        queueName: payment.value.queueName,
        profile: payment.value.profile,
        status: payment.value.counts !== null ? "up" : "down",
        counts: payment.value.counts
      });
    }

    if (domain.status === "fulfilled") {
      for (const d of domain.value) {
        results.push({
          queueName: d.queueName,
          profile: d.profile,
          status: d.counts !== null ? "up" : "down",
          counts: d.counts
        });
      }
    }

    return results;
  }

  private async checkDatabase() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "up" as DependencyStatus };
    } catch (error) {
      return {
        status: "down" as DependencyStatus,
        message: this.getErrorMessage(error)
      };
    }
  }

  private async checkRedis() {
    const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 1
    });

    try {
      await redis.connect();
      await redis.ping();
      return { status: "up" as DependencyStatus };
    } catch (error) {
      return {
        status: "down" as DependencyStatus,
        message: this.getErrorMessage(error)
      };
    } finally {
      redis.disconnect();
    }
  }

  private async checkStorage() {
    const endpoint = process.env.S3_ENDPOINT ?? "http://localhost:9000";

    try {
      const response = await fetch(new URL("/minio/health/live", endpoint));

      if (!response.ok) {
        return {
          status: "down" as DependencyStatus,
          message: `storage responded with ${response.status}`
        };
      }

      return { status: "up" as DependencyStatus, endpoint };
    } catch (error) {
      return {
        status: "down" as DependencyStatus,
        endpoint,
        message: this.getErrorMessage(error)
      };
    }
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Unknown error";
  }
}