import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, InviteStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
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

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, role } = registerDto;

    // Validate role
    if (role !== UserRole.HOSPITAL && role !== UserRole.BLOOD_BANK) {
      throw new BadRequestException('Role must be either HOSPITAL or BLOOD_BANK');
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

  async acceptInvite(acceptInviteDto: AcceptInviteDto): Promise<AuthResponseDto> {
    const { inviteId, email, password, name, phone, registrationNo, specialization } = acceptInviteDto;

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
      throw new BadRequestException('Invite has already been used or cancelled');
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
