import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { AuthService, UserWithoutPassword } from './auth.service';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { Public } from 'src/common/decorators/public.decorator';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SessionInfo } from 'src/common/decorators/session-info.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.registerUser(createUserDto);
  }

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  async login(
    @CurrentUser() user: UserWithoutPassword,
    @SessionInfo() sessionInfo,
  ) {
    return this.authService.loginUser(user, sessionInfo);
  }

  @Public(false)
  @Get('me')
  getCurrentUser(@CurrentUser() user: UserWithoutPassword) {
    return { user };
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @SessionInfo() sessionInfo,
  ) {
    return this.authService.rotateRefreshToken(
      refreshTokenDto.refreshToken,
      sessionInfo,
    );
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Query('token', new ParseUUIDPipe()) token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }
}
