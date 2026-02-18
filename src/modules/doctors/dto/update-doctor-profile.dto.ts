import { IsOptional, IsString } from "class-validator";

export class UpdateDoctorProfileDto {
	@IsOptional()
	@IsString()
	name?: string;

	@IsOptional()
	@IsString()
	phone?: string;

	@IsOptional()
	@IsString()
	specialization?: string;

	@IsOptional()
	@IsString()
	registrationNo?: string;
}
