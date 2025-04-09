import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  Logger, // Import Logger
} from '@nestjs/common';
import * as crypto from 'crypto';
import { LoginUserDto } from './dto/login-user.dto';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { ConfigType } from '@nestjs/config';
import { hash, verify } from 'argon2';
import { User, RefreshToken } from '@prisma/client';
import passwordConfig from './config/password.config';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import jwtConfig from './config/jwt.config';
import refreshTokenConfig from './config/refresh-token.config';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { SessionInfos } from 'src/common/interfaces/session-info.interface';
import { MailService } from 'src/mail/mail.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Role } from 'src/common/enums/roles-enum';

// Define User type without password for safety
export type UserWithoutPassword = Omit<User, 'password'>;
// Define User type including refresh tokens if needed elsewhere (adjust based on schema)
export type UserWithTokens = User & { refreshTokens?: RefreshToken[] };

@Injectable()
export class AuthService {
  // Add a logger instance for better logging
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(passwordConfig.KEY)
    private passwordConfiguration: ConfigType<typeof passwordConfig>,
    @Inject(refreshTokenConfig.KEY)
    private refreshTokenConfiguration: ConfigType<typeof refreshTokenConfig>,
    @Inject(jwtConfig.KEY)
    private jwtConfiguration: ConfigType<typeof jwtConfig>,
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly prismaService: PrismaService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Hashes a password using Argon2.
   */
  private async hashPassword(password: string): Promise<string> {
    // Use secrets from configuration for added security layer if desired,
    // otherwise Argon2's salt handles uniqueness. Using a secret here acts like a pepper.
    const secretBuffer = Buffer.from(
      this.passwordConfiguration.secret,
      'utf-8',
    );
    return hash(password, {
      secret: secretBuffer,
      memoryCost: this.passwordConfiguration.memoryCost, // Use configured values
      timeCost: this.passwordConfiguration.timeCost, // Use configured values
      parallelism: this.passwordConfiguration.parallelism, // Use configured values
      type: 2, // argon2id type
    });
  }

