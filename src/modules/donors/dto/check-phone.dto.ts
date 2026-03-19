import { IsString, IsPhoneNumber, Matches } from 'class-validator';

export class CheckPhoneDto {
  @IsString()
  @IsPhoneNumber('CM', { message: 'Please provide a valid phone number' })
  @Matches(/^[0-9+\-\s]+$/, {
    message: 'Phone number contains invalid characters',
  })
  phone: string;
}
