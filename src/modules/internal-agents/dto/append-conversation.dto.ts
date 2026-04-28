import { IsString, IsEnum, IsUUID, IsOptional } from 'class-validator';

export class AppendConversationDto {
  @IsUUID()
  @IsOptional()
  donorId?: string;

  @IsUUID()
  @IsOptional()
  bankId?: string;

  @IsEnum(['agent', 'user', 'system'])
  role: 'agent' | 'user' | 'system';

  @IsString()
  message: string;

  @IsUUID()
  @IsOptional()
  requestId?: string;
}
