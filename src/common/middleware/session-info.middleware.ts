import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SessionInfoMiddleware implements NestMiddleware {
  constructor() {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Extend the Request type
    req['sessionInfo'] = {
      userAgent: req.headers['user-agent'],
      ipAddress: this.getClientIp(req),
      timestamp: new Date(),
    };
    next();
  }

  private getClientIp(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      return Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0];
    }
    return req.socket.remoteAddress || 'unknown';
  }
}
