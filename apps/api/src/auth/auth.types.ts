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

export type AuthenticatedRequest = {
  headers: {
    authorization?: string;
  };
  user: AuthTokenPayload;
};
