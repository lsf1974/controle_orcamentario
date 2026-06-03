# Fase 1 — Fundação e Autenticação: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ambiente Docker rodando com NestJS + Next.js + PostgreSQL + Redis, autenticação JWT completa e controle de acesso por perfil (Admin/Gestor/Analista) — sistema de login e gestão de projetos funcional com testes passando.

**Architecture:** Monorepo com três serviços — backend NestJS (porta 3001), frontend Next.js (porta 3000) e telegram-bot standalone — orquestrados via Docker Compose. O backend expõe REST + WebSocket; autenticação por JWT com access token (15min) + refresh token (7 dias) armazenados em Redis. Controle de acesso em dois níveis: SystemRole global e ProjectRole por projeto.

**Tech Stack:** Node.js 24 + TypeScript, NestJS 10, Prisma 5 + PostgreSQL 16, Redis 7, Next.js 14 App Router, shadcn/ui + Tailwind CSS, Jest + Supertest, Docker Compose.

---

## Arquitetura Completa

```
financial-control/
├── docker-compose.yml            # produção local
├── docker-compose.dev.yml        # dev com hot-reload
├── .env.example
├── .env                          # gerado a partir do example
│
├── backend/
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── config/
│   │   │   ├── app.config.ts
│   │   │   ├── database.config.ts
│   │   │   └── jwt.config.ts
│   │   ├── common/
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   ├── roles.guard.ts
│   │   │   │   └── project-access.guard.ts
│   │   │   ├── decorators/
│   │   │   │   ├── requires-role.decorator.ts
│   │   │   │   ├── requires-project-role.decorator.ts
│   │   │   │   └── current-user.decorator.ts
│   │   │   └── interceptors/
│   │   │       └── audit.interceptor.ts
│   │   └── modules/
│   │       ├── auth/
│   │       │   ├── auth.module.ts
│   │       │   ├── auth.controller.ts
│   │       │   ├── auth.service.ts
│   │       │   ├── strategies/
│   │       │   │   ├── jwt.strategy.ts
│   │       │   │   └── jwt-refresh.strategy.ts
│   │       │   └── dto/
│   │       │       ├── register.dto.ts
│   │       │       ├── login.dto.ts
│   │       │       └── refresh-token.dto.ts
│   │       ├── users/
│   │       │   ├── users.module.ts
│   │       │   ├── users.controller.ts
│   │       │   ├── users.service.ts
│   │       │   └── dto/
│   │       │       ├── create-user.dto.ts
│   │       │       └── update-user.dto.ts
│   │       └── projects/
│   │           ├── projects.module.ts
│   │           ├── projects.controller.ts
│   │           ├── projects.service.ts
│   │           └── dto/
│   │               ├── create-project.dto.ts
│   │               ├── update-project.dto.ts
│   │               └── assign-user.dto.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── migrations/
│   ├── test/
│   │   ├── auth.e2e-spec.ts
│   │   ├── users.e2e-spec.ts
│   │   └── projects.e2e-spec.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── recuperar-senha/page.tsx
│   │   │   └── (app)/
│   │   │       └── dashboard/page.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── sidebar.tsx
│   │   │   │   └── header.tsx
│   │   │   └── ui/                # shadcn/ui (gerado pelo CLI)
│   │   ├── hooks/
│   │   │   └── usePermissions.ts
│   │   ├── lib/
│   │   │   ├── api.ts             # axios instance com interceptors
│   │   │   └── auth.ts            # funções de login/logout/refresh
│   │   └── types/
│   │       └── index.ts
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── Dockerfile
│
└── telegram-bot/
    ├── src/
    │   └── main.ts                # stub — só inicializa conexão
    ├── package.json
    └── Dockerfile
```

---

## Task 1: Estrutura de Pastas e Docker Compose

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.dev.yml`
- Create: `.env.example`
- Create: `.env`

- [ ] **Step 1.1: Criar estrutura de pastas raiz**

```powershell
Set-Location "C:\Users\LeandroFerreiraLFTec\claude\pcontroleorc"
New-Item -ItemType Directory -Force -Path "financial-control"
Set-Location financial-control
New-Item -ItemType Directory -Force -Path "backend/src/common/guards"
New-Item -ItemType Directory -Force -Path "backend/src/common/decorators"
New-Item -ItemType Directory -Force -Path "backend/src/common/interceptors"
New-Item -ItemType Directory -Force -Path "backend/src/config"
New-Item -ItemType Directory -Force -Path "backend/src/modules/auth/strategies"
New-Item -ItemType Directory -Force -Path "backend/src/modules/auth/dto"
New-Item -ItemType Directory -Force -Path "backend/src/modules/users/dto"
New-Item -ItemType Directory -Force -Path "backend/src/modules/projects/dto"
New-Item -ItemType Directory -Force -Path "backend/prisma"
New-Item -ItemType Directory -Force -Path "backend/test"
New-Item -ItemType Directory -Force -Path "frontend/src/app/(auth)/login"
New-Item -ItemType Directory -Force -Path "frontend/src/app/(auth)/recuperar-senha"
New-Item -ItemType Directory -Force -Path "frontend/src/app/(app)/dashboard"
New-Item -ItemType Directory -Force -Path "frontend/src/components/layout"
New-Item -ItemType Directory -Force -Path "frontend/src/components/ui"
New-Item -ItemType Directory -Force -Path "frontend/src/hooks"
New-Item -ItemType Directory -Force -Path "frontend/src/lib"
New-Item -ItemType Directory -Force -Path "frontend/src/types"
New-Item -ItemType Directory -Force -Path "telegram-bot/src"
```

- [ ] **Step 1.2: Criar `.env.example`**

```env
# ── Banco de Dados ──────────────────────────────────
DATABASE_URL="postgresql://user:password@postgres:5432/financial_control"

# ── Redis ───────────────────────────────────────────
REDIS_URL="redis://redis:6379"

# ── JWT ─────────────────────────────────────────────
JWT_SECRET="troque-por-uma-string-aleatoria-longa-32chars"
JWT_REFRESH_SECRET="troque-por-outra-string-aleatoria-32chars"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# ── E-mail ──────────────────────────────────────────
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="seu-email@gmail.com"
SMTP_PASS="sua-senha-de-app-google"
SMTP_FROM="Sistema Financeiro <seu-email@gmail.com>"

# ── Telegram Bot ────────────────────────────────────
TELEGRAM_BOT_TOKEN="token-gerado-no-botfather"

# ── Upload de arquivos ──────────────────────────────
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE_MB=10

# ── Frontend ─────────────────────────────────────────
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_WS_URL="ws://localhost:3001"

# ── Ambiente ─────────────────────────────────────────
NODE_ENV="development"
PORT=3001
FRONTEND_URL="http://localhost:3000"
```

- [ ] **Step 1.3: Criar `.env` a partir do exemplo**

```powershell
Copy-Item .env.example .env
# Editar .env com valores reais para desenvolvimento local:
# JWT_SECRET="dev-secret-financial-control-2026-xxxxx"
# JWT_REFRESH_SECRET="dev-refresh-secret-financial-ctrl-2026"
```

- [ ] **Step 1.4: Criar `docker-compose.yml`**

```yaml
# docker-compose.yml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: fc_postgres
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: financial_control
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d financial_control"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: fc_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: fc_backend
    env_file: .env
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./backend/uploads:/app/uploads

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: fc_frontend
    env_file: .env
    ports:
      - "3000:3000"
    depends_on:
      - backend

  telegram-bot:
    build:
      context: ./telegram-bot
      dockerfile: Dockerfile
    container_name: fc_telegram_bot
    env_file: .env
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:
```

- [ ] **Step 1.5: Criar `docker-compose.dev.yml`**

```yaml
# docker-compose.dev.yml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: fc_postgres_dev
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: financial_control_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d financial_control_dev"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: fc_redis_dev
    ports:
      - "6379:6379"
    volumes:
      - redis_dev_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  postgres_dev_data:
  redis_dev_data:
