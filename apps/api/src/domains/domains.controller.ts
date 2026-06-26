import { Controller, Get, Headers } from "@nestjs/common";
import { DomainsService } from "./domains.service";

@Controller("domains")
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Get("boundary")
  getBoundary() {
    return this.domainsService.getBoundary();
  }

  @Get("resolve")
  resolve(
    @Headers("host") host: string | undefined,
    @Headers("x-forwarded-host") forwardedHost: string | undefined
  ) {
    return this.domainsService.resolveHost({
      headers: {
        host,
        "x-forwarded-host": forwardedHost
      }
    });
  }
}
