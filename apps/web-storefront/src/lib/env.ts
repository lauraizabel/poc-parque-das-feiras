import { createPublicEnv } from "@acme/config";

export const env = createPublicEnv({
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_STOREFRONT_URL ?? process.env.STOREFRONT_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL
});
