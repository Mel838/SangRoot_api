import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { CameroonRegion } from '@prisma/client';

export class UpdateBloodBankProfileDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEnum(CameroonRegion)
  @IsOptional()
  region?: CameroonRegion;

  @IsString()
  @IsOptional()
  town?: string;

  @IsString()
  @IsOptional()
  neighbourhood?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  licenseNumber?: string;
}