```

- [ ] **Step 1.6: Subir serviços de infraestrutura para dev**

```powershell
docker compose -f docker-compose.dev.yml up -d
```

Saída esperada: containers `fc_postgres_dev` e `fc_redis_dev` com status `healthy`.

```powershell
docker ps
# deve mostrar os dois containers rodando
```

---

## Task 2: Backend — Bootstrap NestJS

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/tsconfig.build.json`
- Create: `backend/nest-cli.json`
- Create: `backend/Dockerfile`

- [ ] **Step 2.1: Inicializar projeto NestJS**

```powershell
Set-Location backend
npx @nestjs/cli new . --package-manager npm --skip-git --language typescript
# Quando perguntar se deseja sobrescrever, responder: y
```

- [ ] **Step 2.2: Instalar dependências**

```powershell
npm install @nestjs/jwt @nestjs/passport passport passport-jwt passport-local
npm install @nestjs/config @nestjs/swagger
npm install @prisma/client redis ioredis
npm install bcrypt class-validator class-transformer
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
npm install --save-dev prisma @types/passport-jwt @types/bcrypt @types/passport-local supertest @types/supertest
```

- [ ] **Step 2.3: Criar `backend/Dockerfile`**

```dockerfile
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:24-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
EXPOSE 3001
CMD ["node", "dist/main"]
```

- [ ] **Step 2.4: Criar `backend/src/config/app.config.ts`**

```typescript
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().default(10),
});

export default registerAs('app', () => {
  const parsed = schema.parse(process.env);
  return parsed;
});
```

> Nota: instalar zod: `npm install zod`

- [ ] **Step 2.5: Criar `backend/src/config/jwt.config.ts`**

```typescript
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

  // Converte '7d' → 7, '30d' → 30. Valida formato no startup para falha ruidosa.
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
    refreshExpiresInDays, // número de dias — único campo de expiração do refresh consumido pelo AuthService
  };
});
```

- [ ] **Step 2.6: Atualizar `backend/src/main.ts`**

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: config.get('app.FRONTEND_URL') ?? 'http://localhost:3000',
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Financial Control API')
    .setDescription('Sistema de Controle Financeiro Multi-usuário')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('app.PORT') ?? 3001;
  await app.listen(port);
  console.log(`Backend rodando em http://localhost:${port}`);
  console.log(`Swagger em http://localhost:${port}/api/docs`);
}
bootstrap();
```

- [ ] **Step 2.7: Atualizar `backend/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProjectsModule } from './modules/projects/projects.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, jwtConfig],
      envFilePath: '.env',
    }),
    AuthModule,
    UsersModule,
    ProjectsModule,
  ],
})
export class AppModule {}
```

---

## Task 3: Schema Prisma Completo

**Files:**
- Create: `backend/prisma/schema.prisma`
- Create: `backend/prisma/seed.ts`

- [ ] **Step 3.1: Criar `backend/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── ENUMS ───────────────────────────────────────────────────────────────────

enum SystemRole {
  ADMIN
  USER
}

enum ProjectRole {
  GESTOR
  ANALISTA
}

enum ProjectStatus {
  ACTIVE
  SUSPENDED
  CLOSED
}

enum PersonType {
  INDIVIDUAL
  COMPANY
}

enum CategoryType {
  REVENUE
  EXPENSE
}

enum CategoryLevel {
  PACKAGE
  CATEGORY
  SUBCATEGORY
}

enum BankAccountType {
  CHECKING
  SAVINGS
  INVESTMENT
  PETTY_CASH
}

enum CardBrand {
  VISA
  MASTERCARD
  ELO
  AMEX
  HIPERCARD
  OTHER
}

enum BudgetStatus {
  DRAFT
  SUBMITTED
  ACTIVE
  CLOSED
}

enum DistributionType {
  SINGLE
  EQUAL
  MANUAL
  RECURRING
}

enum TransactionType {
  EXPENSE
  REVENUE
}

enum TransactionStatus {
  PLANNED
  PAID
  RECEIVED
  CANCELLED
  OVERDUE
  PENDING_APPROVAL
}

enum TransactionSource {
  WEB
  TELEGRAM
  WHATSAPP
  IMPORT
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}

enum StatementFormat {
  OFX
  CSV
  CNAB240
  API
}

enum ReconciliationStatus {
  PENDING
  AUTO_MATCHED
  SUGGESTED
  MANUALLY_MATCHED
  IGNORED
}

enum NotificationChannel {
  TELEGRAM
  WHATSAPP
  EMAIL
}

// ─── USUÁRIOS E ACESSO ───────────────────────────────────────────────────────

model User {
  id               String    @id @default(cuid())
  name             String
  email            String    @unique
  passwordHash     String
  systemRole       SystemRole @default(USER)
  telegramId       String?   @unique
  telegramUsername String?
  whatsappPhone    String?
  twoFactorSecret  String?
  twoFactorEnabled Boolean   @default(false)
  isActive         Boolean   @default(true)
  lastLoginAt      DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  deletedAt        DateTime?

  projectUsers    ProjectUser[]
  transactions    Transaction[]
  notifications   NotificationConfig[]
  auditLogs       AuditLog[]
  linkingTokens   TelegramLinkToken[]
  refreshTokens   RefreshToken[]
  passwordResets  PasswordResetToken[]
}

model RefreshToken {
  id         String    @id @default(cuid())
  userId     String
  token      String    @unique
  expiresAt  DateTime
  revokedAt  DateTime?
  deviceInfo String?
  createdAt  DateTime  @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
}

model PasswordResetToken {
  id        String    @id @default(cuid())
  userId    String
  token     String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  // Regra de negócio (enforçada no service, não no schema):
  // ao gerar novo token, invalidar todos os tokens anteriores do mesmo userId
  // via: prisma.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } })
}

model TelegramLinkToken {
  id        String    @id @default(cuid())
  userId    String
  token     String    @unique
  expiresAt DateTime
  usedAt    DateTime?

  user User @relation(fields: [userId], references: [id])
}

// ─── PROJETOS ────────────────────────────────────────────────────────────────

model Project {
  id          String        @id @default(cuid())
  name        String
  description String?
  startDate   DateTime
  endDate     DateTime?
  status      ProjectStatus @default(ACTIVE)
  color       String?
  icon        String?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  deletedAt   DateTime?

  projectUsers    ProjectUser[]
  projectAccounts ProjectBankAccount[]
  projectCards    ProjectCreditCard[]
  budgets         Budget[]
  transactions    Transaction[]
  costCenters     CostCenter[]
  chartOfAccounts AccountCategory[]
  projectClients  ProjectClient[]
}

model ProjectUser {
  id        String      @id @default(cuid())
  projectId String
  userId    String
  role      ProjectRole @default(ANALISTA)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  project Project @relation(fields: [projectId], references: [id])
  user    User    @relation(fields: [userId], references: [id])

  @@unique([projectId, userId])
}

// ─── CLIENTES ────────────────────────────────────────────────────────────────

