import path from "node:path";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { createApiEnv } from "@acme/config";
import { AdminModule } from "./admin/admin.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { CartModule } from "./cart/cart.module";
import { CatalogModule } from "./catalog/catalog.module";
import { CheckoutModule } from "./checkout/checkout.module";
import { DomainsModule } from "./domains/domains.module";
import { HealthModule } from "./health/health.module";
import { IntegrationsModule } from "./integrations/integrations.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { OrdersModule } from "./orders/orders.module";
import { PaymentsModule } from "./payments/payments.module";
import { ShippingModule } from "./shipping/shipping.module";
import { StoresModule } from "./stores/stores.module";

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
    IntegrationsModule
  ]
})
export class AppModule {}
