import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);
const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return value;
}, z.boolean());

const optionalNonEmptyString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, nonEmptyString.optional());

const optionalUrl = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.url().optional());

const positiveIntFromEnv = z.preprocess((value) => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return Number(value);
  }

  return value;
}, z.number().int().positive());

const serverProviderSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  STOREFRONT_URL: z.url(),
  DASHBOARD_URL: z.url(),
  API_URL: z.url(),
  MARKETPLACE_ROOT_DOMAIN: nonEmptyString.default("lvh.me"),
  DATABASE_URL: nonEmptyString,
  REDIS_URL: nonEmptyString,
  JWT_SECRET: nonEmptyString,
  JWT_ACCESS_TTL: nonEmptyString.default("15m"),
  JWT_REFRESH_TTL: nonEmptyString.default("7d"),
  AUTH_RATE_LIMIT_MAX: positiveIntFromEnv.default(10),
  AUTH_RATE_LIMIT_WINDOW_MS: positiveIntFromEnv.default(60_000),
  WEBHOOK_RATE_LIMIT_MAX: positiveIntFromEnv.default(30),
  WEBHOOK_RATE_LIMIT_WINDOW_MS: positiveIntFromEnv.default(60_000)
});

const paymentsProviderSchema = z
  .object({
    PAYMENTS_ENABLED: booleanFromEnv.default(false),
    PAYMENT_PROVIDER: z.enum(["STRIPE", "PAGARME", "MERCADO_PAGO", "ASAAS"]).default("STRIPE"),
    STRIPE_SECRET_KEY: optionalNonEmptyString,
    STRIPE_WEBHOOK_SECRET: optionalNonEmptyString,
    PAGARME_API_KEY: optionalNonEmptyString,
    MERCADO_PAGO_ACCESS_TOKEN: optionalNonEmptyString,
    ASAAS_API_KEY: optionalNonEmptyString
  })
  .superRefine((env, ctx) => {
    if (!env.PAYMENTS_ENABLED) {
      return;
    }

    if (env.PAYMENT_PROVIDER === "STRIPE") {
      if (!env.STRIPE_SECRET_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STRIPE_SECRET_KEY"],
          message: "Required when PAYMENT_PROVIDER=STRIPE"
        });
      }

      if (!env.STRIPE_WEBHOOK_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STRIPE_WEBHOOK_SECRET"],
          message: "Required when PAYMENT_PROVIDER=STRIPE"
        });
      }
    }

    if (env.PAYMENT_PROVIDER === "PAGARME" && !env.PAGARME_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["PAGARME_API_KEY"],
        message: "Required when PAYMENT_PROVIDER=PAGARME"
      });
    }

    if (env.PAYMENT_PROVIDER === "MERCADO_PAGO" && !env.MERCADO_PAGO_ACCESS_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["MERCADO_PAGO_ACCESS_TOKEN"],
        message: "Required when PAYMENT_PROVIDER=MERCADO_PAGO"
      });
    }

    if (env.PAYMENT_PROVIDER === "ASAAS" && !env.ASAAS_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ASAAS_API_KEY"],
        message: "Required when PAYMENT_PROVIDER=ASAAS"
      });
    }
  });

const storageProviderSchema = z
  .object({
    STORAGE_PROVIDER: z.enum(["MINIO", "S3", "R2"]).default("MINIO"),
    S3_REGION: optionalNonEmptyString,
    S3_BUCKET: optionalNonEmptyString,
    S3_ACCESS_KEY_ID: optionalNonEmptyString,
    S3_SECRET_ACCESS_KEY: optionalNonEmptyString,
    S3_ENDPOINT: optionalUrl,
    R2_PUBLIC_URL: optionalUrl
  })
  .superRefine((env, ctx) => {
    const requiredFields = ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const;

    for (const field of requiredFields) {
      if (!env[field]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `Required when STORAGE_PROVIDER=${env.STORAGE_PROVIDER}`
        });
      }
    }

    if ((env.STORAGE_PROVIDER === "MINIO" || env.STORAGE_PROVIDER === "S3") && !env.S3_REGION) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["S3_REGION"],
        message: `Required when STORAGE_PROVIDER=${env.STORAGE_PROVIDER}`
      });
    }

    if (env.STORAGE_PROVIDER === "MINIO" && !env.S3_ENDPOINT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["S3_ENDPOINT"],
        message: "Required when STORAGE_PROVIDER=MINIO"
      });
    }

    if (env.STORAGE_PROVIDER === "R2" && !env.R2_PUBLIC_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["R2_PUBLIC_URL"],
        message: "Required when STORAGE_PROVIDER=R2"
      });
    }
  });

