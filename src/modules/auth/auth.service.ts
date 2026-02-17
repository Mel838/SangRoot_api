import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, InviteStatus, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // --- Refresh token helpers ---
  private REFRESH_TOKEN_DAYS = 30; // lifetime

  private generateRandomToken(len = 48) {
    return crypto.randomBytes(len).toString('base64url');
  }

  // Creates and stores a refresh token record and returns the cookie value and maxAge
  async createAndStoreRefreshToken(
    userId: string,
  ): Promise<{ cookieValue: string; maxAge: number }> {
    const tokenId = randomUUID();
    const token = this.generateRandomToken();
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date(
      Date.now() + this.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId,
        tokenHash,
        expiresAt,
      },
    });

    const cookieValue = `${tokenId}.${token}`;
    const maxAge = this.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000;
    return { cookieValue, maxAge };
  }

  // Verify a cookie value in form "id.token" and return the token record and user
  private async findRefreshTokenRecord(cookieValue: string) {
    if (!cookieValue) return null;
    const parts = cookieValue.split('.');
    if (parts.length < 2) return null;
    const id = parts.shift();
    const token = parts.join('.');

    const record = await this.prisma.refreshToken.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!record) return null;
    if (record.revoked) return null;
    if (record.expiresAt.getTime() < Date.now()) return null;

    const isValid = await bcrypt.compare(token, record.tokenHash);
    if (!isValid) return null;

    return { record, token };
  }

  // Rotate refresh token: validate old cookie, revoke old, create new, return new cookie and user
  async rotateRefreshToken(
    cookieValue: string,
  ): Promise<{ cookieValue: string; maxAge: number; user: User } | null> {
    const found = await this.findRefreshTokenRecord(cookieValue);
    if (!found) return null;

    const { record } = found;

    // revoke old
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revoked: true },
    });

    // create new
    const { cookieValue: newCookieValue, maxAge } =
      await this.createAndStoreRefreshToken(record.userId);

    return { cookieValue: newCookieValue, maxAge, user: record.user };
  }

  // Revoke a single refresh token (by cookie) - used on logout
  async revokeRefreshToken(cookieValue: string): Promise<void> {
    const parts = cookieValue ? cookieValue.split('.') : [];
    if (parts.length < 2) return;
    const id = parts.shift();
    try {
      await this.prisma.refreshToken.update({
        where: { id },
        data: { revoked: true },
      });
    } catch {
      // ignore if not found
    }
  }

  // Revoke all tokens for a user (optional)
  async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });
  }

  // Create access token for a user object
  createAccessTokenForUser(user: {
    id: string;
    email: string;
    role: string;
  }): string {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      email: user.email,
    };
    return this.jwtService.sign(payload);
  }

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, role } = registerDto;

    // Validate role
    if (role !== UserRole.HOSPITAL && role !== UserRole.BLOOD_BANK) {
      throw new BadRequestException(
        'Role must be either HOSPITAL or BLOOD_BANK',
      );
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user and role-specific profile in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          role,
          isActive: true,
        },
      });

      // Create role-specific profile
      if (role === UserRole.HOSPITAL) {
        await tx.hospital.create({
          data: {
            userId: user.id,
            name: '', // These should be filled in a separate update endpoint
            address: '',
            city: '',
            state: '',
            pincode: '',
            phone: '',
            licenseNumber: '',
          },
        });
      } else if (role === UserRole.BLOOD_BANK) {
        await tx.bloodBank.create({
          data: {
            userId: user.id,
            name: '',
            address: '',
            city: '',
            state: '',
            pincode: '',
            phone: '',
            licenseNumber: '',
          },
        });
      }

      return user;
    });

    // Generate JWT token
    const payload: JwtPayload = {
      sub: result.id,
      role: result.role,
      email: result.email,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: result.id,
        email: result.email,
        role: result.role,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      email: user.email,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async acceptInvite(
    acceptInviteDto: AcceptInviteDto,
  ): Promise<AuthResponseDto> {
    const {
      inviteId,
      email,
      password,
      name,
      phone,
      registrationNo,
      specialization,
    } = acceptInviteDto;

    // Find invite
    const invite = await this.prisma.hospitalInvite.findUnique({
      where: { id: inviteId },
      include: { hospital: true },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    // Validate invite status
    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException(
        'Invite has already been used or cancelled',
      );
    }

    // Validate email matches invite
    if (invite.doctorEmail.toLowerCase() !== email.toLowerCase()) {
      throw new BadRequestException('Email does not match the invite');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user and doctor profile in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: UserRole.DOCTOR,
          isActive: true,
        },
      });

      const doctor = await tx.doctor.create({
        data: {
          userId: user.id,
          hospitalId: invite.hospitalId,
          name,
          phone,
          registrationNo,
          specialization: specialization || null,
        },
      });

      // Update invite status
      await tx.hospitalInvite.update({
        where: { id: inviteId },
        data: {
          status: InviteStatus.ACCEPTED,
          doctorId: doctor.id,
          acceptedAt: new Date(),
        },
      });

      return user;
    });

    // Generate JWT token
    const payload: JwtPayload = {
      sub: result.id,
      role: result.role,
      email: result.email,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: result.id,
        email: result.email,
        role: result.role,
      },
    };
  }
}