  /**
   * Verifies a password against a hash using Argon2.
   */
  private async verifyPassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      const secretBuffer = Buffer.from(
        this.passwordConfiguration.secret,
        'utf-8',
      );
      return await verify(hashedPassword, password, {
        secret: secretBuffer,
      });
    } catch (error) {
      // Log verification errors (e.g., incompatible hash format), but return false for security
      this.logger.error('Error verifying password:', error.message);
      return false;
    }
  }

  /**
   * Verifies a password against a hash using Argon2.
   */
  private async verifyToken(
    rawToken: string,
    hashedToken: string,
  ): Promise<boolean> {
    try {
      const secretBuffer = Buffer.from(
        this.refreshTokenConfiguration.secret,
        'utf-8',
      );
      return await verify(hashedToken, rawToken, {
        secret: secretBuffer,
      });
    } catch (error) {
      // Log verification errors (e.g., incompatible hash format), but return false for security
      this.logger.error('Error verifying refresh token:', error.message);
      return false;
    }
  }

  /**
   * Hashes a refresh token using Argon2. Use a *different* secret than passwords.
   */
  private async hashToken(token: string): Promise<string> {
    const secretBuffer = Buffer.from(
      this.refreshTokenConfiguration.secret,
      'utf-8',
    );
    // Use slightly less intensive params for tokens compared to passwords if needed
    // but ensure it's still strong enough against offline attacks.
    return hash(token, {
      secret: secretBuffer,
      memoryCost: 2 ** 15, // Example: Slightly lower than password
      timeCost: 2, // Example: Slightly lower than password
      parallelism: 1,
      type: 2, // argon2id
    });
  }

  /**
   * Generates a secure random token (UUID v4).
   */
  private generateRandomToken(): string {
    return uuidv4();
  }

  /**
   * Generates a JWT access token for a user.
   */
  private generateAccessToken(user: UserWithoutPassword): string {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email, // Using email is common
      // Add roles or other necessary claims here if needed
    };

    return this.jwtService.sign(payload, {
      expiresIn: this.jwtConfiguration.expirationTime, // Use configured expiration
      secret: this.jwtConfiguration.secret, // Use configured secret
    });
  }

  /**
   * Creates and stores a *hashed* refresh token.
   */
  private async createAndStoreRefreshToken({
    userId,
    family,
    sessionInfo,
  }: {
    userId: string;
    family?: string; // Token family for rotation tracking
    sessionInfo?: SessionInfos;
  }): Promise<string> {
    const rawToken = uuidv4(); // Generate the raw token
    const hashedToken = await this.hashToken(rawToken); // Hash it
    const lookupHash = this.createTokenLookupHash(rawToken); // Deterministic hash for lookup

    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() + this.refreshTokenConfiguration.expiresInDays,
    );

    // Determine the family ID
    const tokenFamily = family || uuidv4(); // Use existing family or create a new one

    try {
      await this.prismaService.refreshToken.create({
        data: {
          lookupHash, // Store the deterministic hash for lookup
          token: hashedToken, // Store the HASHED token
          userId,
          family: tokenFamily,
          expiresAt,
          used: false, // Mark as not used initially
          invalidated: false, // Mark as not invalidated initially
          userAgent: sessionInfo?.userAgent,
          ipAddress: sessionInfo?.ipAddress,
        },
      });
      return rawToken; // Return the RAW token to the client
    } catch (error) {
      this.logger.error(
        `Failed to create refresh token for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not create refresh token.');
    }
  }

  /**
   * Invalidates all tokens within a specific family (used for reuse detection).
   */
  private async invalidateTokenFamily(family: string): Promise<void> {
    try {
      await this.prismaService.refreshToken.updateMany({
        where: { family: family, invalidated: false }, // Only update non-invalidated ones
        data: { invalidated: true },
      });
      this.logger.warn(`Invalidated token family: ${family}`);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate token family ${family}: ${error.message}`,
        error.stack,
      );
      // Decide if this should throw - potentially leads to lingering valid tokens
      // For now, log error and continue.
    }
  }

  /**
   * Creates a deterministic hash for token lookup
   * This is NOT for security, only for lookup efficiency
   */
  private createTokenLookupHash(token: string): string {
    // Use a fast hash for lookups (SHA-256)
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // --- Public Authentication Methods ---

  async registerUser(
    createUserDto: CreateUserDto,
  ): Promise<{ message: string }> {
    const { email, password, ...restOfDto } = createUserDto; // Destructure password

    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already registered.');
    }

    const hashedPassword = await this.hashPassword(password);
    const verificationToken = this.generateRandomToken();

    // Avoid mutating the DTO, create user data object explicitly
    const userData = {
      ...restOfDto,
      email,
      password: hashedPassword,
      isEmailVerified: false,
      verificationToken,
    };

    const user = await this.userService.create(userData);

    // Send verification email asynchronously (fire and forget with error logging)
    this.mailService
      .sendVerificationEmail(user, verificationToken)
      .catch((err) =>
        this.logger.error(
          `Failed to send verification email to ${user.email}: ${err.message}`,
          err.stack,
        ),
      );

    return {
      message:
        'Registration successful. Please check your email to verify your account.',
    };
  }

  /**
   * Validates user credentials for local strategy (email/password).
   * Returns user data (without password) or throws UnauthorizedException.
   */
  async validateLocalUser(
    loginDto: LoginUserDto,
  ): Promise<UserWithoutPassword> {
    // Changed return type: never returns null
    const user = await this.userService.findByEmail(loginDto.email);

    // Check if user exists AND password is valid
    if (
      !user ||
      !(await this.verifyPassword(loginDto.password, user.password))
    ) {
      throw new UnauthorizedException('Invalid credentials.'); // Generic message
    }

    // Check email verification status AFTER confirming credentials
    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in.',
      );
    }

    const { password, ...result } = user;
    return result;
  }

  /**
   * Validates the user based on JWT payload. Used by JwtStrategy.
   */
  async validateJwtUser(payload: JwtPayload): Promise<UserWithoutPassword> {
    const user = await this.prismaService.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      // This means the user ID in a valid token doesn't exist anymore
      throw new UnauthorizedException('User not found or token invalid.');
    }

    // Type assertion is safe due to explicit `select` excluding password
    return user as UserWithoutPassword;
  }

  /**
   * Logs in a user, providing access and refresh tokens.
   */
  async loginUser(
    user: UserWithoutPassword,
    sessionInfo: SessionInfos,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Consider running cleanup periodically instead of on every login
    // this.cleanupExpiredTokens(user.id);

    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(user),
      this.createAndStoreRefreshToken({ userId: user.id, sessionInfo }), // Creates hashed token
    ]);

    return {
      accessToken,
      refreshToken, // Return the RAW refresh token
    };
  }

  /**
   * Rotates a refresh token, issuing new access and refresh tokens.
   * Implements reuse detection.
   */
  async rotateRefreshToken(
    oldRawToken: string, // Expect the raw token from the client
    sessionInfo: SessionInfos,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const lookupHash = this.createTokenLookupHash(oldRawToken);

    const { accessToken, refreshToken } = await this.prismaService.$transaction(
      async (prisma) => {
        // 1. Find the corresponding *hashed* token in the DB
        const existingToken = await prisma.refreshToken.findUnique({
          where: { lookupHash }, // Query using the HASHED token
          include: {
            user: {
              // Include user data needed for new access token
              select: { id: true, email: true /*, username: true */ }, // Select only necessary fields
            },
          },
        });

        // 2. Basic validation checks
        if (!existingToken) {
          this.logger.warn(
            `Attempted refresh with non-existent token lookup hash: ${lookupHash}`,
          );
          // this.logger.warn(`Attempted refresh with non-existent token hash.`);
          // Optional: Implement lookup by family to detect reuse even if token is deleted
          throw new UnauthorizedException('Invalid refresh token.');
        }

        if (existingToken.invalidated) {
          this.logger.warn(
            `Attempted refresh with invalidated token family: ${existingToken.family}`,
          );
          throw new UnauthorizedException(
            'Refresh token has been invalidated.',
          );
        }

        if (existingToken.used) {
          this.logger.warn(
            `Refresh token reuse detected for family: ${existingToken.family}`,
          );
          // Critical: Invalidate the entire family if a used token is presented again
          await this.invalidateTokenFamily(existingToken.family); // Use the helper within transaction
          throw new UnauthorizedException('Refresh token reuse detected.');
        }

        if (existingToken.expiresAt < new Date()) {
          this.logger.warn(
            `Attempted refresh with expired token for user: ${existingToken.userId}`,
          );
          // Optionally delete the expired token here or rely on cleanup job
          throw new UnauthorizedException('Refresh token expired.');
        }

        // 3. Verify the token matches using Argon2 verify
        const isValidToken = await this.verifyToken(
          oldRawToken,
          existingToken.token, // Use the hashed token from DB
        );

        if (!isValidToken) {
          this.logger.warn(
            `Token validation failed for lookup hash: ${lookupHash}`,
          );
          throw new UnauthorizedException('Invalid refresh token.');
        }

        // 3. Mark the old token as used (within the transaction)
        await prisma.refreshToken.update({
          where: { id: existingToken.id },
          data: { used: true },
        });

        // 4. Create new tokens (Access and Hashed Refresh)
        // Ensure existingToken.user contains the necessary fields (id, email, etc.)
        const userPayload = existingToken.user as UserWithoutPassword; // Cast based on select
        if (!userPayload) {
          this.logger.error(
            `User data missing for refresh token ID ${existingToken.id}`,
          );
          throw new InternalServerErrorException(
            'Could not refresh token due to missing user data.',
          );
        }

        const newAccessToken = this.generateAccessToken(userPayload);
        const newRawRefreshToken = await this.createAndStoreRefreshToken({
          // Use internal method that handles hashing
          userId: existingToken.userId,
          family: existingToken.family, // Keep the same family
          sessionInfo,
        });

        return {
          accessToken: newAccessToken,
          refreshToken: newRawRefreshToken,
        }; // Return RAW refresh token
      },
    );

    return { accessToken, refreshToken };
  }

  /**
   * Logs out a user by deleting the specific *hashed* refresh token.
   */
  async logout(rawRefreshToken: string): Promise<{ success: boolean }> {
    try {
      const lookupHash = this.createTokenLookupHash(rawRefreshToken);
      await this.prismaService.refreshToken.delete({
        where: { lookupHash }, // Delete based on the HASHED token
      });
      return { success: true };
    } catch (error) {
      // Log error but don't fail the logout operation for the client
      // Prisma error P2025 (RecordNotFound) is expected if token already deleted/invalid
      if (error.code !== 'P2025') {
        this.logger.error(
          `Error during logout for token hash: ${error.message}`,
          error.stack,
        );
      }
      // Always return success to the client for logout
      return { success: true };
    }
  }

  /**
   * Revokes all refresh tokens for a specific user.
   * Useful for "logout everywhere" or after password changes.
   */
  async revokeAllUserTokens(userId: string): Promise<{ count: number }> {
    try {
      const { count } = await this.prismaService.refreshToken.deleteMany({
        where: { userId: userId },
      });
      this.logger.log(`Revoked ${count} refresh tokens for user ${userId}`);
      return { count };
    } catch (error) {
      this.logger.error(
        `Failed to revoke tokens for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not revoke sessions.');
    }
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    if (!token) {
      throw new BadRequestException('Verification token is required.');
    }

    const user = await this.prismaService.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      // Don't reveal if token is invalid vs expired vs non-existent
      throw new BadRequestException('Invalid or expired verification link.');
    }

    if (user.isEmailVerified) {
      // User might click the link again
      return { message: 'Email has already been verified.' };
    }

    try {
      await this.prismaService.user.update({
        where: { id: user.id },
        // Clear the token once used for security
        data: { isEmailVerified: true, verificationToken: null },
      });

      return { message: 'Email successfully verified. You can now log in.' };
    } catch (error) {
      this.logger.error(
        `Email verification failed for token ${token}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not verify email.');
    }
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const { email } = forgotPasswordDto;
    const user = await this.userService.findByEmail(email);

    const genericMessage =
      'If an account with that email exists, a password reset link has been sent.';

    if (user) {
      const resetToken = this.generateRandomToken();
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + 1); // Token valid for 1 hour

      try {
        // Update user record with token and expiry
        await this.prismaService.user.update({
          where: { id: user.id },
          data: {
            passwordResetToken: resetToken,
            passwordResetExpires: expiryDate,
          },
        });

        // Send email asynchronously
        this.mailService
          .sendPasswordResetEmail(user, resetToken)
          .catch((err) => {
            // Log failure, but don't expose failure to user
            this.logger.error(
              `Failed to send password reset email to ${user.email}: ${err.message}`,
              err.stack,
            );
          });
      } catch (error) {
        // Log DB error but still return generic message
        this.logger.error(
          `Forgot password DB update failed for ${email}: ${error.message}`,
          error.stack,
        );
        // Depending on policy, you might still return generic message,
        // or throw InternalServerError if DB update is critical fail
        throw new InternalServerErrorException(
          'Could not process password reset request.',
        );
      }
    } else {
      // Log email not found but don't inform user
      this.logger.log(
        `Password reset requested for non-existent email: ${email}`,
      );
    }

    return { message: genericMessage };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const { token, newPassword } = resetPasswordDto;

    if (!token) {
      throw new BadRequestException('Reset token is missing.');
    }

    const user = await this.prismaService.user.findFirst({
      where: { passwordResetToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired password reset token.');
    }

    // Check if token has expired BEFORE proceeding
    if (user.passwordResetExpires && user.passwordResetExpires < new Date()) {
      // Clear the expired token preemptively
      try {
        await this.prismaService.user.update({
          where: { id: user.id },
          data: { passwordResetToken: null, passwordResetExpires: null },
        });
      } catch (clearError) {
        this.logger.error(
          `Failed to clear expired reset token for user ${user.id}: ${clearError.message}`,
        );
      }
      throw new BadRequestException('Password reset token has expired.');
    }

    // Hash the new password BEFORE the transaction
    const hashedPassword = await this.hashPassword(newPassword);

    try {
      // Use transaction to update password AND revoke tokens
      await this.prismaService.$transaction(async (prisma) => {
        // 1. Update password and clear reset token fields
        await prisma.user.update({
          where: { id: user.id },
          data: {
            password: hashedPassword,
            passwordResetToken: null,
            passwordResetExpires: null,
          },
        });

        // 2. Revoke all existing refresh tokens for this user (critical security step)
        await this.revokeAllUserTokens(user.id);
      });

      this.logger.log(`Password reset successfully for user ${user.id}`);
      // Optional: Send confirmation email here

      return { message: 'Password has been successfully reset.' };
    } catch (error) {
      this.logger.error(
        `Reset password failed for user ${user.id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Could not reset password.');
    }
  }

  /**
   * Utility to clean up expired refresh tokens (intended for scheduled jobs).
   */
  async cleanupExpiredTokens(): Promise<{ count: number }> {
    try {
      const result = await this.prismaService.refreshToken.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
      this.logger.log(`Cleaned up ${result.count} expired refresh tokens.`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed during expired token cleanup: ${error.message}`,
        error.stack,
      );
      return { count: 0 }; // Return 0 or throw depending on desired behavior
    }
  }
}
