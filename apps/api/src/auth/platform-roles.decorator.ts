import { SetMetadata } from "@nestjs/common";
import { PlatformRole } from "@prisma/client";
import { PLATFORM_ROLES_KEY } from "./auth.constants";

export function PlatformRoles(...roles: PlatformRole[]) {
  return SetMetadata(PLATFORM_ROLES_KEY, roles);
}
