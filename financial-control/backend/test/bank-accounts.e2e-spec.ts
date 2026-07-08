import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createUserAndLogin } from './helpers/e2e-setup';

describe('BankAccounts E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let gestorToken: string;
  let gestorId: string;
  let projectId: string;
  let accountId: string;
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
      `admin-${run}@bankacc.e2e.test`,
      { admin: true },
    ));
    ({ token: gestorToken, userId: gestorId } = await createUserAndLogin(
      app,
      `gestor-${run}@bankacc.e2e.test`,
    ));

    const project = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Projeto BankAcc E2E ${run}`, startDate: '2026-01-01' })
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

  it('admin creates a bank account', async () => {
    const res = await request(app.getHttpServer())
      .post('/bank-accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Conta E2E ${run}`,
        bankName: 'Banco Teste',
        accountType: 'CHECKING',
        initialDate: '2026-01-01',
        initialBalance: 1000,
      })
      .expect(201);
    accountId = res.body.id;
  });

  it('non-admin cannot create a bank account', async () => {
    await request(app.getHttpServer())
      .post('/bank-accounts')
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({
        name: 'X',
        bankName: 'Y',
        accountType: 'CHECKING',
        initialDate: '2026-01-01',
      })
      .expect(403);
  });

  it('gestor assigns and unassigns bank account', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/bank-accounts`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ bankAccountId: accountId })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get(`/projects/${projectId}/bank-accounts`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .expect(200);
    expect(list.body.some((a: { id: string }) => a.id === accountId)).toBe(true);

    await request(app.getHttpServer())
      .delete(`/projects/${projectId}/bank-accounts/${accountId}`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .expect(204);
  });

  it('returns 404 when assigning unknown account', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/bank-accounts`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ bankAccountId: 'nao-existe' })
      .expect(404);
  });
});