model Client {
  id                String          @id @default(cuid())
  personType        PersonType
  companyName       String?
  tradeName         String?
  fullName          String?
  taxId             String          @unique
  stateRegistration String?
  email             String?
  emailSecondary    String?
  phone             String?
  mobile            String?
  website           String?
  street            String?
  streetNumber      String?
  complement        String?
  neighborhood      String?
  city              String?
  state             String?
  zipCode           String?
  paymentTermDays   Int?
  creditLimit       Decimal?
  pixKey            String?
  bankName          String?
  bankAgency        String?
  bankAccount       String?
  bankAccountType   BankAccountType?
  responsibleUserId String?
  notes             String?
  isClient          Boolean         @default(true)
  isSupplier        Boolean         @default(false)
  isActive          Boolean         @default(true)
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  deletedAt         DateTime?

  projectClients ProjectClient[]
  transactions   Transaction[]
  budgetLines    BudgetLine[]
}

model ProjectClient {
  id        String   @id @default(cuid())
  projectId String
  clientId  String
  createdAt DateTime @default(now())

  project Project @relation(fields: [projectId], references: [id])
  client  Client  @relation(fields: [clientId], references: [id])

  @@unique([projectId, clientId])
}

// ─── FORNECEDORES ────────────────────────────────────────────────────────────

model Supplier {
  id              String          @id @default(cuid())
  personType      PersonType
  companyName     String?
  tradeName       String?
  fullName        String?
  taxId           String          @unique
  email           String?
  phone           String?
  mobile          String?
  pixKey          String?
  bankName        String?
  bankAgency      String?
  bankAccount     String?
  bankAccountType BankAccountType?
  paymentTermDays Int?
  notes           String?
  isActive        Boolean         @default(true)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  deletedAt       DateTime?

  transactions Transaction[]
  budgetLines  BudgetLine[]
}

// ─── PLANO DE CONTAS ─────────────────────────────────────────────────────────

model AccountCategory {
  id          String        @id @default(cuid())
  projectId   String
  parentId    String?
  code        String
  name        String
  type        CategoryType
  level       CategoryLevel
  description String?
  isActive    Boolean       @default(true)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  deletedAt   DateTime?

  project      Project           @relation(fields: [projectId], references: [id])
  parent       AccountCategory?  @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children     AccountCategory[] @relation("CategoryHierarchy")
  budgetLines  BudgetLine[]
  transactions Transaction[]

  @@unique([projectId, code])
}

// ─── CONTAS BANCÁRIAS E CARTÕES ──────────────────────────────────────────────

model BankAccount {
  id             String          @id @default(cuid())
  name           String
  bankName       String
  bankCode       String?
  agency         String?
  accountNumber  String?
  accountType    BankAccountType
  initialBalance Decimal         @default(0)
  initialDate    DateTime
  openFinanceId  String?
  isActive       Boolean         @default(true)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  deletedAt      DateTime?

  projectAccounts ProjectBankAccount[]
  transactions    Transaction[]
  statements      BankStatement[]
}

model ProjectBankAccount {
  id            String   @id @default(cuid())
  projectId     String
  bankAccountId String
  createdAt     DateTime @default(now())

  project     Project     @relation(fields: [projectId], references: [id])
  bankAccount BankAccount @relation(fields: [bankAccountId], references: [id])

  @@unique([projectId, bankAccountId])
}

model CreditCard {
  id               String    @id @default(cuid())
  name             String
  brand            CardBrand
  lastFourDigits   String
  creditLimit      Decimal
  billingDay       Int
  closingDay       Int
  paymentAccountId String?
  isActive         Boolean   @default(true)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  deletedAt        DateTime?

  projectCards ProjectCreditCard[]
  transactions Transaction[]
}

model ProjectCreditCard {
  id           String   @id @default(cuid())
  projectId    String
  creditCardId String
  createdAt    DateTime @default(now())

  project    Project    @relation(fields: [projectId], references: [id])
  creditCard CreditCard @relation(fields: [creditCardId], references: [id])

  @@unique([projectId, creditCardId])
}

// ─── CENTROS DE CUSTO ────────────────────────────────────────────────────────

model CostCenter {
  id          String    @id @default(cuid())
  projectId   String
  code        String
  name        String
  description String?
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  project      Project       @relation(fields: [projectId], references: [id])
  transactions Transaction[]
  budgetLines  BudgetLine[]

  @@unique([projectId, code])
}

// ─── ORÇAMENTOS ──────────────────────────────────────────────────────────────

model Budget {
  id           String       @id @default(cuid())
  projectId    String
  name         String
  description  String?
  version      Int          @default(1)
  status       BudgetStatus @default(DRAFT)
  startDate    DateTime
  endDate      DateTime
  isActive     Boolean      @default(false)
  approvedBy   String?
  approvedAt   DateTime?
  approvalNote String?
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  project Project      @relation(fields: [projectId], references: [id])
  lines   BudgetLine[]
}

model BudgetLine {
  id               String           @id @default(cuid())
  budgetId         String
  categoryId       String
  costCenterId     String?
  clientId         String?
  supplierId       String?
  totalAmount      Decimal
  distributionType DistributionType
  startDate        DateTime
  endDate          DateTime?
  recurrenceMonths Int?
  notes            String?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  budget        Budget               @relation(fields: [budgetId], references: [id])
  category      AccountCategory      @relation(fields: [categoryId], references: [id])
  costCenter    CostCenter?          @relation(fields: [costCenterId], references: [id])
  client        Client?              @relation(fields: [clientId], references: [id])
  supplier      Supplier?            @relation(fields: [supplierId], references: [id])
  monthlyValues BudgetMonthlyValue[]
}

model BudgetMonthlyValue {
  id           String     @id @default(cuid())
  budgetLineId String
  month        Int
  year         Int
  amount       Decimal
  // sem deletedAt intencional: recriado junto com a BudgetLine pai

  budgetLine BudgetLine @relation(fields: [budgetLineId], references: [id])

  @@unique([budgetLineId, month, year])
}

// ─── LANÇAMENTOS ─────────────────────────────────────────────────────────────

model Transaction {
  id               String            @id @default(cuid())
  projectId        String
  categoryId       String
  costCenterId     String?
  bankAccountId    String?
  creditCardId     String?
  clientId         String?
  supplierId       String?
  createdByUserId  String
  type             TransactionType
  amount           Decimal
  description      String?
  documentNumber   String?
  competenceDate   DateTime
  dueDate          DateTime
  paymentDate      DateTime?
  status           TransactionStatus @default(PLANNED)
  approvalStatus   ApprovalStatus    @default(PENDING) // ATENÇÃO Fase 4: service deve setar APPROVED explicitamente para ADMIN e GESTOR
  approvedByUserId String?
  approvalNote     String?
  source           TransactionSource @default(WEB)
  isRecurring      Boolean           @default(false)
  recurringGroupId String?
  reconciledItemId String?
  notes            String?
  tags             String[]
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  deletedAt        DateTime?

  project     Project         @relation(fields: [projectId], references: [id])
  category    AccountCategory @relation(fields: [categoryId], references: [id])
  costCenter  CostCenter?     @relation(fields: [costCenterId], references: [id])
  bankAccount BankAccount?    @relation(fields: [bankAccountId], references: [id])
  creditCard  CreditCard?     @relation(fields: [creditCardId], references: [id])
  client      Client?         @relation(fields: [clientId], references: [id])
  supplier    Supplier?       @relation(fields: [supplierId], references: [id])
  createdBy   User            @relation(fields: [createdByUserId], references: [id])
  attachments TransactionAttachment[]
  splits      TransactionSplit[]
}

model TransactionAttachment {
  id            String      @id @default(cuid())
  transactionId String
  fileName      String
  fileUrl       String
  fileType      String
  fileSize      Int
  uploadedAt    DateTime    @default(now())

  transaction Transaction @relation(fields: [transactionId], references: [id])
}

model TransactionSplit {
  id            String  @id @default(cuid())
  transactionId String
  projectId     String
  costCenterId  String?
  percentage    Decimal
  amount        Decimal
  // sem deletedAt intencional: recriado junto com a Transaction pai

  transaction Transaction @relation(fields: [transactionId], references: [id])
}

