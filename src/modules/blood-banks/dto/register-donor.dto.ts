import {
  IsString,
  IsEmail,
  IsPhoneNumber,
  IsNumber,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { BloodGroup } from '@prisma/client';

export class RegisterDonorDto {
  @IsString()
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsPhoneNumber()
  phone: string;

  @IsString()
  bloodGroup: BloodGroup;

  @IsString()
  address: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsString()
  pincode: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}
