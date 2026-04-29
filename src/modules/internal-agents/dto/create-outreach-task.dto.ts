import { IsString, IsEnum, IsNumber, IsUUID, Min } from 'class-validator';

export class CreateOutreachTaskDto {
  @IsUUID()
  requestId: string;

  @IsString()
  bloodGroup: string;

  @IsEnum(['ROUTINE', 'URGENT', 'CRITICAL'])
  urgency: 'ROUTINE' | 'URGENT' | 'CRITICAL';

  @IsString()
  region: string;

  @IsString()
  town: string;

  @IsNumber()
  @Min(1)
  unitsNeeded: number;

  @IsNumber()
  @Min(1)
  searchRadiusKm: number;

  @IsNumber()
  @Min(1)
  timeoutMinutes: number;
}
