import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { prisma } from "@acme/database";
import { attachWorkerLifecycleLogging } from "@acme/queue";
import { AppModule } from "../app.module";
import { DomainsService } from "./domains.service";
import {
  createDomainDnsVerificationWorker,
  DOMAIN_DNS_VERIFICATION_QUEUE
} from "./domains.queue";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"]
  });
  const domainsService = app.get(DomainsService);

  const worker = createDomainDnsVerificationWorker(async (job) => {
    await domainsService.processDnsVerificationJob(job.data.domainId);
  });

  attachWorkerLifecycleLogging(worker, DOMAIN_DNS_VERIFICATION_QUEUE);

  const shutdown = async () => {
    await worker.close();
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
