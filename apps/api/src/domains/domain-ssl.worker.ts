import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { prisma } from "@acme/database";
import { attachWorkerLifecycleLogging } from "@acme/queue";
import { AppModule } from "../app.module";
import { DomainsService } from "./domains.service";
import {
  DOMAIN_SSL_PROVISIONING_QUEUE,
  DOMAIN_SSL_STATUS_QUEUE,
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

  attachWorkerLifecycleLogging(provisioningWorker, DOMAIN_SSL_PROVISIONING_QUEUE);
  attachWorkerLifecycleLogging(statusWorker, DOMAIN_SSL_STATUS_QUEUE);

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
