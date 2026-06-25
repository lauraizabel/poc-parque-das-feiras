import { SetMetadata } from "@nestjs/common";
import { StoreMemberRole } from "@prisma/client";
import { STORE_ROLES_KEY } from "./auth.constants";

export function StoreRoles(...roles: StoreMemberRole[]) {
  return SetMetadata(STORE_ROLES_KEY, roles);
}
