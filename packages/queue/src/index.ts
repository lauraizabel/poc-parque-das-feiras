import {
  JobsOptions,
  Queue,
  QueueOptions,
  Worker,
  WorkerOptions
} from "bullmq";

export type QueueProfileName =
  | "default"
  | "domain-dns-verification"
  | "domain-ssl-provisioning"
  | "domain-ssl-status"
  | "notifications-email"
  | "payment-webhook-processing"
  | "baselinker-order-export"
  | "baselinker-order-import"
  | "baselinker-catalog-sync"
  | "baselinker-shipping-label";

export type QueuePolicy = {
  attempts: number;
  backoffDelayMs: number;
  removeOnComplete: number;
  removeOnFail: number;
  timeoutMs: number;
  concurrency: number;
};

export type QueueCounts = {
  wait: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
};

export type QueuePolicySnapshot = {
  queueName: string;
  profile: QueueProfileName;
  attempts: number;
  backoffDelayMs: number;
  removeOnComplete: number;
  removeOnFail: number;
  timeoutMs: number;
  concurrency: number;
};

export type QueueMonitoringSnapshot = QueuePolicySnapshot & {
  counts: QueueCounts | null;
};

const QUEUE_POLICIES: Record<QueueProfileName, QueuePolicy> = {
  default: {
    attempts: 3,
    backoffDelayMs: 5_000,
    removeOnComplete: 100,
    removeOnFail: 500,
    timeoutMs: 30_000,
    concurrency: 1
  },
  "domain-dns-verification": {
    attempts: 5,
    backoffDelayMs: 10_000,
    removeOnComplete: 200,
    removeOnFail: 1_000,
    timeoutMs: 60_000,
    concurrency: 2
  },
  "domain-ssl-provisioning": {
    attempts: 8,
    backoffDelayMs: 15_000,
    removeOnComplete: 200,
    removeOnFail: 1_000,
    timeoutMs: 120_000,
    concurrency: 1
  },
  "domain-ssl-status": {
    attempts: 10,
    backoffDelayMs: 30_000,
    removeOnComplete: 300,
    removeOnFail: 1_000,
    timeoutMs: 60_000,
    concurrency: 1
  },
  "notifications-email": {
    attempts: 5,
    backoffDelayMs: 10_000,
    removeOnComplete: 200,
    removeOnFail: 1_000,
    timeoutMs: 30_000,
    concurrency: 4
  },
  "payment-webhook-processing": {
    attempts: 6,
    backoffDelayMs: 5_000,
    removeOnComplete: 300,
    removeOnFail: 1_000,
    timeoutMs: 45_000,
    concurrency: 4
  },
  "baselinker-order-export": {
    attempts: 5,
    backoffDelayMs: 10_000,
    removeOnComplete: 300,
    removeOnFail: 1_000,
    timeoutMs: 30_000,
    concurrency: 3
  },
  "baselinker-order-import": {
    attempts: 3,
    backoffDelayMs: 30_000,
    removeOnComplete: 100,
    removeOnFail: 500,
    timeoutMs: 60_000,
    concurrency: 1
  },
  "baselinker-catalog-sync": {
    attempts: 5,
    backoffDelayMs: 15_000,
    removeOnComplete: 200,
    removeOnFail: 1_000,
    timeoutMs: 45_000,
    concurrency: 2
  },
  "baselinker-shipping-label": {
    attempts: 3,
    backoffDelayMs: 10_000,
    removeOnComplete: 200,
    removeOnFail: 500,
    timeoutMs: 30_000,
    concurrency: 4
  }
};

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

export function getQueuePolicy(profile: QueueProfileName = "default") {
  return QUEUE_POLICIES[profile];
}

export function buildQueueOptions(profile: QueueProfileName = "default"): QueueOptions {
  return {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: buildQueueDefaultJobOptions(profile)
  };
}

export function buildWorkerOptions(profile: QueueProfileName = "default"): WorkerOptions {
  const policy = getQueuePolicy(profile);

  return {
    connection: getRedisConnectionOptions(),
    concurrency: policy.concurrency
  };
}

