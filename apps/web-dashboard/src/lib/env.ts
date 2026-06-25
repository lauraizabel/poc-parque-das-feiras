import { createPublicEnv } from "@acme/config";

export const env = createPublicEnv({
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_DASHBOARD_URL ?? process.env.DASHBOARD_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL
});
