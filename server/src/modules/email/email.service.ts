import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env";
import { logger } from "../../common/logger";

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
  return env.EMAIL_TRANSPORT === "smtp" ? new SmtpEmailService() : new ConsoleEmailService();
};

let current: EmailService = createEmailService();

export const getEmailService = (): EmailService => current;

export const setEmailService = (service: EmailService): void => {
  current = service;
};
