import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createUserAndLogin } from './helpers/e2e-setup';

describe('AccountCategories E2E', () => {
  let app: INestApplication;
  let adminToken: string;
  let gestorToken: string;
  let analistaToken: string;
  let gestorId: string;
  let analistaId: string;
  let projectId: string;
  let packageId: string;
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
      `admin-${run}@accc.e2e.test`,
      { admin: true },
    ));
    ({ token: gestorToken, userId: gestorId } = await createUserAndLogin(
      app,
      `gestor-${run}@accc.e2e.test`,
    ));
    ({ token: analistaToken, userId: analistaId } = await createUserAndLogin(
      app,
      `analista-${run}@accc.e2e.test`,
    ));

    const project = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Projeto AccC E2E ${run}`, startDate: '2026-01-01' })
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('gestor creates a PACKAGE', async () => {
    const res = await request(app.getHttpServer())
      .post(`/projects/${projectId}/account-categories`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ code: '1', name: 'Receitas', type: 'REVENUE', level: 'PACKAGE' })
      .expect(201);
    packageId = res.body.id;
  });

  it('gestor creates a CATEGORY under the package', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/account-categories`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({
        code: '1.1',
        name: 'Vendas',
        type: 'REVENUE',
        level: 'CATEGORY',
        parentId: packageId,
      })
      .expect(201);
  });

  it('rejects a CATEGORY without parent (400)', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/account-categories`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ code: '2.1', name: 'Sem pai', type: 'REVENUE', level: 'CATEGORY' })
      .expect(400);
  });

  it('rejects duplicate code (409)', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/account-categories`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ code: '1', name: 'Duplicado', type: 'EXPENSE', level: 'PACKAGE' })
      .expect(409);
  });

  it('analista can list but cannot create (403)', async () => {
    await request(app.getHttpServer())
      .get(`/projects/${projectId}/account-categories`)
      .set('Authorization', `Bearer ${analistaToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/account-categories`)
      .set('Authorization', `Bearer ${analistaToken}`)
      .send({ code: '3', name: 'X', type: 'EXPENSE', level: 'PACKAGE' })
      .expect(403);
  });

  it('blocks deleting a package that has children (409)', async () => {
    await request(app.getHttpServer())
      .delete(`/projects/${projectId}/account-categories/${packageId}`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .expect(409);
  });
});
