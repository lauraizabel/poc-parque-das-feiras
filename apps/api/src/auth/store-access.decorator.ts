import { SetMetadata } from "@nestjs/common";
import { STORE_ACCESS_KEY } from "./auth.constants";

export function StoreAccess() {
  return SetMetadata(STORE_ACCESS_KEY, true);
}
