import { IsString, IsOptional, IsEnum } from 'class-validator';

export class UpdateBloodBankProfileV2Dto {
  @IsString()
  @IsOptional()
  contactName?: string;

  @IsString()
  @IsOptional()
  languagePreference?: string;

  @IsEnum(['IDLE', 'IN_OUTREACH'])
  @IsOptional()
  conversationState?: 'IDLE' | 'IN_OUTREACH';
}
