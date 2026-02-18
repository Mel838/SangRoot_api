import { IsNumber, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateBloodBankProfileDto {
	@IsOptional()
	@IsString()
	@MinLength(1)
	name?: string;

	@IsOptional()
	@IsString()
	address?: string;

	@IsOptional()
	@IsString()
	city?: string;

	@IsOptional()
	@IsString()
	state?: string;

	@IsOptional()
	@IsString()
	pincode?: string;

	@IsOptional()
	@IsString()
	phone?: string;

	@IsOptional()
	@IsNumber()
	latitude?: number;

	@IsOptional()
	@IsNumber()
	longitude?: number;

	@IsOptional()
	@IsString()
	licenseNumber?: string;
}
