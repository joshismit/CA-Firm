import nodemailer from 'nodemailer';
import { env } from './environment';

/**
 * Nodemailer transport singleton.
 * Configured via environment variables.
 * In development: use Mailtrap or Ethereal for testing.
 * In production: use SMTP relay (SendGrid, AWS SES, etc.)
 */
export const mailTransport = nodemailer.createTransport({
  host: env.MAIL_HOST,
  port: env.MAIL_PORT,
  secure: env.MAIL_PORT === 465,
  auth:
    env.MAIL_USER && env.MAIL_PASSWORD
      ? {
          user: env.MAIL_USER,
          pass: env.MAIL_PASSWORD,
        }
      : undefined,
});

export const mailConfig = {
  from: `"${env.MAIL_FROM_NAME}" <${env.MAIL_FROM}>`,
  defaults: {
    replyTo: env.MAIL_FROM,
  },
} as const;
