import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createUserAndLogin } from './helpers/e2e-setup';

describe('NotificationConfig E2E', () => {
  let app: INestApplication;
  let userToken: string;
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

    ({ token: userToken } = await createUserAndLogin(
      app,
      `user-${run}@notif.e2e.test`,
    ));
  });

  afterAll(async () => {
    await app.close();
  });

  it('starts with no configs', async () => {
    const res = await request(app.getHttpServer())
      .get('/notification-config')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('upserts a config for EMAIL channel', async () => {
    const res = await request(app.getHttpServer())
      .put('/notification-config/EMAIL')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ alertDueToday: false, alertDueTodayTime: '09:30' })
      .expect(200);
    expect(res.body.channel).toBe('EMAIL');
    expect(res.body.alertDueTodayTime).toBe('09:30');
  });

  it('upsert is idempotent per channel (still one EMAIL config)', async () => {
    await request(app.getHttpServer())
      .put('/notification-config/EMAIL')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ alertOverdue: false })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/notification-config')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    const emailConfigs = res.body.filter(
      (c: { channel: string }) => c.channel === 'EMAIL',
    );
    expect(emailConfigs).toHaveLength(1);
  });

  it('rejects an invalid channel (400)', async () => {
    await request(app.getHttpServer())
      .put('/notification-config/SMS')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ alertDueToday: true })
      .expect(400);
  });

  it('rejects an invalid time format (400)', async () => {
    await request(app.getHttpServer())
      .put('/notification-config/TELEGRAM')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ alertDueTodayTime: '25:99' })
      .expect(400);
  });
});
