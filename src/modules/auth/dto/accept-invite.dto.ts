import { IsEmail, IsString, IsUUID, MinLength } from "class-validator";

export class AcceptInviteDto {
	@IsUUID()
	inviteId: string;

	@IsEmail()
	email: string;

	@IsString()
	@MinLength(8, { message: "Password must be at least 8 characters long" })
	password: string;

	@IsString()
	name: string;

	@IsString()
	phone: string;

	@IsString()
	registrationNo: string;

	@IsString()
	specialization?: string;
}
