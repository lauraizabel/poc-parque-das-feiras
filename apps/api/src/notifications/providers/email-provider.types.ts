export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type SendEmailResult = {
  success: boolean;
  provider: string;
  providerMessageId?: string | null;
  errorMessage?: string | null;
};

export type EmailProvider = {
  readonly provider: string;
  send(input: SendEmailInput): Promise<SendEmailResult>;
};
