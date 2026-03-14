import { IsEmail } from 'class-validator';

export class InviteDoctorDto {
  @IsEmail()
  doctorEmail: string;
}
