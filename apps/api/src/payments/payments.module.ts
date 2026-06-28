import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { CartModule } from "../cart/cart.module";
import { DomainsModule } from "../domains/domains.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PublicStorefrontMiddleware } from "../domains/public-storefront.middleware";
import { OrdersModule } from "../orders/orders.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsRepository } from "./payments.repository";
import { PaymentsService } from "./payments.service";
import { StripeConnectPaymentGatewayAdapter } from "./stripe-connect.adapter";

@Module({
  imports: [AuditModule, DomainsModule, OrdersModule, CartModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsRepository, StripeConnectPaymentGatewayAdapter],
  exports: [PaymentsService, PaymentsRepository]
})
export class PaymentsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PublicStorefrontMiddleware).forRoutes({
      path: "payments/public/orders/:orderId/intent",
      method: RequestMethod.POST
    });
  }
}
