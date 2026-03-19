import { IsString, IsOptional, IsIn } from 'class-validator';
import { UserRole } from '@prisma/client';

const REGISTERABLE_ROLES = [UserRole.HOSPITAL, UserRole.BLOOD_BANK] as const;

export class GoogleAuthDto {
  @IsString()
  idToken: string;

  @IsOptional()
  @IsIn(REGISTERABLE_ROLES, {
    message: 'Role must be either HOSPITAL or BLOOD_BANK',
  })
  role?: (typeof REGISTERABLE_ROLES)[number];
}
