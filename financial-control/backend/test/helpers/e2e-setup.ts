import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SystemRole } from '@prisma/client';

export const E2E_PASSWORD = 'Pass@1234';

/**
 * Registra um usuário via API e retorna token + userId.
 * Com { admin: true }, promove a ADMIN direto no banco antes do login.
 * Use e-mails únicos por execução (sufixo Date.now()) — soft delete
 * mantém e-mails antigos ocupando a constraint única entre execuções.
 */
export async function createUserAndLogin(
  app: INestApplication,
  email: string,
  opts: { admin?: boolean } = {},
): Promise<{ token: string; userId: string }> {
  await request(app.getHttpServer())
    .post('/auth/register')
    .send({ name: 'E2E User', email, password: E2E_PASSWORD })
    .expect(201);

  if (opts.admin) {
    const prisma = app.get(PrismaService);
    await prisma.user.update({
      where: { email },
      data: { systemRole: SystemRole.ADMIN },
    });
  }

  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: E2E_PASSWORD })
    .expect(200);

  return { token: res.body.accessToken, userId: res.body.user.id };
}
