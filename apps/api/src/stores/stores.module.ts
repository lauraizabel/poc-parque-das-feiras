import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StoresController } from "./stores.controller";
import { StoresRepository } from "./stores.repository";
import { StoresService } from "./stores.service";

@Module({
  imports: [AuthModule],
  controllers: [StoresController],
  providers: [StoresService, StoresRepository],
  exports: [StoresService, StoresRepository]
})
export class StoresModule {}
