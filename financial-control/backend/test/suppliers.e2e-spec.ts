import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createUserAndLogin } from './helpers/e2e-setup';

describe('Suppliers E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;
  const run = Date.now();
  const taxId = `99${run}`.slice(0, 14);

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
      `admin-${run}@suppliers.e2e.test`,
      { admin: true },
    ));
    ({ token: userToken } = await createUserAndLogin(
      app,
      `user-${run}@suppliers.e2e.test`,
    ));
  });

  afterAll(async () => {
    await app.close();
  });

  let supplierId: string;

  it('admin creates a supplier', async () => {
    const res = await request(app.getHttpServer())
      .post('/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ personType: 'COMPANY', companyName: 'Fornecedor E2E', taxId })
      .expect(201);
    supplierId = res.body.id;
  });

  it('returns 409 for duplicate taxId', async () => {
    await request(app.getHttpServer())
      .post('/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ personType: 'COMPANY', companyName: 'Outro', taxId })
      .expect(409);
  });

  it('non-admin can list but cannot create', async () => {
    const list = await request(app.getHttpServer())
      .get('/suppliers')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(list.body.some((s: { id: string }) => s.id === supplierId)).toBe(true);

    await request(app.getHttpServer())
      .post('/suppliers')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ personType: 'COMPANY', companyName: 'Z', taxId: `88${run}`.slice(0, 14) })
      .expect(403);
  });

  it('admin soft-deletes supplier and it disappears from list', async () => {
    await request(app.getHttpServer())
      .delete(`/suppliers/${supplierId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    const list = await request(app.getHttpServer())
      .get('/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(list.body.some((s: { id: string }) => s.id === supplierId)).toBe(false);
  });
});
