import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * AgentKeyGuard
 *
 * Protects internal agent endpoints by checking the `x-agent-key` header.
 * Only the VoltAgent tool calls (which set AGENT_API_KEY in the header)
 * can access these endpoints — no JWT required.
 */
@Injectable()
export class AgentKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.headers['x-agent-key'];
    const expectedKey = this.config.get<string>('AGENT_API_KEY');

    if (!expectedKey) {
      throw new UnauthorizedException('Agent API key is not configured');
    }

    if (!providedKey || providedKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing agent API key');
    }

    return true;
  }
}
