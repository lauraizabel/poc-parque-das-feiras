import { Injectable } from "@nestjs/common";
import { DomainBoundary } from "../platform/domain-boundary";

@Injectable()
export class AuthRepository {
  getBoundary(): DomainBoundary {
    return {
      module: "auth",
      description: "Identity, sessions, credentials and access entrypoints.",
      responsibilities: ["users", "sessions", "password credentials", "access tokens"],
      dependsOn: ["database", "config"]
    };
  }
}
