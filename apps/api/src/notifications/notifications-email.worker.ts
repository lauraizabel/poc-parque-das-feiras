import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { prisma } from "@acme/database";
import { attachWorkerLifecycleLogging } from "@acme/queue";
import { AppModule } from "../app.module";
import { NotificationsService } from "./notifications.service";
import {
  createEmailNotificationWorker,
  EMAIL_NOTIFICATION_QUEUE
} from "./notifications.queue";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"]
  });
  const notificationsService = app.get(NotificationsService);

  const worker = createEmailNotificationWorker(async (job) => {
    await notificationsService.processEmailNotificationJob(job.data);
  });

  attachWorkerLifecycleLogging(worker, EMAIL_NOTIFICATION_QUEUE);

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
