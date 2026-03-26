import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT authentication guard.
 * Apply to controllers or individual routes with @UseGuards(JwtAuthGuard).
 *
 * The guard extracts the Bearer token from the Authorization header,
 * validates it using JwtStrategy, and attaches the user to request.user.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
