import { IsEmail, IsString } from 'class-validator';

export class InviteDoctorDto {
  @IsEmail()
  doctorEmail: string;
}
