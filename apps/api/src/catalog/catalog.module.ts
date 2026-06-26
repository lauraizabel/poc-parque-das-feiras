import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DomainsModule } from "../domains/domains.module";
import { PublicStorefrontMiddleware } from "../domains/public-storefront.middleware";
import { CatalogController } from "./catalog.controller";
import { CatalogRepository } from "./catalog.repository";
import { CatalogService } from "./catalog.service";

@Module({
  imports: [AuthModule, DomainsModule],
  controllers: [CatalogController],
  providers: [CatalogService, CatalogRepository],
  exports: [CatalogService, CatalogRepository]
})
export class CatalogModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(PublicStorefrontMiddleware)
      .forRoutes(
        { path: "catalog/public/context", method: RequestMethod.GET },
        { path: "catalog/public/home", method: RequestMethod.GET },
        { path: "catalog/public/products", method: RequestMethod.GET },
        { path: "catalog/public/products/:productSlug", method: RequestMethod.GET }
      );
  }
}
