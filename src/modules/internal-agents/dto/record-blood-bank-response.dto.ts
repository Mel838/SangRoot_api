import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class RecordBloodBankResponseDto {
  @IsUUID()
  requestId: string;

  @IsUUID()
  bloodBankId: string;

  @IsBoolean()
  available: boolean;

  @IsInt()
  @Min(0)
  unitsAvailable: number;

  @IsInt()
  @Min(0)
  preparationTimeMinutes: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
