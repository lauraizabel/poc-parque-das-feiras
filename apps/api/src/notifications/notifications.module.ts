import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsController } from "./notifications.controller";
import { NotificationsRepository } from "./notifications.repository";
import { NotificationsService } from "./notifications.service";
import { ConsoleEmailProvider } from "./providers/console-email.provider";
import { ResendEmailProvider } from "./providers/resend-email.provider";
import { EMAIL_PROVIDER_TOKEN, emailProviderFactory } from "./providers/email-provider-factory";

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    ConsoleEmailProvider,
    ResendEmailProvider,
    emailProviderFactory
  ],
  exports: [NotificationsService, NotificationsRepository, EMAIL_PROVIDER_TOKEN]
})
export class NotificationsModule {}
