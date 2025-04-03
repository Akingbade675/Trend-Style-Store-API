import { registerAs } from '@nestjs/config';
import { JwtModuleAsyncOptions } from '@nestjs/jwt';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  signOptions: { expiresIn: process.env.JWT_EXPIRES_IN },
  expiresInMs: parseInt(process.env.JWT_EXPIRY_MS),
  expirationTime: parseInt(process.env.JWT_EXPIRATION_TIME),
}));
