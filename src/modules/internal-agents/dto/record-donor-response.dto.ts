import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { DonorAvailability } from '@prisma/client';

export class RecordDonorResponseDto {
  @IsUUID()
  requestId: string;

  @IsUUID()
  donorId: string;

  @IsEnum(DonorAvailability)
  availability: DonorAvailability;

  @IsOptional()
  @IsString()
  constraint?: string;
}