// ─── EXTRATOS E CONCILIAÇÃO ──────────────────────────────────────────────────

model BankStatement {
  id              String          @id @default(cuid())
  bankAccountId   String
  importedBy      String
  importDate      DateTime        @default(now())
  startDate       DateTime
  endDate         DateTime
  format          StatementFormat
  totalItems      Int             @default(0)
  reconciledItems Int             @default(0)

  bankAccount BankAccount         @relation(fields: [bankAccountId], references: [id])
  items       BankStatementItem[]
}

model BankStatementItem {
  id                   String               @id @default(cuid())
  statementId          String
  date                 DateTime
  amount               Decimal
  description          String
  type                 String
  externalId           String?
  reconciliationStatus ReconciliationStatus @default(PENDING)
  transactionId        String?
  ignoredReason        String?
  reconciledAt         DateTime?
  reconciledBy         String?

  statement BankStatement @relation(fields: [statementId], references: [id])
}

// ─── NOTIFICAÇÕES ────────────────────────────────────────────────────────────

model NotificationConfig {
  id                    String              @id @default(cuid())
  userId                String
  channel               NotificationChannel
  isActive              Boolean             @default(true)
  alertDueToday         Boolean             @default(true)
  alertDueTodayTime     String              @default("08:00")
  alertDueInDays        Int?
  alertOverdue          Boolean             @default(true)
  alertLowBalance       Boolean             @default(false)
  alertLowBalanceAmount Decimal?
  alertPendingApproval  Boolean             @default(true)
  alertDailySummary     Boolean             @default(false)
  alertDailySummaryTime String              @default("08:00")
  alertWeeklySummary    Boolean             @default(false)
  alertWeeklyDay        Int?
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, channel])
}

// ─── AUDITORIA ───────────────────────────────────────────────────────────────

model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String
  entity    String
  entityId  String
  oldValues Json?
  newValues Json?
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}
```

- [ ] **Step 3.2: Executar migration inicial**

```powershell
# No diretório backend/
$env:DATABASE_URL="postgresql://user:password@localhost:5432/financial_control_dev"
npx prisma migrate dev --name init
```

Saída esperada: `✔ Generated Prisma Client` e `Your database is now in sync with your schema.`

> **Recovery — banco existente com schema antigo:** se o Prisma reportar drift (`There is a drift between your Prisma schema and your database`), execute:
> ```powershell
> npx prisma migrate dev --name add-password-reset-token
> ```
> Se o drift for irrecuperável (ambiente de desenvolvimento): `npx prisma migrate reset --force` (apaga e recria o banco dev).

- [ ] **Step 3.3: Criar `backend/prisma/seed.ts`** (seed com admin inicial)

```typescript
import { PrismaClient, SystemRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@financialcontrol.dev';
  const exists = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (exists) {
    console.log('Seed já executado — admin já existe.');
    return;
  }

  const passwordHash = await bcrypt.hash('Admin@123456', 12);
  const admin = await prisma.user.create({
    data: {
      name: 'Administrador',
      email: adminEmail,
      passwordHash,
      systemRole: SystemRole.ADMIN,
    },
  });

  console.log(`Admin criado: ${admin.email}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 3.4: Adicionar script seed no `package.json`**

No `backend/package.json`, adicionar em `scripts`:
```json
"seed": "ts-node prisma/seed.ts"
```

E instalar ts-node:
```powershell
npm install --save-dev ts-node
```

- [ ] **Step 3.5: Executar seed**

```powershell
npm run seed
```

Saída esperada: `Admin criado: admin@financialcontrol.dev`

---

## Task 4: Guards e Decorators de Autorização

**Files:**
- Create: `backend/src/common/guards/jwt-auth.guard.ts`
- Create: `backend/src/common/guards/roles.guard.ts`
- Create: `backend/src/common/guards/project-access.guard.ts`
- Create: `backend/src/common/decorators/requires-role.decorator.ts`
- Create: `backend/src/common/decorators/requires-project-role.decorator.ts`
- Create: `backend/src/common/decorators/current-user.decorator.ts`

- [ ] **Step 4.1: Escrever testes dos guards (falham agora)**

Criar `backend/src/common/guards/__tests__/roles.guard.spec.ts`:

```typescript
import { RolesGuard } from '../roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { SystemRole } from '@prisma/client';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function makeContext(userRole: SystemRole): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { systemRole: userRole } }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow when no role required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(makeContext(SystemRole.USER))).toBe(true);
  });

  it('should allow ADMIN to access ADMIN route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([SystemRole.ADMIN]);
    expect(guard.canActivate(makeContext(SystemRole.ADMIN))).toBe(true);
  });

  it('should deny USER from ADMIN route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([SystemRole.ADMIN]);
    expect(guard.canActivate(makeContext(SystemRole.USER))).toBe(false);
  });
});
```

- [ ] **Step 4.2: Rodar teste para confirmar falha**

```powershell
npx jest src/common/guards/__tests__/roles.guard.spec.ts --no-coverage
```

Saída esperada: `FAIL` com `Cannot find module '../roles.guard'`

- [ ] **Step 4.3: Criar `backend/src/common/decorators/requires-role.decorator.ts`**

```typescript
import { SetMetadata } from '@nestjs/common';
import { SystemRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const RequiresRole = (...roles: SystemRole[]) =>
  SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 4.4: Criar `backend/src/common/decorators/requires-project-role.decorator.ts`**

```typescript
import { SetMetadata } from '@nestjs/common';
import { ProjectRole } from '@prisma/client';

export const PROJECT_ROLES_KEY = 'projectRoles';
export const RequiresProjectRole = (...roles: ProjectRole[]) =>
  SetMetadata(PROJECT_ROLES_KEY, roles);
```

- [ ] **Step 4.5: Criar `backend/src/common/decorators/current-user.decorator.ts`**

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

- [ ] **Step 4.6: Criar `backend/src/common/guards/jwt-auth.guard.ts`**

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: Error, user: unknown) {
    if (err || !user) {
      throw new UnauthorizedException('Token inválido ou expirado');
    }
    return user;
  }
}
```

- [ ] **Step 4.7: Criar `backend/src/common/guards/roles.guard.ts`**

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/requires-role.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<SystemRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user?.systemRole);
  }
}
```

