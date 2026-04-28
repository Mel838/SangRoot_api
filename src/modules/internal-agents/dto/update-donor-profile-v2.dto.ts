import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
} from 'class-validator';

export class UpdateDonorProfileV2Dto {
  @IsString()
  @IsOptional()
  preferredName?: string;

  @IsString()
  @IsOptional()
  languagePreference?: string;

  @IsEnum(['ONBOARDING', 'IDLE', 'IN_OUTREACH', 'OPTED_OUT'])
  @IsOptional()
  conversationState?: 'ONBOARDING' | 'IDLE' | 'IN_OUTREACH' | 'OPTED_OUT';

  @IsBoolean()
  @IsOptional()
  onboardingComplete?: boolean;

  @IsDateString()
  @IsOptional()
  lastDonationDate?: string;

  @IsString()
  @IsOptional()
  healthNotes?: string;

  @IsString()
  @IsOptional()
  availabilityNotes?: string;
}
