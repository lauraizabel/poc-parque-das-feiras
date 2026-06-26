import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { CartModule } from "../cart/cart.module";
import { CatalogModule } from "../catalog/catalog.module";
import { DomainsModule } from "../domains/domains.module";
import { PublicStorefrontMiddleware } from "../domains/public-storefront.middleware";
import { OrdersModule } from "../orders/orders.module";
import { PaymentsModule } from "../payments/payments.module";
import { CheckoutController } from "./checkout.controller";
import { CheckoutRepository } from "./checkout.repository";
import { CheckoutService } from "./checkout.service";

@Module({
  imports: [DomainsModule, CartModule, CatalogModule, OrdersModule, PaymentsModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, CheckoutRepository],
  exports: [CheckoutService, CheckoutRepository]
})
export class CheckoutModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(PublicStorefrontMiddleware)
      .forRoutes(
        { path: "checkout/public/context", method: RequestMethod.GET },
        { path: "checkout/public/current/order", method: RequestMethod.POST }
      );
  }
}
