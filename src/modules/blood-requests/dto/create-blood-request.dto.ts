import {
  IsString,
  IsInt,
  IsEnum,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';
import {
  BloodGroup,
  RequestUrgency,
  Gender,
  CameroonRegion,
} from '@prisma/client';

export class CreateBloodRequestDto {
  @IsEnum(BloodGroup)
  bloodGroup: BloodGroup;

  @IsInt()
  @Min(1)
  unitsRequired: number;

  @IsEnum(RequestUrgency)
  urgency: RequestUrgency;

  // ── Patient info ──────────────────────────────────────────────────────
  @IsString()
  patientName: string;

  @IsInt()
  @Min(0)
  patientAge: number;

  @IsEnum(Gender)
  patientGender: Gender;

  // ── Location (hospital) ───────────────────────────────────────────────
  @IsString()
  hospitalName: string;

  @IsEnum(CameroonRegion)
  region: CameroonRegion;

  @IsString()
  town: string;

  @IsString()
  @IsOptional()
  neighbourhood?: string;

  // ── Timing & medical ──────────────────────────────────────────────────
  @IsDateString()
  requiredBy: string;

  @IsString()
  @IsOptional()
  medicalReason?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
