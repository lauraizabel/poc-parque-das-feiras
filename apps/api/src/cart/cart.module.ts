import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { DomainsModule } from "../domains/domains.module";
import { PublicStorefrontMiddleware } from "../domains/public-storefront.middleware";
import { CartController } from "./cart.controller";
import { CartRepository } from "./cart.repository";
import { CartService } from "./cart.service";

@Module({
  imports: [DomainsModule],
  controllers: [CartController],
  providers: [CartService, CartRepository],
  exports: [CartService, CartRepository]
})
export class CartModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(PublicStorefrontMiddleware)
      .forRoutes({ path: "cart/public/context", method: RequestMethod.GET });
  }
}
