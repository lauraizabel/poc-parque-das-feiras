import path from "node:path";
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { createApiEnv } from "@acme/config";
import { AdminModule } from "./admin/admin.module";
import { AdminController } from "./admin/admin.controller";
import { AuditModule } from "./audit/audit.module";
import { AuditController } from "./audit/audit.controller";
import { AuthModule } from "./auth/auth.module";
import { AuthController } from "./auth/auth.controller";
import { CartModule } from "./cart/cart.module";
import { CartController } from "./cart/cart.controller";
import { CatalogModule } from "./catalog/catalog.module";
import { CatalogController } from "./catalog/catalog.controller";
import { CheckoutModule } from "./checkout/checkout.module";
import { CheckoutController } from "./checkout/checkout.controller";
import { DomainsModule } from "./domains/domains.module";
import { DomainsController } from "./domains/domains.controller";
import { HealthModule } from "./health/health.module";
import { HealthController } from "./health/health.controller";
import { IntegrationsModule } from "./integrations/integrations.module";
import { IntegrationsController } from "./integrations/integrations.controller";
import { NotificationsModule } from "./notifications/notifications.module";
import { NotificationsController } from "./notifications/notifications.controller";
import { OrdersModule } from "./orders/orders.module";
import { OrdersController } from "./orders/orders.controller";
import { PaymentsModule } from "./payments/payments.module";
import { PaymentsController } from "./payments/payments.controller";
import { ShippingModule } from "./shipping/shipping.module";
import { ShippingController } from "./shipping/shipping.controller";
import { StoresModule } from "./stores/stores.module";
import { StoresController } from "./stores/stores.controller";
import { ApiSecurityMiddleware } from "./platform/security/api-security.middleware";
import { AuthRateLimitMiddleware } from "./platform/security/auth-rate-limit.middleware";
import { SecurityModule } from "./platform/security/security.module";
import { WebhookRateLimitMiddleware } from "./platform/security/webhook-rate-limit.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(process.cwd(), ".env"),
        path.resolve(process.cwd(), "../.env"),
        path.resolve(process.cwd(), "../../.env")
      ],
      validate: (env) => createApiEnv(env)
    }),
    AuthModule,
    StoresModule,
    DomainsModule,
    CatalogModule,
    CartModule,
    CheckoutModule,
    PaymentsModule,
    ShippingModule,
    OrdersModule,
    AdminModule,
    NotificationsModule,
    AuditModule,
    HealthModule,
    IntegrationsModule,
    SecurityModule
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ApiSecurityMiddleware).forRoutes(
      AdminController,
      AuditController,
      AuthController,
      CartController,
      CatalogController,
      CheckoutController,
      DomainsController,
      HealthController,
      IntegrationsController,
      NotificationsController,
      OrdersController,
      PaymentsController,
      ShippingController,
      StoresController
    );
    consumer.apply(AuthRateLimitMiddleware).forRoutes(
      { path: "auth/login", method: RequestMethod.POST },
      { path: "auth/register", method: RequestMethod.POST },
      { path: "auth/register-merchant", method: RequestMethod.POST },
      { path: "auth/refresh", method: RequestMethod.POST }
    );
    consumer.apply(WebhookRateLimitMiddleware).forRoutes({
      path: "payments/webhooks/stripe",
      method: RequestMethod.POST
    });
  }
}
