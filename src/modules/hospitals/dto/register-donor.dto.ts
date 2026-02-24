import {
  IsString,
  IsEmail,
  IsPhoneNumber,
  IsOptional,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { BloodGroup, Gender, CameroonRegion } from '@prisma/client';

export class RegisterDonorDto {
  @IsString()
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsPhoneNumber()
  phone: string;

  @IsEnum(BloodGroup)
  bloodGroup: BloodGroup;

  @IsDateString()
  dateBirth: string;

  @IsEnum(CameroonRegion)
  region: CameroonRegion;

  @IsString()
  town: string;

  @IsString()
  neighbourhood?: string;

  @IsEnum(Gender)
  genre: Gender;
}
