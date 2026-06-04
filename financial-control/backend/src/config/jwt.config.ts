import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const schema = z.object({
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
});

export default registerAs('jwt', () => {
  const parsed = schema.parse(process.env);

  const match = parsed.JWT_REFRESH_EXPIRES_IN.match(/^(\d+)d$/);
  if (!match) {
    throw new Error(
      `JWT_REFRESH_EXPIRES_IN deve estar no formato "Nd" (ex: "7d"). Recebido: "${parsed.JWT_REFRESH_EXPIRES_IN}"`,
    );
  }
  const refreshExpiresInDays = parseInt(match[1], 10);

  return {
    secret: parsed.JWT_SECRET,
    refreshSecret: parsed.JWT_REFRESH_SECRET,
    expiresIn: parsed.JWT_EXPIRES_IN,
    refreshExpiresInDays,
  };
});
