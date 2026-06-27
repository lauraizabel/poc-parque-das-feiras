import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrdersModule } from "../orders/orders.module";
import { ShippingController } from "./shipping.controller";
import { ShippingRepository } from "./shipping.repository";
import { ShippingService } from "./shipping.service";

@Module({
  imports: [AuthModule, OrdersModule],
  controllers: [ShippingController],
  providers: [ShippingService, ShippingRepository],
  exports: [ShippingService, ShippingRepository]
})
export class ShippingModule {}