- [ ] **Step 4.8: Criar `backend/src/common/guards/project-access.guard.ts`**

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemRole, ProjectRole } from '@prisma/client';
import { PROJECT_ROLES_KEY } from '../decorators/requires-project-role.decorator';

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<ProjectRole[]>(
      PROJECT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;
    if (user.systemRole === SystemRole.ADMIN) return true;

    const projectId =
      request.params?.projectId ?? request.body?.projectId;

    if (!projectId) return false;

    const projectUser = await this.prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });

    if (!projectUser) return false;

    if (!requiredRoles) return true;

    const roleHierarchy: Record<ProjectRole, number> = {
      [ProjectRole.GESTOR]: 2,
      [ProjectRole.ANALISTA]: 1,
    };

    const userLevel = roleHierarchy[projectUser.role] ?? 0;
    const minRequired = Math.min(
      ...requiredRoles.map((r) => roleHierarchy[r] ?? 99),
    );

    if (userLevel < minRequired) {
      throw new ForbiddenException(
        `Acesso negado: requer perfil ${requiredRoles.join(' ou ')} no projeto`,
      );
    }

    return true;
  }
}
```

- [ ] **Step 4.9: Criar `backend/src/prisma/prisma.service.ts`**

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super();
    // Middleware deve ser registrado ANTES de $connect para interceptar queries do startup
    this.applySoftDeleteMiddleware();
  }

  async onModuleInit() {
    await this.$connect();
  }

  private applySoftDeleteMiddleware() {
    const SOFT_DELETE_MODELS = new Set([
      'User', 'Project', 'Client', 'Supplier', 'AccountCategory',
      'BankAccount', 'CreditCard', 'CostCenter', 'Transaction',
    ]);

    this.$use(async (params, next) => {
      if (!SOFT_DELETE_MODELS.has(params.model ?? '')) return next(params);

      const action = params.action;

      // Leitura singular/plural + agregações: injeta deletedAt: null se caller não especificou
      const isFilteredRead = action === 'findUnique'
        || action === 'findFirst'
        || action === 'findUniqueOrThrow'
        || action === 'findFirstOrThrow'
        || action === 'findMany'
        || action === 'count'
        || action === 'aggregate'
        || action === 'groupBy';

      if (isFilteredRead) {
        params.args = params.args ?? {};
        params.args.where = params.args.where ?? {};
        if (!('deletedAt' in params.args.where)) {
          params.args.where.deletedAt = null;
        }
        // findUnique/findUniqueOrThrow → findFirst/findFirstOrThrow (suporta campo extra no where)
        if (action === 'findUnique') params.action = 'findFirst';
        if (action === 'findUniqueOrThrow') params.action = 'findFirstOrThrow';
      }

      // Escrita: redirecionar delete → soft delete via update
      if (action === 'delete') {
        params.action = 'update';
        // Preservar select/include do caller; apenas sobrescrever data
        params.args.data = { ...params.args.data, deletedAt: new Date() };
      }

      if (action === 'deleteMany') {
        // Guard: proibir deleteMany sem where em modelos com soft delete
        if (!params.args?.where || Object.keys(params.args.where).length === 0) {
          throw new Error(
            `deleteMany sem where em '${params.model}' é proibido — use where explícito ou hardDelete()`,
          );
        }
        params.action = 'updateMany';
        params.args.data = { deletedAt: new Date() };
      }

      return next(params);
    });
  }
}
```

Criar `backend/src/prisma/prisma.module.ts`:
```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

Adicionar `PrismaModule` no `AppModule` (imports).

- [ ] **Step 4.10: Rodar testes dos guards**

```powershell
npx jest src/common/guards/__tests__/roles.guard.spec.ts --no-coverage
```

Saída esperada: `PASS` com 3 testes passando.

- [ ] **Step 4.11: Commit**

```powershell
git add backend/src/common backend/src/prisma backend/prisma
git commit -m "feat: add prisma schema, guards, and decorators for role-based access"
```

---

## Task 5: Módulo de Autenticação

**Files:**
- Create: `backend/src/modules/auth/auth.module.ts`
- Create: `backend/src/modules/auth/auth.service.ts`
- Create: `backend/src/modules/auth/auth.controller.ts`
- Create: `backend/src/modules/auth/strategies/jwt.strategy.ts`
- Create: `backend/src/modules/auth/strategies/jwt-refresh.strategy.ts`
- Create: `backend/src/modules/auth/dto/register.dto.ts`
- Create: `backend/src/modules/auth/dto/login.dto.ts`
- Create: `backend/src/modules/auth/dto/refresh-token.dto.ts`
- Test: `backend/src/modules/auth/__tests__/auth.service.spec.ts`

- [ ] **Step 5.1: Escrever testes do AuthService (falham agora)**

Criar `backend/src/modules/auth/__tests__/auth.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('token') } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'jwt.secret') return 'test-secret';
              if (key === 'jwt.refreshSecret') return 'test-refresh-secret';
              if (key === 'jwt.expiresIn') return '15m';
              if (key === 'jwt.refreshExpiresIn') return '7d';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: '1', email: 'a@b.com' });

      await expect(
        service.register({ name: 'Test', email: 'a@b.com', password: 'Pass@123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create user and return tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        name: 'Test',
        email: 'a@b.com',
        systemRole: 'USER',
      });
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register({
        name: 'Test',
        email: 'a@b.com',
        password: 'Pass@123',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException for unknown email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'x@y.com', password: '123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'a@b.com',
        passwordHash: await bcrypt.hash('correct', 10),
        isActive: true,
        systemRole: 'USER',
      });

      await expect(
        service.login({ email: 'a@b.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens for valid credentials', async () => {
      const hash = await bcrypt.hash('Pass@123', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        passwordHash: hash,
        isActive: true,
        systemRole: 'USER',
        name: 'Test',
      });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({ email: 'a@b.com', password: 'Pass@123' });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });
});
```

- [ ] **Step 5.2: Rodar teste para confirmar falha**

```powershell
npx jest src/modules/auth/__tests__/auth.service.spec.ts --no-coverage
```

Saída esperada: `FAIL` com `Cannot find module '../auth.service'`

- [ ] **Step 5.3: Criar DTOs**

`backend/src/modules/auth/dto/register.dto.ts`:
```typescript
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'João Silva' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'joao@empresa.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Senha@123', description: 'Mínimo 8 chars, 1 maiúscula, 1 número' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])/, {
    message: 'Senha deve ter pelo menos 1 letra maiúscula e 1 número',
  })
  password: string;
}
```

`backend/src/modules/auth/dto/login.dto.ts`:
```typescript
import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'joao@empresa.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Senha@123' })
  @IsString()
  password: string;
}
```

`backend/src/modules/auth/dto/refresh-token.dto.ts`:
```typescript
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}
```

- [ ] **Step 5.4: Criar `backend/src/modules/auth/auth.service.ts`**

```typescript
import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('E-mail já cadastrado');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { name: dto.name, email: dto.email, passwordHash },
      select: { id: true, name: true, email: true, systemRole: true },
    });

    return this.generateTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciais inválidas');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.generateTokens({
      id: user.id,
      name: user.name,
      email: user.email,
      systemRole: user.systemRole,
    });
  }

  async refreshTokens(token: string) {
    // Revoga atomicamente: UPDATE WHERE revokedAt IS NULL — previne race condition de uso duplo
    const revoked = await this.prisma.refreshToken.updateMany({
      where: { token, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });

    if (revoked.count === 0) {
      // Token não existe, já foi revogado ou está expirado
      throw new UnauthorizedException('Refresh token inválido, revogado ou expirado');
    }

    // Busca o token revogado para obter userId
    const stored = await this.prisma.refreshToken.findUnique({ where: { token } });
    if (!stored) throw new UnauthorizedException('Refresh token não encontrado');

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuário inativo');
    }

    return this.generateTokens({
      id: user.id,
      name: user.name,
      email: user.email,
      systemRole: user.systemRole,
    });
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  private async generateTokens(user: {
    id: string;
    name: string;
    email: string;
    systemRole: string;
  }) {
    const payload = { sub: user.id, email: user.email, systemRole: user.systemRole };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get('jwt.secret'),
      expiresIn: this.config.get('jwt.expiresIn'),
    });

    const refreshTokenValue = randomBytes(40).toString('hex');
    const days = this.config.get<number>('jwt.refreshExpiresInDays') ?? 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    await this.prisma.refreshToken.create({
      data: { userId: user.id, token: refreshTokenValue, expiresAt },
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      user: { id: user.id, name: user.name, email: user.email, systemRole: user.systemRole },
    };
  }
}
```

- [ ] **Step 5.5: Criar strategies JWT**

`backend/src/modules/auth/strategies/jwt.strategy.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret')!,
    });
  }

  validate(payload: { sub: string; email: string; systemRole: string }) {
    return { id: payload.sub, email: payload.email, systemRole: payload.systemRole };
  }
}
```

`backend/src/modules/auth/strategies/jwt-refresh.strategy.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.refreshSecret')!,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: { sub: string }) {
    const refreshToken = req.get('Authorization')?.replace('Bearer ', '').trim();
    return { id: payload.sub, refreshToken };
  }
}
```

- [ ] **Step 5.6: Criar `backend/src/modules/auth/auth.controller.ts`**

```typescript
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Cadastrar novo usuário' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login com e-mail e senha' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token com refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Encerrar sessão (revoga todos os refresh tokens)' })
  logout(@CurrentUser() user: { id: string }) {
    return this.authService.logout(user.id);
  }
}
```

- [ ] **Step 5.7: Criar `backend/src/modules/auth/auth.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 5.8: Rodar testes do AuthService**

