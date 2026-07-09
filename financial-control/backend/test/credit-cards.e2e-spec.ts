import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createUserAndLogin } from './helpers/e2e-setup';

describe('CreditCards E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;
  let cardId: string;
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
      `admin-${run}@cards.e2e.test`,
      { admin: true },
    ));
    ({ token: userToken } = await createUserAndLogin(
      app,
      `user-${run}@cards.e2e.test`,
    ));
  });

  afterAll(async () => {
    await app.close();
  });

  it('admin creates a credit card', async () => {
    const res = await request(app.getHttpServer())
      .post('/credit-cards')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Cartão E2E ${run}`,
        brand: 'VISA',
        lastFourDigits: '4321',
        creditLimit: 5000,
        billingDay: 10,
        closingDay: 3,
      })
      .expect(201);
    cardId = res.body.id;
  });

  it('returns 404 for unknown paymentAccountId', async () => {
    await request(app.getHttpServer())
      .post('/credit-cards')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Cartão X',
        brand: 'VISA',
        lastFourDigits: '1111',
        creditLimit: 1000,
        billingDay: 5,
        closingDay: 1,
        paymentAccountId: 'nao-existe',
      })
      .expect(404);
  });

  it('returns 400 for invalid lastFourDigits', async () => {
    await request(app.getHttpServer())
      .post('/credit-cards')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Cartão Y',
        brand: 'VISA',
        lastFourDigits: '12a4',
        creditLimit: 1000,
        billingDay: 5,
        closingDay: 1,
      })
      .expect(400);
  });

  it('non-admin can list but cannot update', async () => {
    const list = await request(app.getHttpServer())
      .get('/credit-cards')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(list.body.some((c: { id: string }) => c.id === cardId)).toBe(true);

    await request(app.getHttpServer())
      .patch(`/credit-cards/${cardId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Hackeado' })
      .expect(403);
  });
});
