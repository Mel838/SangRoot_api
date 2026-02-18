import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { PrismaService } from "../../../prisma/prisma.service";

export interface JwtPayload {
	sub: string; // userId
	role: string;
	email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(
		private configService: ConfigService,
		private prisma: PrismaService,
	) {
		const secretOrKey = configService.get<string>("JWT_SECRET");
		if (!secretOrKey) {
			throw new Error("JWT_SECRET is not defined in environment");
		}
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey,
		});
	}

	async validate(payload: JwtPayload) {
		const user = await this.prisma.user.findUnique({
			where: { id: payload.sub },
			select: {
				id: true,
				email: true,
				role: true,
				isActive: true,
			},
		});

		if (!user || !user.isActive) {
			throw new UnauthorizedException("User not found or inactive");
		}

		return {
			userId: user.id,
			email: user.email,
			role: user.role,
		};
	}
}
