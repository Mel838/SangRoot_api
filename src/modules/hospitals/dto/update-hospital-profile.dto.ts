import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  MinLength,
} from 'class-validator';
import { CameroonRegion } from '@prisma/client';

export class UpdateHospitalProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(CameroonRegion)
  region?: CameroonRegion;

  @IsOptional()
  @IsString()
  town?: string;

  @IsOptional()
  @IsString()
  neighbourhood?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  licenseNumber?: string;
}
