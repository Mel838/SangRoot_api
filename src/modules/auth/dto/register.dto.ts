import { UserRole } from "@prisma/client";
import { IsEmail, IsIn, IsString, MinLength } from "class-validator";

const REGISTERABLE_ROLES = [UserRole.HOSPITAL, UserRole.BLOOD_BANK] as const;

export class RegisterDto {
	@IsEmail()
	email: string;

	@IsString()
	@MinLength(8, { message: "Password must be at least 8 characters long" })
	password: string;

	@IsIn(REGISTERABLE_ROLES, {
		message: "Role must be either HOSPITAL or BLOOD_BANK",
	})
	role: (typeof REGISTERABLE_ROLES)[number];
}
