import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUser as CurrentUserType,
} from './decorators/current-user.decorator';
import type { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.register(registerDto);
    const { cookieValue, maxAge } =
      await this.authService.createAndStoreRefreshToken(result.user.id);
    res.cookie('refreshToken', cookieValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge,
    });
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.login(loginDto);
    const { cookieValue, maxAge } =
      await this.authService.createAndStoreRefreshToken(result.user.id);
    res.cookie('refreshToken', cookieValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge,
    });
    return result;
  }

  @Post('accept-invite')
  @HttpCode(HttpStatus.CREATED)
  async acceptInvite(
    @Body() acceptInviteDto: AcceptInviteDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.acceptInvite(acceptInviteDto);
    const { cookieValue, maxAge } =
      await this.authService.createAndStoreRefreshToken(result.user.id);
    res.cookie('refreshToken', cookieValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge,
    });
    return result;
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  async google(
    @Body() googleAuthDto: GoogleAuthDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.googleAuth(googleAuthDto);
    const { cookieValue, maxAge } =
      await this.authService.createAndStoreRefreshToken(result.user.id);
    res.cookie('refreshToken', cookieValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge,
    });
    return result;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: CurrentUserType,
  ): Promise<void> {
    // Cast through unknown to bypass strict 'any' checks
    const reqWithCookies = req as unknown as {
      cookies?: Record<string, string | undefined>;
      headers: { cookie?: string };
    };
    const cookies = reqWithCookies.cookies;
    const cookieHeader = reqWithCookies.headers.cookie;

    // Attempt to find refresh token in cookies or header
    let raw: string | undefined = cookies?.refreshToken;
    if (!raw && cookieHeader?.includes('refreshToken=')) {
      raw = cookieHeader.split('refreshToken=')[1].split(';')[0];
    }

    if (raw) {
      await this.authService.revokeRefreshToken(raw);
    } else {
      // fallback: revoke all tokens for user when cookie not provided
      await this.authService.revokeAllRefreshTokensForUser(user.userId);
    }

    res.clearCookie('refreshToken');
    return;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const reqWithData = req as unknown as {
      cookies?: Record<string, string | undefined>;
      body?: { refreshToken?: string };
      headers: { cookie?: string };
    };

    const cookies = reqWithData.cookies;
    const body = reqWithData.body;
    const cookieHeader = reqWithData.headers.cookie;

    let raw: string | undefined = cookies?.refreshToken || body?.refreshToken;
    if (!raw && cookieHeader?.includes('refreshToken=')) {
      raw = cookieHeader.split('refreshToken=')[1].split(';')[0];
    }

    if (!raw) {
      throw new Error('Refresh token not provided');
    }

    const rotated = await this.authService.rotateRefreshToken(raw);
    if (!rotated) {
      throw new Error('Invalid refresh token');
    }

    res.cookie('refreshToken', rotated.cookieValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: rotated.maxAge,
    });

    const accessToken = this.authService.createAccessTokenForUser(rotated.user);

    return {
      accessToken,
      user: {
        id: rotated.user.id,
        email: rotated.user.email,
        role: rotated.user.role,
      },
    };
  }
}
