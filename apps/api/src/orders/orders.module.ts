import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { DomainsModule } from "../domains/domains.module";
import { PublicStorefrontMiddleware } from "../domains/public-storefront.middleware";
import { OrdersController } from "./orders.controller";
import { OrdersRepository } from "./orders.repository";
import { OrdersService } from "./orders.service";

@Module({
  imports: [DomainsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository],
  exports: [OrdersService, OrdersRepository]
})
export class OrdersModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PublicStorefrontMiddleware).forRoutes({
      path: "orders/public/:orderId",
      method: RequestMethod.GET
    });
  }
}
