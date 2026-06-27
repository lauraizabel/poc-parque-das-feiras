import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { prisma } from "@acme/database";
import { AppModule } from "../app.module";
import { PaymentsService } from "./payments.service";
import { createPaymentWebhookWorker } from "./payments.queue";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"]
  });
  const paymentsService = app.get(PaymentsService);

  const worker = createPaymentWebhookWorker(async (job) => {
    await paymentsService.processPaymentWebhookJob(job.data.webhookEventId);
  });

  worker.on("failed", (job, error) => {
    console.error("payment-webhook-processing failed", {
      jobId: job?.id,
      error: error.message
    });
  });

  worker.on("completed", (job) => {
    console.log("payment-webhook-processing completed", {
      jobId: job.id
    });
  });

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
