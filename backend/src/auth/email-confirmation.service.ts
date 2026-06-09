import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

type ConfirmationEmailPayload = {
  to: string;
  fullName: string;
  confirmationUrl: string;
};

@Injectable()
export class EmailConfirmationService {
  private readonly logger = new Logger(EmailConfirmationService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor() {
    this.from =
      process.env.SMTP_FROM ||
      process.env.MAIL_FROM ||
      'no-reply@activos.local';

    if (!process.env.SMTP_HOST) {
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
    });
  }

  async sendConfirmationEmail(payload: ConfirmationEmailPayload) {
    if (!this.transporter) {
      const message =
        'SMTP no configurado. Define SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS y SMTP_FROM para enviar correos.';

      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException(message);
      }

      this.logger.warn(message);
      this.logger.log(`URL de confirmacion generada: ${payload.confirmationUrl}`);
      return { sent: false };
    }

    await this.transporter.sendMail({
      from: this.from,
      to: payload.to,
      subject: 'Confirma tu cuenta en ActivoGestion',
      text: [
        `Hola ${payload.fullName},`,
        '',
        'Confirma tu correo para activar tu cuenta en el sistema de seguimiento de activos:',
        payload.confirmationUrl,
      ].join('\n'),
      html: `
        <p>Hola ${payload.fullName},</p>
        <p>Confirma tu correo para activar tu cuenta en el sistema de seguimiento de activos.</p>
        <p><a href="${payload.confirmationUrl}">Confirmar correo</a></p>
      `,
    });

    return { sent: true };
  }
}
