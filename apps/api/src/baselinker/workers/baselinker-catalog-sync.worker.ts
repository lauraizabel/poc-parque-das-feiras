import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { prisma } from "@acme/database";
import { attachWorkerLifecycleLogging } from "@acme/queue";
import { AppModule } from "../../app.module";
import { BaselinkerCatalogSyncService } from "../baselinker-catalog-sync.service";
import { BaselinkerRepository } from "../baselinker.repository";
import {
  createCatalogSyncQueue,
  createCatalogSyncWorker,
  BASELINKER_CATALOG_SYNC_QUEUE
} from "../baselinker.queue";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"]
  });
  const catalogSyncService = app.get(BaselinkerCatalogSyncService);
  const repository = app.get(BaselinkerRepository);

  const intervalMinutes =
    Number(process.env.BASELINKER_IMPORT_INTERVAL_MINUTES ?? 15) || 15;

  const syncQueue = createCatalogSyncQueue();

  await syncQueue.add(
    "poll-all-stores",
    {},
    { repeat: { every: intervalMinutes * 60 * 1000 }, jobId: "baselinker-catalog-poll" }
  );

  const worker = createCatalogSyncWorker(async () => {
    const configs = await repository.findAllEnabledConfigs();
    await Promise.allSettled(
      configs
        .filter((c) => c.inventoryId != null)
        .map((config) => catalogSyncService.syncCatalog(config.storeId))
    );
  });

  attachWorkerLifecycleLogging(worker, BASELINKER_CATALOG_SYNC_QUEUE);

  const shutdown = async () => {
    await worker.close();
    await syncQueue.close();
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

void bootstrap();
