import { registerAs } from '@nestjs/config';

export default registerAs('password', () => ({
  secret: process.env.PASSWORD_SECRET,
  memoryCost: parseInt(process.env.PASSWORD_MEMORY_COST, 10) || 65536,
  timeCost: parseInt(process.env.PASSWORD_TIME_COST, 10) || 4,
  parallelism: parseInt(process.env.PASSWORD_PARALLELISM, 10) || 1,
}));
