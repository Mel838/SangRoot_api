import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { RequestStatus } from '@prisma/client';

export class FinalReportDto {
  @IsUUID()
  requestId: string;

  @IsEnum(RequestStatus)
  status: RequestStatus;

  @IsString()
  reportMarkdown: string;

  @IsInt()
  @Min(0)
  willingDonorCount: number;

  @IsInt()
  @Min(0)
  donorsContacted: number;

  @IsOptional()
  @IsDateString()
  aiProcessedAt?: string;
}
