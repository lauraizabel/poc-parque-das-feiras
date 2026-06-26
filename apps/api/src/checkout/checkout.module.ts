import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { DomainsModule } from "../domains/domains.module";
import { PublicStorefrontMiddleware } from "../domains/public-storefront.middleware";
import { CheckoutController } from "./checkout.controller";
import { CheckoutRepository } from "./checkout.repository";
import { CheckoutService } from "./checkout.service";

@Module({
  imports: [DomainsModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, CheckoutRepository],
  exports: [CheckoutService, CheckoutRepository]
})
export class CheckoutModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(PublicStorefrontMiddleware)
      .forRoutes({ path: "checkout/public/context", method: RequestMethod.GET });
  }
}
