import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module";
import { DomainsModule } from "../domains/domains.module";
import { PublicStorefrontMiddleware } from "../domains/public-storefront.middleware";
import { CartController } from "./cart.controller";
import { CartRepository } from "./cart.repository";
import { CartService } from "./cart.service";

@Module({
  imports: [DomainsModule, CatalogModule],
  controllers: [CartController],
  providers: [CartService, CartRepository],
  exports: [CartService, CartRepository]
})
export class CartModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(PublicStorefrontMiddleware)
      .forRoutes(
        { path: "cart/public/context", method: RequestMethod.GET },
        { path: "cart/public/current", method: RequestMethod.POST },
        { path: "cart/public/current/items", method: RequestMethod.POST },
        { path: "cart/public/current/items/:cartItemId", method: RequestMethod.PATCH },
        { path: "cart/public/current/items/:cartItemId", method: RequestMethod.DELETE },
        { path: "cart/public/current/clear", method: RequestMethod.POST }
      );
  }
}
