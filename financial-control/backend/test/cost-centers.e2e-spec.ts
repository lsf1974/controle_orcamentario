import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createUserAndLogin } from './helpers/e2e-setup';

describe('CostCenters E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let gestorToken: string;
  let gestorId: string;
  let projectId: string;
  const run = Date.now();

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    // Espelha o main.ts de produção (forbidNonWhitelisted) — se um payload
    // trouxer propriedade fora do DTO, o teste falha igual ao app real.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    ({ token: adminToken } = await createUserAndLogin(
      app,
      `admin-${run}@costc.e2e.test`,
      { admin: true },
    ));
    ({ token: gestorToken, userId: gestorId } = await createUserAndLogin(
      app,
      `gestor-${run}@costc.e2e.test`,
    ));

    const project = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Projeto CostC E2E ${run}`, startDate: '2026-01-01' })
      .expect(201);
    projectId = project.body.id;

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/users`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: gestorId, role: 'GESTOR' })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  let costCenterId: string;

  it('gestor creates a cost center', async () => {
    const res = await request(app.getHttpServer())
      .post(`/projects/${projectId}/cost-centers`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ code: 'ADM', name: 'Administrativo' })
      .expect(201);
    costCenterId = res.body.id;
  });

  it('rejects duplicate code in the same project (409)', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/cost-centers`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ code: 'ADM', name: 'Outro' })
      .expect(409);
  });

  it('gestor updates and soft-deletes the cost center', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/cost-centers/${costCenterId}`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ name: 'Administrativo e Financeiro' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/projects/${projectId}/cost-centers/${costCenterId}`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .expect(204);

    const list = await request(app.getHttpServer())
      .get(`/projects/${projectId}/cost-centers`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .expect(200);
    expect(list.body.some((c: { id: string }) => c.id === costCenterId)).toBe(false);
  });
});
