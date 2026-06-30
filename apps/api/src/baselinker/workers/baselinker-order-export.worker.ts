import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { prisma } from "@acme/database";
import { attachWorkerLifecycleLogging } from "@acme/queue";
import { AppModule } from "../../app.module";
import { BaselinkerOrderSyncService } from "../baselinker-order-sync.service";
import { BaselinkerRepository } from "../baselinker.repository";
import {
  createOrderExportQueue,
  createOrderExportWorker,
  BASELINKER_ORDER_EXPORT_QUEUE
} from "../baselinker.queue";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"]
  });
  const orderSyncService = app.get(BaselinkerOrderSyncService);
  const repository = app.get(BaselinkerRepository);

  const intervalMinutes =
    Number(process.env.BASELINKER_IMPORT_INTERVAL_MINUTES ?? 15) || 15;

  const exportQueue = createOrderExportQueue();

  await exportQueue.add(
    "poll-all-stores",
    {},
    { repeat: { every: intervalMinutes * 60 * 1000 }, jobId: "baselinker-export-poll" }
  );

  const worker = createOrderExportWorker(async () => {
    const configs = await repository.findAllEnabledConfigs();
    await Promise.allSettled(
      configs.map((config) => orderSyncService.exportUnsyncedOrders(config.storeId))
    );
  });

  attachWorkerLifecycleLogging(worker, BASELINKER_ORDER_EXPORT_QUEUE);

  const shutdown = async () => {
    await worker.close();
    await exportQueue.close();
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

void bootstrap();
