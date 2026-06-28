import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationsRepository } from "./notifications.repository";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsRepository],
  exports: [NotificationsService, NotificationsRepository]
})
export class NotificationsModule {}
