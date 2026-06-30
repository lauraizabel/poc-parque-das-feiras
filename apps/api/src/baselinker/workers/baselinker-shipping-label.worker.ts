import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { prisma } from "@acme/database";
import { attachWorkerLifecycleLogging } from "@acme/queue";
import { AppModule } from "../../app.module";
import { BaselinkerShippingService } from "../baselinker-shipping.service";
import {
  createShippingLabelWorker,
  BASELINKER_SHIPPING_LABEL_QUEUE
} from "../baselinker.queue";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"]
  });
  const shippingService = app.get(BaselinkerShippingService);

  const worker = createShippingLabelWorker(async (job) => {
    const { storeId, orderId, courierCode, extraFields } = job.data;
    return shippingService.generateShippingLabel(storeId, orderId, courierCode, extraFields);
  });

  attachWorkerLifecycleLogging(worker, BASELINKER_SHIPPING_LABEL_QUEUE);

  const shutdown = async () => {
    await worker.close();
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

void bootstrap();
