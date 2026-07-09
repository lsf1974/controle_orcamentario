import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createUserAndLogin } from './helpers/e2e-setup';

describe('Clients E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let gestorToken: string;
  let analistaToken: string;
  let gestorId: string;
  let analistaId: string;
  let projectId: string;
  let clientId: string;
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
      `admin-${run}@clients.e2e.test`,
      { admin: true },
    ));
    ({ token: gestorToken, userId: gestorId } = await createUserAndLogin(
      app,
      `gestor-${run}@clients.e2e.test`,
    ));
    ({ token: analistaToken, userId: analistaId } = await createUserAndLogin(
      app,
      `analista-${run}@clients.e2e.test`,
    ));

    const project = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Projeto Clients E2E ${run}`, startDate: '2026-01-01' })
      .expect(201);
    projectId = project.body.id;

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/users`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: gestorId, role: 'GESTOR' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/users`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: analistaId, role: 'ANALISTA' })
      .expect(201);

    const client = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        personType: 'COMPANY',
        companyName: 'Cliente E2E',
        taxId: `77${run}`.slice(0, 14),
      })
      .expect(201);
    clientId = client.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('non-admin cannot create a client', async () => {
    await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({
        personType: 'COMPANY',
        companyName: 'X',
        taxId: `66${run}`.slice(0, 14),
      })
      .expect(403);
  });

  it('gestor assigns client to project', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/clients`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ clientId })
      .expect(201);
  });

  it('returns 409 when assigning twice', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/clients`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ clientId })
      .expect(409);
  });

  it('analista lists project clients but cannot assign', async () => {
    const list = await request(app.getHttpServer())
      .get(`/projects/${projectId}/clients`)
      .set('Authorization', `Bearer ${analistaToken}`)
      .expect(200);
    expect(list.body.some((c: { id: string }) => c.id === clientId)).toBe(true);

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/clients`)
      .set('Authorization', `Bearer ${analistaToken}`)
      .send({ clientId })
      .expect(403);
  });

  it('gestor unassigns client', async () => {
    await request(app.getHttpServer())
      .delete(`/projects/${projectId}/clients/${clientId}`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .expect(204);
  });
});
