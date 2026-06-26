import { Queue, Worker } from "bullmq";

export function getRedisConnectionOptions() {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname ? Number(url.pathname.replace("/", "") || 0) : 0
  };
}

export function createQueue(name: string) {
  return new Queue(name, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5_000
      },
      removeOnComplete: 100,
      removeOnFail: 500
    }
  });
}

export function createWorker<TData>(
  name: string,
  processor: (job: { data: TData; id?: string }) => Promise<unknown>
) {
  return new Worker(
    name,
    async (job) =>
      processor({
        data: job.data as TData,
        id: job.id
      }),
    {
      connection: getRedisConnectionOptions()
    }
  );
}