const emailProviderSchema = z
  .object({
    EMAIL_ENABLED: booleanFromEnv.default(false),
    EMAIL_PROVIDER: z.enum(["RESEND", "SENDGRID", "AWS_SES"]).default("RESEND"),
    RESEND_API_KEY: optionalNonEmptyString,
    SENDGRID_API_KEY: optionalNonEmptyString,
    AWS_SES_REGION: optionalNonEmptyString,
    AWS_SES_ACCESS_KEY_ID: optionalNonEmptyString,
    AWS_SES_SECRET_ACCESS_KEY: optionalNonEmptyString
  })
  .superRefine((env, ctx) => {
    if (!env.EMAIL_ENABLED) {
      return;
    }

    if (env.EMAIL_PROVIDER === "RESEND" && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["RESEND_API_KEY"],
        message: "Required when EMAIL_PROVIDER=RESEND"
      });
    }

    if (env.EMAIL_PROVIDER === "SENDGRID" && !env.SENDGRID_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SENDGRID_API_KEY"],
        message: "Required when EMAIL_PROVIDER=SENDGRID"
      });
    }

    if (env.EMAIL_PROVIDER === "AWS_SES") {
      if (!env.AWS_SES_REGION) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AWS_SES_REGION"],
          message: "Required when EMAIL_PROVIDER=AWS_SES"
        });
      }

      if (!env.AWS_SES_ACCESS_KEY_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AWS_SES_ACCESS_KEY_ID"],
          message: "Required when EMAIL_PROVIDER=AWS_SES"
        });
      }

      if (!env.AWS_SES_SECRET_ACCESS_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AWS_SES_SECRET_ACCESS_KEY"],
          message: "Required when EMAIL_PROVIDER=AWS_SES"
        });
      }
    }
  });

const domainsProviderSchema = z
  .object({
    DOMAINS_ENABLED: booleanFromEnv.default(false),
    DOMAIN_PROVIDER: z.enum(["CLOUDFLARE", "VERCEL"]).default("CLOUDFLARE"),
    CLOUDFLARE_API_TOKEN: optionalNonEmptyString,
    CLOUDFLARE_ACCOUNT_ID: optionalNonEmptyString,
    VERCEL_ACCESS_TOKEN: optionalNonEmptyString,
    VERCEL_PROJECT_ID: optionalNonEmptyString
  })
  .superRefine((env, ctx) => {
    if (!env.DOMAINS_ENABLED) {
      return;
    }

    if (env.DOMAIN_PROVIDER === "CLOUDFLARE") {
      if (!env.CLOUDFLARE_API_TOKEN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["CLOUDFLARE_API_TOKEN"],
          message: "Required when DOMAIN_PROVIDER=CLOUDFLARE"
        });
      }

      if (!env.CLOUDFLARE_ACCOUNT_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["CLOUDFLARE_ACCOUNT_ID"],
          message: "Required when DOMAIN_PROVIDER=CLOUDFLARE"
        });
      }
    }

    if (env.DOMAIN_PROVIDER === "VERCEL") {
      if (!env.VERCEL_ACCESS_TOKEN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["VERCEL_ACCESS_TOKEN"],
          message: "Required when DOMAIN_PROVIDER=VERCEL"
        });
      }

      if (!env.VERCEL_PROJECT_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["VERCEL_PROJECT_ID"],
          message: "Required when DOMAIN_PROVIDER=VERCEL"
        });
      }
    }
  });

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_API_URL: z.url()
});

export type ApiEnv = z.infer<typeof serverProviderSchema> &
  z.infer<typeof paymentsProviderSchema> &
  z.infer<typeof storageProviderSchema> &
  z.infer<typeof emailProviderSchema> &
  z.infer<typeof domainsProviderSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;

function formatSchemaErrors(error: z.ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".") || "root";
      return `- ${path}: ${issue.message}`;
    })
    .join("\n");
}

function parseWithContext<T>(schema: z.ZodSchema<T>, input: unknown, scope: string) {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new Error(`Invalid ${scope} environment variables:\n${formatSchemaErrors(result.error)}`);
  }

  return result.data;
}

export function createApiEnv(input: unknown) {
  return {
    ...parseWithContext(serverProviderSchema, input, "API base"),
    ...parseWithContext(paymentsProviderSchema, input, "API payments"),
    ...parseWithContext(storageProviderSchema, input, "API storage"),
    ...parseWithContext(emailProviderSchema, input, "API email"),
    ...parseWithContext(domainsProviderSchema, input, "API domains")
  } satisfies ApiEnv;
}

export function createPublicEnv(input: unknown) {
  return parseWithContext(publicEnvSchema, input, "public");
}
