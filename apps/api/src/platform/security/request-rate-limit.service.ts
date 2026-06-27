import { Injectable } from "@nestjs/common";

type ConsumeRateLimitInput = {
  scope: string;
  key: string;
  maxRequests: number;
  windowMs: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

@Injectable()
export class RequestRateLimitService {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private lastCleanupAt = 0;

  consume(input: ConsumeRateLimitInput): RateLimitResult {
    const now = Date.now();
    this.cleanup(now);

    const bucketKey = `${input.scope}:${input.key}`;
    const currentBucket = this.buckets.get(bucketKey);
    const shouldResetBucket = !currentBucket || currentBucket.resetAt <= now;

    const bucket: RateLimitBucket = shouldResetBucket
      ? {
          count: 0,
          resetAt: now + input.windowMs
        }
      : currentBucket;

    bucket.count += 1;
    this.buckets.set(bucketKey, bucket);

    const allowed = bucket.count <= input.maxRequests;
    const remaining = Math.max(0, input.maxRequests - bucket.count);
    const retryAfterSeconds = allowed ? 0 : Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    return {
      allowed,
      remaining,
      resetAt: bucket.resetAt,
      retryAfterSeconds
    };
  }

  private cleanup(now: number) {
    if (now - this.lastCleanupAt < 30_000 && this.buckets.size < 1_000) {
      return;
    }

    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }

    this.lastCleanupAt = now;
  }
}
