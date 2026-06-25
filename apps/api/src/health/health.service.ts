import { Injectable } from "@nestjs/common";
import { prisma } from "@acme/database";
import Redis from "ioredis";

type DependencyStatus = "up" | "down";

@Injectable()
export class HealthService {
  async getHealth() {
    const [database, redis, storage] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkStorage()
    ]);

    const checks = { database, redis, storage };
    const status = Object.values(checks).every((check) => check.status === "up") ? "ok" : "degraded";

    return {
      status,
      service: "api",
      timestamp: new Date().toISOString(),
      checks
    };
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
