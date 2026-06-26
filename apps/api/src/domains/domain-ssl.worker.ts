import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { prisma } from "@acme/database";
import { AppModule } from "../app.module";
import { DomainsService } from "./domains.service";
import {
  createDomainSslProvisioningWorker,
  createDomainSslStatusWorker
} from "./domains.queue";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"]
  });
  const domainsService = app.get(DomainsService);

  const provisioningWorker = createDomainSslProvisioningWorker(async (job) => {
    await domainsService.processSslProvisioningJob(job.data.domainId);
  });

  const statusWorker = createDomainSslStatusWorker(async (job) => {
    await domainsService.processSslStatusSyncJob(job.data.domainId);
  });

  const closeWorkers = async () => {
    await provisioningWorker.close();
    await statusWorker.close();
  };

  provisioningWorker.on("failed", (job, error) => {
    console.error("domain-ssl-provisioning failed", {
      jobId: job?.id,
      error: error.message
    });
  });

  statusWorker.on("failed", (job, error) => {
    console.error("domain-ssl-status failed", {
      jobId: job?.id,
      error: error.message
    });
  });

  const shutdown = async () => {
    await closeWorkers();
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });
}

void bootstrap();