export function buildQueueDefaultJobOptions(
  profile: QueueProfileName = "default"
): JobsOptions {
  const policy = getQueuePolicy(profile);

  return {
    attempts: policy.attempts,
    backoff: {
      type: "exponential",
      delay: policy.backoffDelayMs
    },
    removeOnComplete: policy.removeOnComplete,
    removeOnFail: policy.removeOnFail
  };
}

export function getQueuePolicySnapshot(
  queueName: string,
  profile: QueueProfileName = "default"
): QueuePolicySnapshot {
  const policy = getQueuePolicy(profile);

  return {
    queueName,
    profile,
    attempts: policy.attempts,
    backoffDelayMs: policy.backoffDelayMs,
    removeOnComplete: policy.removeOnComplete,
    removeOnFail: policy.removeOnFail,
    timeoutMs: policy.timeoutMs,
    concurrency: policy.concurrency
  };
}

/**
 * Returns the policy snapshot and live job counts for the given queue.
 * If the queue cannot be reached (e.g. Redis is down), counts will be null.
 */
export async function getQueueMonitoringSnapshot(
  queueName: string,
  profile: QueueProfileName = "default"
): Promise<QueueMonitoringSnapshot> {
  const policySnapshot = getQueuePolicySnapshot(queueName, profile);
  let counts: QueueCounts | null = null;

  try {
    const queue = new Queue(queueName, buildQueueOptions(profile));
    const jobCounts = await queue.getJobCounts();
    counts = {
      wait: jobCounts.wait ?? 0,
      active: jobCounts.active ?? 0,
      completed: jobCounts.completed ?? 0,
      failed: jobCounts.failed ?? 0,
      delayed: jobCounts.delayed ?? 0,
      paused: jobCounts.paused ?? 0
    };
    await queue.close();
  } catch {
    // Queue unreachable — counts will be null
  }

  return {
    ...policySnapshot,
    counts
  };
}

export function createQueue(name: string, profile: QueueProfileName = "default") {
  return new Queue(name, buildQueueOptions(profile));
}

export function createWorker<TData>(
  name: string,
  processor: (job: { data: TData; id?: string }) => Promise<unknown>,
  profile: QueueProfileName = "default"
) {
  const policy = getQueuePolicy(profile);

  return new Worker(
    name,
    async (job) =>
      runWithTimeout(
        () =>
          processor({
            data: job.data as TData,
            id: job.id
          }),
        policy.timeoutMs,
        name,
        job.id
      ),
    buildWorkerOptions(profile)
  );
}

export function attachWorkerLifecycleLogging(
  worker: Worker,
  queueName: string,
  loggers: {
    info?: (message: string, context?: Record<string, unknown>) => void;
    warn?: (message: string, context?: Record<string, unknown>) => void;
    error?: (message: string, context?: Record<string, unknown>) => void;
  } = {}
) {
  const info = loggers.info ?? ((message, context) => console.log(message, context ?? {}));
  const warn = loggers.warn ?? ((message, context) => console.warn(message, context ?? {}));
  const error = loggers.error ?? ((message, context) => console.error(message, context ?? {}));

  worker.on("ready", () => {
    info(`${queueName} worker ready`);
  });

  worker.on("completed", (job) => {
    info(`${queueName} completed`, {
      jobId: job.id
    });
  });

  worker.on("failed", (job, jobError) => {
    error(`${queueName} failed`, {
      jobId: job?.id,
      error: jobError.message
    });
  });

  worker.on("stalled", (jobId) => {
    warn(`${queueName} stalled`, {
      jobId
    });
  });

  worker.on("error", (workerError) => {
    error(`${queueName} worker error`, {
      error: workerError.message
    });
  });

  return worker;
}

async function runWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  queueName: string,
  jobId?: string
) {
  let timeoutHandle: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(
            new Error(
              `${queueName} job ${jobId ?? "unknown"} exceeded timeout of ${timeoutMs}ms`
            )
          );
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}