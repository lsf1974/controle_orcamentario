import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    prisma = app.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: '@e2e.test' } } });
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should register and return tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ name: 'E2E User', email: 'e2e@e2e.test', password: 'Pass@1234' })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.email).toBe('e2e@e2e.test');
    });

    it('should return 409 for duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ name: 'E2E User 2', email: 'e2e@e2e.test', password: 'Pass@1234' })
        .expect(409);
    });

    it('should return 400 for weak password', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ name: 'Test', email: 'weak@e2e.test', password: '123' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'e2e@e2e.test', password: 'Pass@1234' })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
    });

    it('should return 401 for wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'e2e@e2e.test', password: 'Wrong@123' })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout with valid token', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'e2e@e2e.test', password: 'Pass@1234' });

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(204);
    });
  });
});
