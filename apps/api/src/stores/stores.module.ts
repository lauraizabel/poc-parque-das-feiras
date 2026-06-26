import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DomainsModule } from "../domains/domains.module";
import { PublicStorefrontMiddleware } from "../domains/public-storefront.middleware";
import { StoresController } from "./stores.controller";
import { StoresRepository } from "./stores.repository";
import { StoresService } from "./stores.service";

@Module({
  imports: [AuthModule, DomainsModule],
  controllers: [StoresController],
  providers: [StoresService, StoresRepository],
  exports: [StoresService, StoresRepository]
})
export class StoresModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(PublicStorefrontMiddleware)
      .forRoutes({ path: "stores/public/current", method: RequestMethod.GET });
  }
}
