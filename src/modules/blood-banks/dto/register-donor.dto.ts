import type { BloodGroup } from "@prisma/client";
import {
	IsBoolean,
	IsEmail,
	IsNumber,
	IsOptional,
	IsPhoneNumber,
	IsString,
} from "class-validator";

export class RegisterDonorDto {
	@IsString()
	name: string;

	@IsEmail()
	@IsOptional()
	email?: string;

	@IsPhoneNumber()
	phone: string;

	@IsString()
	bloodGroup: BloodGroup;

	@IsString()
	address: string;

	@IsString()
	city: string;

	@IsString()
	state: string;

	@IsString()
	pincode: string;

	@IsNumber()
	latitude: number;

	@IsNumber()
	longitude: number;

	@IsBoolean()
	@IsOptional()
	isAvailable?: boolean;
}
