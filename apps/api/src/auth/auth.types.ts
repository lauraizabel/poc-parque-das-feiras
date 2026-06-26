import { PlatformRole } from "@prisma/client";

export type AuthTokenPayload = {
  sub: string;
  email: string;
  platformRole: PlatformRole;
  type: "access" | "refresh";
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  fullName: string | null;
  platformRole: PlatformRole;
};

export type PublicStorefrontContext = {
  storeId: string;
  storeSlug: string;
  source: "subdomain" | "custom-domain";
  matchedHost: string;
};

export type AuthenticatedRequest = {
  headers: {
    authorization?: string;
    "x-store-id"?: string;
  };
  params?: Record<string, string | undefined>;
  body?: {
    storeId?: string;
  };
  query?: Record<string, string | string[] | undefined>;
  user: AuthTokenPayload;
  storeContext?: {
    storeId: string;
    membershipRole: string;
  };
};

export type PublicStorefrontRequest = {
  headers: {
    host?: string;
    "x-forwarded-host"?: string;
    "x-store-id"?: string;
  };
  params?: Record<string, string | undefined>;
  body?: {
    storeId?: string;
  };
  query?: Record<string, string | string[] | undefined>;
  publicStore?: PublicStorefrontContext;
};
