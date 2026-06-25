import { Controller, Get } from "@nestjs/common";
import { DomainsService } from "./domains.service";

@Controller("domains")
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Get("boundary")
  getBoundary() {
    return this.domainsService.getBoundary();
  }
}
