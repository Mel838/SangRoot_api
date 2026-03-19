import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;

  constructor(private configService: ConfigService) {
    // Transporter is initialised in onModuleInit so async work is safe
  }

  async onModuleInit(): Promise<void> {
    const mailUser = this.configService.get<string>('MAIL_USER');

    if (mailUser) {
      // Use the configured SMTP provider (Brevo, Gmail, etc.)
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('MAIL_HOST'),
        port: this.configService.get<number>('MAIL_PORT', 587),
        secure: this.configService.get<string>('MAIL_SECURE') === 'true',
        auth: {
          user: mailUser,
          pass: this.configService.get<string>('MAIL_PASS'),
        },
      });
      this.logger.log(
        `📧 Mailer ready — SMTP: ${this.configService.get<string>('MAIL_HOST')}`,
      );
    } else {
      // No credentials — spin up a free Ethereal sandbox account
      const testAccount = await nodemailer.createTestAccount();
      this.logger.warn(
        `📧 No MAIL_USER set — using Ethereal sandbox: ${testAccount.user}`,
      );
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
    }
  }

  async sendDoctorInvite(
    to: string,
    inviteId: string,
    hospitalName: string,
  ): Promise<void> {
    const from = this.configService.get<string>(
      'MAIL_FROM',
      'SangRoot <noreply@sangroot.com>',
    );

    const mailOptions = {
      from,
      to,
      subject: `You've been invited to join ${hospitalName} on SangRoot`,
      html: `
      <div style="background:#F5F7FA;padding:30px 0;font-family:Arial,Helvetica,sans-serif;">
        
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center">

              <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:8px;overflow:hidden;">

                <!-- Header -->
                <tr>
                  <td style="background:#1F4E79;padding:24px;text-align:center;color:#FFFFFF;">
                    <h2 style="margin:0;font-size:22px;">SangRoot</h2>
                    <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">
                      Connecting Blood Donors, Hospitals & Doctors
                    </p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:30px;color:#333333;font-size:15px;line-height:1.6;">

                    <p style="margin-top:0;">Hello,</p>

                    <p>
                      You have been invited to join 
                      <strong>${hospitalName}</strong> as a doctor on the 
                      <strong>SangRoot</strong> platform.
                    </p>

                    <p>
                      SangRoot helps hospitals and doctors quickly locate blood donors
                      and manage blood availability during emergencies.
                    </p>

                    <p><strong>Your invitation code:</strong></p>

                    <!-- Invite Code -->
                    <div style="
                      background:#F5F7FA;
                      border:1px solid #E3E6EA;
                      border-radius:8px;
                      padding:14px 16px;
                      margin:20px 0;
                      text-align:center;
                    ">
                      <span style="
                        font-size:12px;
                        font-weight:bold;
                        letter-spacing:2px;
                      ">
                        ${inviteId}
                      </span>
                    </div>

                    <p>
                      Open the <strong>SangRoot</strong> app, tap 
                      <em>Accept Invite</em>, and enter the code above along with your
                      email address: <span style="font-weight:bold;color:#1F4E79;"> ${to} </span>
                    </p>
                    <p>
                      Once completed, you'll be connected with your hospital
                      and ready to support life-saving blood coordination.
                    </p>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background:#F5F7FA;padding:20px;text-align:center;font-size:12px;color:#666;">
                    <p style="margin:0;">
                      If you were not expecting this invitation, you can safely ignore this email.
                    </p>

                    <p style="margin:8px 0 0;color:#999;">
                      © ${new Date().getFullYear()} SangRoot
                    </p>
                  </td>
                </tr>

              </table>

            </td>
          </tr>
        </table>

      </div>
      `,
    };

    try {
      const info: SMTPTransport.SentMessageInfo =
        (await this.transporter.sendMail(
          mailOptions,
        )) as SMTPTransport.SentMessageInfo;
      this.logger.log(`Invite email sent to ${to} (invite: ${inviteId})`);

      // If using Ethereal (no MAIL_USER configured) log the preview URL
      if (!this.configService.get<string>('MAIL_USER')) {
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
