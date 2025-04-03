import { Injectable } from '@nestjs/common';
import { MailerService as NestMailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';

@Injectable()
export class MailService {
  constructor(
    private readonly nestMailerService: NestMailerService,
    private readonly configService: ConfigService,
  ) {}

  private getBackendUrl(): string {
    return (
      this.configService.get<string>('BACKEND_API_URL') ||
      'http://localhost:3001'
    );
  }

  private getFrontendUrl(): string {
    return (
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    );
  }

  async sendPasswordResetEmail(user: User, token: string): Promise<void> {
    // This link should usually go to a frontend page
    const resetUrl = `${this.getFrontendUrl()}/reset-password?token=${token}`;

    try {
      await this.nestMailerService.sendMail({
        to: user.email,
        subject: 'Password Reset Request',
        template: './password-reset', // Points to src/mailer/templates/password-reset.hbs
        context: {
          name: user.firstName || 'User',
          resetUrl,
        },
      });
      console.log(`Password reset email sent to ${user.email}`);
    } catch (error) {
      console.error(
        `Failed to send password reset email to ${user.email}`,
        error,
      );
      // Add more robust error handling/logging if needed
    }
  }

  async sendVerificationEmail(user: User, token: string): Promise<void> {
    // Use BACKEND_API_URL if verification happens server-side
    // Use FRONTEND_URL if verification link leads to a frontend page that calls the API
    const verificationUrl = `${this.getBackendUrl()}/auth/verify-email?token=${token}`;
    // Or if handled by frontend:
    // const verificationUrl = `<span class="math-inline">\{this\.getFrontendUrl\(\)\}/verify\-email?token\=</span>{token}`;

    try {
      await this.nestMailerService.sendMail({
        to: user.email,
        subject: 'Welcome! Verify Your Email',
        template: './verification', // Points to src/mailer/templates/verification.hbs
        context: {
          name: user.firstName || 'User',
          verificationUrl,
        },
      });
      console.log(`Verification email sent to ${user.email}`);
    } catch (error) {
      console.error(
        `Failed to send verification email to ${user.email}`,
        error,
      );
      // Add more robust error handling/logging if needed
    }
  }
}
