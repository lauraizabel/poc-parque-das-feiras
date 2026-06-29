import { FactoryProvider, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EmailProvider } from "./email-provider.types";
import { ConsoleEmailProvider } from "./console-email.provider";
import { ResendEmailProvider } from "./resend-email.provider";

export const EMAIL_PROVIDER_TOKEN = "EMAIL_PROVIDER";
const logger = new Logger("EmailProviderFactory");

export const emailProviderFactory: FactoryProvider<EmailProvider> = {
  provide: EMAIL_PROVIDER_TOKEN,
  inject: [ConfigService, ConsoleEmailProvider, ResendEmailProvider],
  useFactory: (
    configService: ConfigService,
    consoleProvider: ConsoleEmailProvider,
    resendProvider: ResendEmailProvider
  ): EmailProvider => {
    const enabled = configService.get<boolean>("EMAIL_ENABLED") ?? false;

    if (!enabled) {
      logger.log("Email sending disabled — using console provider (dev/test mode)");
      return consoleProvider;
    }

    const providerName = configService.get<string>("EMAIL_PROVIDER") ?? "RESEND";

    switch (providerName) {
      case "RESEND":
        logger.log("Email provider: Resend");
        return resendProvider;
      default:
        logger.warn(`Unknown email provider "${providerName}" — falling back to console`);
        return consoleProvider;
    }
  }
};
