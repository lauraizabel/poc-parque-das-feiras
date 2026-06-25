import { Injectable } from "@nestjs/common";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

@Injectable()
export class PasswordService {
  hashSecret(secret: string) {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = scryptSync(secret, salt, 64).toString("hex");
    return `${salt}:${derivedKey}`;
  }

  verifySecret(secret: string, storedHash: string) {
    const [salt, hash] = storedHash.split(":");

    if (!salt || !hash) {
      return false;
    }

    const derivedKey = scryptSync(secret, salt, 64);
    const storedKey = Buffer.from(hash, "hex");

    if (derivedKey.length !== storedKey.length) {
      return false;
    }

    return timingSafeEqual(derivedKey, storedKey);
  }
}
