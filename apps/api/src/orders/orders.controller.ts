import { Controller, Get, Param, Query } from "@nestjs/common";
import { OrdersService } from "./orders.service";

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get("boundary")
  getBoundary() {
    return this.ordersService.getBoundary();
  }

  @Get("public/:orderId")
  getPublicOrder(@Param("orderId") orderId: string, @Query("token") token = "") {
    return this.ordersService.getPublicOrder(orderId, token);
  }
}
