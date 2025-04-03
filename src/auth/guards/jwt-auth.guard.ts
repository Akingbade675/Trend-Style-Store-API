import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from 'src/common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    // You can throw an exception based on either "info" or "err" arguments
    if (err || !user) {
      // Customize error message based on info (e.g., token expired)
      let message = 'Unauthorized';
      if (info instanceof Error) {
        if (info.name === 'TokenExpiredError') {
          message = 'Access token has expired';
        } else if (info.name === 'JsonWebTokenError') {
          message = 'Invalid access token';
        }
      }
      throw err || new UnauthorizedException(message);
    }
    return user; // Attaches the user object validated by JwtStrategy to request.user
  }
}
