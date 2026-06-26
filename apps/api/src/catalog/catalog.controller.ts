import { Controller, Get, Req } from "@nestjs/common";
import { PublicStorefrontRequest } from "../auth/auth.types";
import { CatalogService } from "./catalog.service";

@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get("boundary")
  getBoundary() {
    return this.catalogService.getBoundary();
  }

  @Get("public/context")
  getPublicContext(@Req() request: PublicStorefrontRequest) {
    return {
      store: request.publicStore ?? null
    };
  }
}
