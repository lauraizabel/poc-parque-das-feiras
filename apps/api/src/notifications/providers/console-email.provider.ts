import { Injectable, Logger } from "@nestjs/common";
import { SendEmailInput, SendEmailResult, EmailProvider } from "./email-provider.types";

@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  readonly provider = "console";
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    this.logger.log(
      `[${this.provider}] To: ${input.to} | Subject: ${input.subject} | HTML: ${input.html.length} chars | Text: ${input.text.length} chars`
    );

    return {
      success: true,
      provider: this.provider,
      providerMessageId: null
    };
  }
}