```powershell
npx jest src/modules/auth/__tests__/auth.service.spec.ts --no-coverage
```

Saída esperada: `PASS` com 5 testes passando.

- [ ] **Step 5.9: Commit**

```powershell
git add backend/src/modules/auth
git commit -m "feat: implement auth module with JWT access+refresh tokens"
```

---

## Task 6: Módulo de Usuários (CRUD)

**Files:**
- Create: `backend/src/modules/users/users.module.ts`
- Create: `backend/src/modules/users/users.service.ts`
- Create: `backend/src/modules/users/users.controller.ts`
- Create: `backend/src/modules/users/dto/create-user.dto.ts`
- Create: `backend/src/modules/users/dto/update-user.dto.ts`
- Test: `backend/src/modules/users/__tests__/users.service.spec.ts`

- [ ] **Step 6.1: Escrever testes do UsersService (falham agora)**

Criar `backend/src/modules/users/__tests__/users.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SystemRole } from '@prisma/client';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('should list all users (admin)', async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: '1', name: 'A', email: 'a@a.com', systemRole: SystemRole.USER },
    ]);

    const result = await service.findAll();
    expect(result).toHaveLength(1);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } }),
    );
  });

  it('should throw NotFoundException for unknown user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
  });

  it('should soft-delete user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: '1', deletedAt: null });
    mockPrisma.user.update.mockResolvedValue({ id: '1', deletedAt: new Date() });

    await service.remove('1');

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { deletedAt: expect.any(Date), isActive: false },
    });
  });
});
```

- [ ] **Step 6.2: Rodar teste para confirmar falha**

```powershell
npx jest src/modules/users/__tests__/users.service.spec.ts --no-coverage
```

Saída esperada: `FAIL`

- [ ] **Step 6.3: Criar DTOs**

`backend/src/modules/users/dto/create-user.dto.ts`:
```typescript
import { IsEmail, IsString, IsEnum, IsOptional, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])/)
  password: string;

  @ApiPropertyOptional({ enum: SystemRole, default: SystemRole.USER })
  @IsOptional()
  @IsEnum(SystemRole)
  systemRole?: SystemRole;
}
```

`backend/src/modules/users/dto/update-user.dto.ts`:
```typescript
import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['email'] as const)) {}
```

- [ ] **Step 6.4: Criar `backend/src/modules/users/users.service.ts`**

```typescript
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  systemRole: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      select: USER_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException(`Usuário ${id} não encontrado`);
    return user;
  }

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('E-mail já cadastrado');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        systemRole: dto.systemRole,
      },
      select: USER_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 12);
      delete data.password;
    }
    return this.prisma.user.update({ where: { id }, data, select: USER_SELECT });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
```

