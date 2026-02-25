import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;
  private isDev: boolean;

  constructor(private configService: ConfigService) {
    this.isDev = this.configService.get<string>('NODE_ENV') !== 'production';
    // Transporter is initialised lazily in onModuleInit so async work is safe
  }

  async onModuleInit(): Promise<void> {
    if (this.isDev) {
      // Auto-generate a real Ethereal test account — no credentials needed
      const testAccount = await nodemailer.createTestAccount();
      this.logger.log(`📧 Ethereal test account created: ${testAccount.user}`);
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
    } else {
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('MAIL_HOST'),
        port: this.configService.get<number>('MAIL_PORT', 587),
        secure: this.configService.get<string>('MAIL_SECURE') === 'true',
        auth: {
          user: this.configService.get<string>('MAIL_USER'),
          pass: this.configService.get<string>('MAIL_PASS'),
        },
      });
    }
  }

  async sendDoctorInvite(
    to: string,
    inviteId: string,
    hospitalName: string,
  ): Promise<void> {
    const from = this.isDev
      ? 'SangRoot Dev <noreply@sangroot.com>'
      : this.configService.get<string>(
          'MAIL_FROM',
          'SangRoot <noreply@sangroot.com>',
        );

    const mailOptions = {
      from,
      to,
      subject: `You've been invited to join ${hospitalName} on SangRoot`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #c0392b;">SangRoot — Doctor Invitation</h2>
          <p>Hello,</p>
          <p>
            You have been invited to join <strong>${hospitalName}</strong> as a doctor
            on the <strong>SangRoot</strong> platform.
          </p>
          <p>Use the invite code below when creating your account:</p>
          <div style="
            background: #f4f4f4;
            border: 1px solid #ddd;
            border-radius: 6px;
            padding: 16px 24px;
            margin: 20px 0;
            text-align: center;
          ">
            <span style="font-size: 20px; font-weight: bold; letter-spacing: 2px; color: #c0392b;">
              ${inviteId}
            </span>
          </div>
          <p>
            Open the SangRoot app, tap <em>Accept Invite</em>, and enter the code above
            along with your email address <strong>(${to})</strong> to complete registration.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="font-size: 12px; color: #999;">
            If you were not expecting this invitation, you can safely ignore this email.
          </p>
        </div>
      `,
    };

    try {
      const info: SMTPTransport.SentMessageInfo =
        (await this.transporter.sendMail(
          mailOptions,
        )) as SMTPTransport.SentMessageInfo;
      this.logger.log(`Invite email sent to ${to} (invite: ${inviteId})`);

      // In dev, log the Ethereal preview URL so you can open it in the browser
      if (this.isDev) {
        const previewUrl: string | false = nodemailer.getTestMessageUrl(info);
        this.logger.log(`📬 Preview email at: ${String(previewUrl)}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send invite email to ${to}: ${(error as Error).message}`,
      );
      // Re-throw so the caller knows delivery failed
      throw error;
    }
  }
}
