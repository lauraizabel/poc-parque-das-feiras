import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import { SendEmailInput, SendEmailResult, EmailProvider } from "./email-provider.types";

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  readonly provider = "resend";
  private readonly logger = new Logger(ResendEmailProvider.name);
  private readonly client: Resend | null;

  constructor(configService: ConfigService) {
    const apiKey = configService.get<string>("RESEND_API_KEY");

    if (apiKey) {
      this.client = new Resend(apiKey);
    } else {
      this.client = null;
    }
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    if (!this.client) {
      this.logger.warn(
        `Resend API key not configured — skipping email to ${input.to} (subject: ${input.subject})`
      );
      return {
        success: false,
        provider: this.provider,
        errorMessage: "Resend API key not configured"
      };
    }

    try {
      const response = await this.client.emails.send({
        from: "Parque das Feiras <noreply@parquedasfeiras.com>",
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: input.replyTo
      });

      if (response.error) {
        this.logger.error(
          `Resend API error for ${input.to}: ${JSON.stringify(response.error)}`
        );
        return {
          success: false,
          provider: this.provider,
          errorMessage: response.error.message ?? "Resend API returned an error"
        };
      }

      this.logger.log(
        `Email sent via Resend to ${input.to} | id: ${response.data?.id ?? "unknown"}`
      );

      return {
        success: true,
        provider: this.provider,
        providerMessageId: response.data?.id ?? null
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Resend error";
      this.logger.error(`Resend send failed for ${input.to}: ${message}`);
      return {
        success: false,
        provider: this.provider,
        errorMessage: message
      };
    }
  }
}
