import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards
} from "@nestjs/common";
import { StoreMemberRole } from "@prisma/client";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { StoreAccess } from "../auth/store-access.decorator";
import { StoreRoles } from "../auth/store-roles.decorator";
import { BaselinkerService } from "./baselinker.service";
import { BaselinkerShippingService } from "./baselinker-shipping.service";
import {
  saveBaselinkerConfigSchema,
  generateLabelSchema
} from "./baselinker.schemas";

@Controller("stores/:storeId/baselinker")
@UseGuards(JwtAuthGuard, AuthorizationGuard)
@StoreAccess()
@StoreRoles(StoreMemberRole.STORE_OWNER, StoreMemberRole.STORE_MANAGER)
export class BaselinkerController {
  constructor(
    private readonly baselinkerService: BaselinkerService,
    private readonly shippingService: BaselinkerShippingService
  ) {}

  @Get("config")
  async getConfig(@Param("storeId") storeId: string) {
    const config = await this.baselinkerService.getConfig(storeId);
    if (!config) throw new NotFoundException("BaseLinker not configured for this store");
    return config;
  }

  @Put("config")
  saveConfig(@Param("storeId") storeId: string, @Body() body: unknown) {
    const input = saveBaselinkerConfigSchema.parse(body);
    return this.baselinkerService.saveConfig(storeId, input);
  }

  @Delete("config")
  deleteConfig(@Param("storeId") storeId: string) {
    return this.baselinkerService.deleteConfig(storeId);
  }

  @Post("config/test")
  testConnection(@Param("storeId") storeId: string) {
    return this.baselinkerService.testConnection(storeId).then((ok) => ({ connected: ok }));
  }

  @Post("sync/orders/export")
  triggerOrderExport(@Param("storeId") storeId: string) {
    return this.baselinkerService.triggerOrderExport(storeId);
  }

  @Post("sync/orders/import")
  triggerOrderImport(@Param("storeId") storeId: string) {
    return this.baselinkerService.triggerOrderImport(storeId);
  }

  @Post("sync/catalog")
  triggerCatalogSync(@Param("storeId") storeId: string) {
    return this.baselinkerService.triggerCatalogSync(storeId);
  }

  @Get("sync/status")
  getSyncStatus(@Param("storeId") storeId: string) {
    return this.baselinkerService.getSyncStatus(storeId);
  }

  @Get("inventories")
  getInventories(@Param("storeId") storeId: string) {
    return this.baselinkerService.getInventories(storeId);
  }

  @Get("couriers")
  getCouriers(@Param("storeId") storeId: string) {
    return this.shippingService.getCouriers(storeId);
  }

  @Post("shipping/:orderId/label")
  generateLabel(
    @Param("storeId") storeId: string,
    @Param("orderId") orderId: string,
    @Body() body: unknown
  ) {
    const input = generateLabelSchema.parse(body);
    return this.shippingService.generateShippingLabel(
      storeId,
      orderId,
      input.courierCode,
      input.extraFields
    );
  }
}