- [ ] **Step 6.5: Criar `backend/src/modules/users/users.controller.ts`**

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequiresRole } from '../../common/decorators/requires-role.decorator';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @RequiresRole(SystemRole.ADMIN)
  @ApiOperation({ summary: 'Listar todos os usuários (Admin)' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar usuário por ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @RequiresRole(SystemRole.ADMIN)
  @ApiOperation({ summary: 'Criar usuário (Admin)' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar usuário' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @RequiresRole(SystemRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desativar usuário (soft delete, Admin)' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
```

- [ ] **Step 6.6: Criar `backend/src/modules/users/users.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 6.7: Rodar testes do UsersService**

```powershell
npx jest src/modules/users/__tests__/users.service.spec.ts --no-coverage
```

Saída esperada: `PASS` com 3 testes passando.

- [ ] **Step 6.8: Commit**

```powershell
git add backend/src/modules/users
git commit -m "feat: add users CRUD module with admin-only guards"
```

---

## Task 7: Módulo de Projetos (CRUD + Associação de Usuários)

**Files:**
- Create: `backend/src/modules/projects/projects.module.ts`
- Create: `backend/src/modules/projects/projects.service.ts`
- Create: `backend/src/modules/projects/projects.controller.ts`
- Create: `backend/src/modules/projects/dto/create-project.dto.ts`
- Create: `backend/src/modules/projects/dto/update-project.dto.ts`
- Create: `backend/src/modules/projects/dto/assign-user.dto.ts`
- Test: `backend/src/modules/projects/__tests__/projects.service.spec.ts`

- [ ] **Step 7.1: Escrever testes do ProjectsService (falham agora)**

Criar `backend/src/modules/projects/__tests__/projects.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from '../projects.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ProjectRole } from '@prisma/client';

const mockPrisma = {
  project: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  projectUser: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('ProjectsService', () => {
  let service: ProjectsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    jest.clearAllMocks();
  });

  it('should create project', async () => {
    mockPrisma.project.create.mockResolvedValue({
      id: 'proj-1',
      name: 'Projeto Alpha',
      status: 'ACTIVE',
    });

    const result = await service.create({
      name: 'Projeto Alpha',
      startDate: new Date('2026-01-01'),
    });

    expect(result).toHaveProperty('id');
    expect(mockPrisma.project.create).toHaveBeenCalledTimes(1);
  });

  it('should throw NotFoundException for unknown project', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);
    await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
  });

  it('should assign user to project', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
    mockPrisma.projectUser.findUnique.mockResolvedValue(null);
    mockPrisma.projectUser.create.mockResolvedValue({
      projectId: 'proj-1',
      userId: 'user-1',
      role: ProjectRole.ANALISTA,
    });

    const result = await service.assignUser('proj-1', {
      userId: 'user-1',
      role: ProjectRole.ANALISTA,
    });

    expect(result.role).toBe(ProjectRole.ANALISTA);
  });

  it('should throw ConflictException if user already in project', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
    mockPrisma.projectUser.findUnique.mockResolvedValue({
      projectId: 'proj-1',
      userId: 'user-1',
    });

    await expect(
      service.assignUser('proj-1', { userId: 'user-1', role: ProjectRole.GESTOR }),
    ).rejects.toThrow(ConflictException);
  });
});
```

- [ ] **Step 7.2: Rodar teste para confirmar falha**

```powershell
npx jest src/modules/projects/__tests__/projects.service.spec.ts --no-coverage
```

Saída esperada: `FAIL`

- [ ] **Step 7.3: Criar DTOs**

`backend/src/modules/projects/dto/create-project.dto.ts`:
```typescript
import { IsString, IsOptional, IsDateString, IsEnum, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateProjectDto {
  @ApiProperty({ example: 'Projeto Alpha' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2026-01-01' })
  @Type(() => Date)
  startDate: Date;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ example: '#3B82F6' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 'briefcase' })
  @IsOptional()
  @IsString()
  icon?: string;
}
```

`backend/src/modules/projects/dto/update-project.dto.ts`:
```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateProjectDto } from './create-project.dto';

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
```

`backend/src/modules/projects/dto/assign-user.dto.ts`:
```typescript
import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';

export class AssignUserDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty({ enum: ProjectRole })
  @IsEnum(ProjectRole)
  role: ProjectRole;
}
```

- [ ] **Step 7.4: Criar `backend/src/modules/projects/projects.service.ts`**

```typescript
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AssignUserDto } from './dto/assign-user.dto';
import { SystemRole } from '@prisma/client';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, userRole: SystemRole) {
    if (userRole === SystemRole.ADMIN) {
      return this.prisma.project.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
      });
    }
    return this.prisma.project.findMany({
      where: {
        deletedAt: null,
        projectUsers: { some: { userId } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id, deletedAt: null },
      include: {
        projectUsers: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!project) throw new NotFoundException(`Projeto ${id} não encontrado`);
    return project;
  }

  async create(dto: CreateProjectDto) {
    return this.prisma.project.create({ data: dto });
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.findOne(id);
    return this.prisma.project.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'CLOSED' },
    });
  }

  async assignUser(projectId: string, dto: AssignUserDto) {
    await this.findOne(projectId);

    const existing = await this.prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId, userId: dto.userId } },
    });
    if (existing) throw new ConflictException('Usuário já está no projeto');

    return this.prisma.projectUser.create({
      data: { projectId, userId: dto.userId, role: dto.role },
    });
  }

  async removeUser(projectId: string, userId: string) {
    const pu = await this.prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!pu) throw new NotFoundException('Usuário não encontrado no projeto');
    await this.prisma.projectUser.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  }
}
```

- [ ] **Step 7.5: Criar `backend/src/modules/projects/projects.controller.ts`**

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AssignUserDto } from './dto/assign-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequiresRole } from '../../common/decorators/requires-role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar projetos acessíveis ao usuário' })
  findAll(@CurrentUser() user: { id: string; systemRole: SystemRole }) {
    return this.projectsService.findAll(user.id, user.systemRole);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do projeto' })
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @RequiresRole(SystemRole.ADMIN)
  @ApiOperation({ summary: 'Criar projeto (Admin)' })
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar projeto' })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @RequiresRole(SystemRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Encerrar projeto (soft delete, Admin)' })
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }

  @Post(':id/users')
  @UseGuards(RolesGuard)
  @RequiresRole(SystemRole.ADMIN)
  @ApiOperation({ summary: 'Associar usuário ao projeto (Admin)' })
  assignUser(@Param('id') id: string, @Body() dto: AssignUserDto) {
    return this.projectsService.assignUser(id, dto);
  }

  @Delete(':id/users/:userId')
  @UseGuards(RolesGuard)
  @RequiresRole(SystemRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover usuário do projeto (Admin)' })
  removeUser(@Param('id') id: string, @Param('userId') userId: string) {
    return this.projectsService.removeUser(id, userId);
  }
}
```

- [ ] **Step 7.6: Criar `backend/src/modules/projects/projects.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
```

- [ ] **Step 7.7: Rodar testes do ProjectsService**

```powershell
npx jest src/modules/projects/__tests__/projects.service.spec.ts --no-coverage
```

Saída esperada: `PASS` com 4 testes passando.

- [ ] **Step 7.8: Rodar todos os testes unitários**

```powershell
npx jest --no-coverage --testPathPattern="spec.ts"
```

Saída esperada: todos passando.

- [ ] **Step 7.9: Commit**

```powershell
git add backend/src/modules/projects
git commit -m "feat: add projects CRUD with user assignment and role-based access"
```

---

## Task 8: Testes E2E do Backend

**Files:**
- Create: `backend/test/auth.e2e-spec.ts`
- Create: `backend/test/jest-e2e.json`

- [ ] **Step 8.1: Criar `backend/test/jest-e2e.json`**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
```

- [ ] **Step 8.2: Criar `backend/test/auth.e2e-spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
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
```

- [ ] **Step 8.3: Adicionar script e2e no `package.json` do backend**

Em `scripts`:
```json
"test:e2e": "jest --config ./test/jest-e2e.json --no-coverage"
```

- [ ] **Step 8.4: Rodar testes E2E (requer banco rodando)**

```powershell
# banco dev deve estar rodando via docker-compose.dev.yml
$env:DATABASE_URL="postgresql://user:password@localhost:5432/financial_control_dev"
npm run test:e2e
```

Saída esperada: `PASS test/auth.e2e-spec.ts` com 5 testes passando.

- [ ] **Step 8.5: Commit**

```powershell
git add backend/test
git commit -m "test: add auth E2E tests"
```

---

## Task 9: Frontend — Scaffold Next.js

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/next.config.ts`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/Dockerfile`

- [ ] **Step 9.1: Criar projeto Next.js 14**

```powershell
Set-Location "C:\Users\LeandroFerreiraLFTec\claude\pcontroleorc\financial-control"
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
```

- [ ] **Step 9.2: Instalar dependências frontend**

```powershell
Set-Location frontend
npx shadcn@latest init --defaults
npx shadcn@latest add button input label card form toast
npm install axios zustand @tanstack/react-query react-hook-form zod @hookform/resolvers
```

- [ ] **Step 9.3: Criar `frontend/src/lib/api.ts`**

```typescript
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor de refresh só opera no browser — no servidor (Next.js SSR) não há
// localStorage nem sessão de usuário individual, então rejeitamos 401 diretamente.
const isBrowser = typeof window !== 'undefined';

// Estado de refresh por processo de browser (SPA client-side apenas)
let isRefreshing = false;
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  const queue = pendingQueue;
  pendingQueue = [];
  if (error) {
    queue.forEach(({ reject }) => reject(error));
  } else {
    queue.forEach(({ resolve }) => resolve(token as string));
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    // Em SSR não há localStorage nem sessão de usuário — rejeitar diretamente
    if (!isBrowser) return Promise.reject(error);

    const original = error.config;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (token) => {
            original.headers = original.headers ?? {};
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          },
          reject,
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      isRefreshing = false;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    try {
      const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
      if (!data?.accessToken || !data?.refreshToken) {
        throw new Error('Resposta de refresh inválida');
      }
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      api.defaults.headers.common.Authorization = `Bearer ${data.accessToken}`;
      processQueue(null, data.accessToken);
      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch (err) {
      processQueue(err, null);
      // Remover apenas as chaves de autenticação — não destruir outros dados do localStorage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  },
);
```

- [ ] **Step 9.4: Criar `frontend/src/lib/auth.ts`**

```typescript
import { api } from './api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  systemRole: 'ADMIN' | 'USER';
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const { data } = await api.post('/auth/login', { email, password });
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data.user;
}

export async function logout() {
  try {
    await api.post('/auth/logout');
  } finally {
    localStorage.clear();
    window.location.href = '/login';
  }
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('accessToken');
}
```

- [ ] **Step 9.5: Criar `frontend/src/types/index.ts`**

```typescript
export type SystemRole = 'ADMIN' | 'USER';
export type ProjectRole = 'GESTOR' | 'ANALISTA';
export type ProjectStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

export interface User {
  id: string;
  name: string;
  email: string;
  systemRole: SystemRole;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  status: ProjectStatus;
  color?: string;
  icon?: string;
  createdAt: string;
}

export interface ProjectUser {
  userId: string;
  projectId: string;
  role: ProjectRole;
  user: Pick<User, 'id' | 'name' | 'email'>;
}
```

- [ ] **Step 9.6: Criar `frontend/Dockerfile`**

```dockerfile
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS production
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

No `next.config.ts` adicionar `output: 'standalone'`.

- [ ] **Step 9.7: Commit**

```powershell
git add frontend
git commit -m "feat: scaffold Next.js 14 frontend with axios, zustand, shadcn/ui"
```

---

## Task 10: Frontend — Página de Login

**Files:**
- Create: `frontend/src/app/(auth)/login/page.tsx`
- Create: `frontend/src/app/(auth)/layout.tsx`
- Create: `frontend/src/hooks/usePermissions.ts`

- [ ] **Step 10.1: Criar `frontend/src/app/(auth)/layout.tsx`**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
```

- [ ] **Step 10.2: Criar `frontend/src/app/(auth)/login/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { login } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setError('');
    try {
      await login(data.email, data.password);
      router.push('/dashboard');
    } catch {
      setError('E-mail ou senha inválidos. Tente novamente.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Sistema de Controle Financeiro</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </Button>

          <p className="text-sm text-center text-gray-500">
            <a href="/recuperar-senha" className="underline hover:text-gray-700">
              Esqueceu a senha?
            </a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 10.3: Criar `frontend/src/hooks/usePermissions.ts`**

```typescript
import { getCurrentUser } from '@/lib/auth';

export function usePermissions() {
  const user = getCurrentUser();

  return {
    isAdmin: user?.systemRole === 'ADMIN',
    isAuthenticated: !!user,
    user,
    can: (permission: 'manage:users' | 'manage:projects' | 'approve:transactions') => {
      if (!user) return false;
      if (user.systemRole === 'ADMIN') return true;
      return false;
    },
  };
}
```

- [ ] **Step 10.4: Criar layout base do dashboard**

Criar `frontend/src/app/(app)/layout.tsx`:
```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) router.push('/login');
  }, [router]);

  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-64 bg-white shadow-sm border-r">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold text-gray-800">Controle Financeiro</h1>
        </div>
        <nav className="p-4 space-y-1">
          {[
            { href: '/dashboard', label: 'Dashboard' },
            { href: '/lancamentos', label: 'Lançamentos' },
            { href: '/orcamento', label: 'Orçamento' },
            { href: '/conciliacao', label: 'Conciliação' },
            { href: '/clientes', label: 'Clientes' },
            { href: '/fornecedores', label: 'Fornecedores' },
            { href: '/configuracoes', label: 'Configurações' },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
```

Criar `frontend/src/app/(app)/dashboard/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  const [user, setUser] = useState<{ name: string; systemRole: string } | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        Bem-vindo, {user?.name ?? '...'}
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-500">Saldo Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R$ 0,00</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-500">A Pagar (mês)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">R$ 0,00</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-500">A Receber (mês)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">R$ 0,00</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 10.5: Commit**

```powershell
git add frontend/src
git commit -m "feat: add login page, dashboard layout, and permissions hook"
```

---

## Task 11: Telegram Bot — Stub Inicial

**Files:**
- Create: `telegram-bot/package.json`
- Create: `telegram-bot/src/main.ts`
- Create: `telegram-bot/Dockerfile`

- [ ] **Step 11.1: Inicializar telegram-bot**

```powershell
Set-Location "C:\Users\LeandroFerreiraLFTec\claude\pcontroleorc\financial-control\telegram-bot"
npm init -y
npm install telegraf
npm install --save-dev typescript @types/node ts-node
```

- [ ] **Step 11.2: Criar `telegram-bot/src/main.ts`**

```typescript
import { Telegraf } from 'telegraf';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.log('TELEGRAM_BOT_TOKEN não configurado — bot em modo stub');
  process.exit(0);
}

const bot = new Telegraf(token);

bot.start((ctx) => ctx.reply('Bot do Sistema Financeiro iniciado. Em breve disponível!'));

bot.launch().then(() => {
  console.log('Telegram bot iniciado');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
```

- [ ] **Step 11.3: Criar `telegram-bot/Dockerfile`**

```dockerfile
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx tsc || true
CMD ["node", "-e", "require('./src/main.ts')"]
```

- [ ] **Step 11.4: Commit**

```powershell
git add telegram-bot
git commit -m "feat: add telegram bot stub"
```

---

## Task 12: Validação Final e README

**Files:**
- Create: `README.md`
- Create: `financial-control/.gitignore`

- [ ] **Step 12.1: Criar `.gitignore` raiz**

```gitignore
node_modules/
.env
dist/
.next/
*.log
uploads/
```

- [ ] **Step 12.2: Criar `README.md`**

```markdown
# Sistema de Controle Financeiro Multi-usuário

Sistema web completo de controle financeiro, orientado a projetos, com bot Telegram.

## Requisitos

- Node.js 20+
- Docker Desktop
- Git

## Setup rápido

```powershell
# 1. Copiar variáveis de ambiente
Copy-Item .env.example .env
# Editar .env com JWT_SECRET e JWT_REFRESH_SECRET (mínimo 32 chars cada)

# 2. Subir infraestrutura (Postgres + Redis)
docker compose -f docker-compose.dev.yml up -d

# 3. Backend — instalar, migrar e rodar
Set-Location backend
npm install
npx prisma migrate dev
npm run seed          # cria admin@financialcontrol.dev / Admin@123456
npm run start:dev     # http://localhost:3001
                      # Swagger: http://localhost:3001/api/docs

# 4. Frontend — instalar e rodar
Set-Location ../frontend
npm install
npm run dev           # http://localhost:3000
```

## Perfis de acesso

| Perfil | Escopo | Permissões |
|--------|--------|------------|
| Admin | Global | Tudo |
| Gestor | Por projeto | Gerenciar projeto, aprovar lançamentos |
| Analista | Por projeto | Criar lançamentos (aguardam aprovação), visualizar |

## Testes

```powershell
# Unitários (backend)
cd backend && npx jest --no-coverage

# E2E (requer banco rodando)
cd backend && npm run test:e2e
```
```

- [ ] **Step 12.3: Rodar todos os testes uma vez**

```powershell
Set-Location backend
npx jest --no-coverage
```

Saída esperada: todos os testes passando. Confirmar:
- `auth.service.spec.ts` — 5 testes
- `users.service.spec.ts` — 3 testes
- `projects.service.spec.ts` — 4 testes
- `roles.guard.spec.ts` — 3 testes

- [ ] **Step 12.4: Inicializar repositório git**

```powershell
Set-Location "C:\Users\LeandroFerreiraLFTec\claude\pcontroleorc\financial-control"
git init
git add .
git commit -m "feat: fase 1 completa — fundação, autenticação JWT, CRUD projetos/usuários, frontend login"
```

- [ ] **Step 12.5: Testar o fluxo completo manualmente**

Com backend e banco rodando:

```powershell
# Registrar usuário
curl -X POST http://localhost:3001/auth/register `
  -H "Content-Type: application/json" `
  -d '{"name":"Teste","email":"teste@teste.com","password":"Pass@1234"}'

# Login com admin do seed
curl -X POST http://localhost:3001/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"admin@financialcontrol.dev","password":"Admin@123456"}'

# Listar usuários (usar accessToken do passo anterior)
curl http://localhost:3001/users `
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

## Entrega da Fase 1

**O que estará funcionando:**
- Docker Compose com PostgreSQL 16 e Redis 7
- Schema Prisma completo com todas as 20+ entidades e migrations
- Módulo Auth: registro, login, refresh token, logout
- Sistema de perfis: SystemRole (ADMIN/USER) + ProjectRole (GESTOR/ANALISTA)
- Guards: `JwtAuthGuard`, `RolesGuard`, `ProjectAccessGuard`
- Decorators: `@RequiresRole`, `@RequiresProjectRole`, `@CurrentUser`
- CRUD de Usuários com soft delete e controle por Admin
- CRUD de Projetos com associação de usuários por perfil
- Frontend: página de login funcional + layout base do dashboard
- Swagger disponível em `/api/docs`
- 15+ testes (unitários + E2E) passando

**Pendente para Fase 2:**
- CRUD completo de Clientes, Fornecedores, Plano de Contas, Contas Bancárias, Cartões, Centros de Custo
- Telas de administração no frontend
- Vinculação Telegram (token de 6 dígitos)
