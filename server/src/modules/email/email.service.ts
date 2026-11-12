import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env";
import { logger } from "../../common/logger";
import { GmailApiEmailService } from "./gmail-api";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailService {
  send(message: EmailMessage): Promise<void>;
}

export class ConsoleEmailService implements EmailService {
  async send(message: EmailMessage): Promise<void> {
    logger.info(
      {
        to: message.to,
        subject: message.subject,
      },
      "Email (console transport)",
    );

    console.log(message.text);
  }
}

export const SMTP_TIMEOUTS = {
  connectionTimeout: 10_000, // TCP connect
  greetingTimeout: 10_000, // server greeting after connect
  socketTimeout: 20_000, // inactivity during the session
} as const;

export class SmtpEmailService implements EmailService {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
      // Fail fast: nodemailer's defaults wait up to minutes (socket: 10 min) when the
      // SMTP port is unreachable, which left registration spinning in production.
      ...SMTP_TIMEOUTS,
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: env.EMAIL_FROM,
      ...message,
    });
  }
}

const createEmailService = (): EmailService => {
  switch (env.EMAIL_TRANSPORT) {
    case "smtp":
      return new SmtpEmailService();
    case "gmail_api":
      return new GmailApiEmailService({
        clientId: env.GMAIL_CLIENT_ID!,
        clientSecret: env.GMAIL_CLIENT_SECRET!,
        refreshToken: env.GMAIL_REFRESH_TOKEN!,
        from: env.EMAIL_FROM,
      });
    default:
      return new ConsoleEmailService();
  }
};

let current: EmailService = createEmailService();

export const getEmailService = (): EmailService => current;

export const setEmailService = (service: EmailService): void => {
  current = service;
};
