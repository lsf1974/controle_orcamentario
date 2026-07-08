# Fase 2 — Módulo de Cadastros: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CRUD completo (backend + frontend) de Fornecedores, Clientes, Contas Bancárias, Cartões de Crédito, Plano de Contas, Centros de Custo e Configurações de Notificação, com autorização por perfil e testes.

**Architecture:** 7 módulos NestJS novos seguindo o padrão de `users`/`projects` da Fase 1 (controller + service + dto + testes por módulo). Entidades globais (Supplier/Client/BankAccount/CreditCard) têm CRUD Admin-only e associação a projetos via tabelas N:N com permissão Gestor; entidades por projeto (AccountCategory/CostCenter) usam `ProjectAccessGuard` + `RequiresProjectRole(GESTOR)`. Frontend Next.js ganha TanStack Query, componentes compartilhados (`DataTable`, `Dialog`) e páginas em `(app)/cadastros/*`, `(app)/projetos/*` e `(app)/configuracoes/*`.

**Tech Stack:** NestJS 10 + Prisma + PostgreSQL (backend), Jest + Supertest (testes), Next.js 16 App Router + TanStack Query 5 + React Hook Form + Zod 4 + sonner (frontend).

## Global Constraints

- Mensagens de erro e summaries do Swagger em pt-BR (padrão da Fase 1: `'Fornecedor ${id} não encontrado'`, `'CPF/CNPJ já cadastrado'`).
- Todas as entidades de cadastro usam soft delete: `remove()` = `update({ deletedAt: new Date(), isActive: false })`. Nunca `delete` físico (exceto linhas de tabelas de junção `ProjectClient`/`ProjectBankAccount`/`ProjectCreditCard`, que não têm `deletedAt`).
- Exclusão com dependências ativas (`Transaction`/`BudgetLine`/filhos) retorna `409 Conflict` sugerindo `isActive: false`.
- Unicidade com soft delete: verificar via `findFirst({ where: { <campo>, deletedAt: null } })` **e** capturar `Prisma.PrismaClientKnownRequestError` código `P2002` (registro soft-deletado ainda ocupa a constraint) — mesmo padrão de `users.service.ts`.
- DTOs com `class-validator` + decorators `@nestjs/swagger`; Update DTOs via `PartialType(CreateDto)` de `@nestjs/swagger`.
- Guards existentes (não criar novos): `JwtAuthGuard`, `RolesGuard` + `@RequiresRole(SystemRole.ADMIN)`, `ProjectAccessGuard` + `@RequiresProjectRole(ProjectRole.GESTOR)`. O `ProjectAccessGuard` lê `request.params.projectId` — rotas por projeto DEVEM usar o nome de parâmetro `:projectId`.
- `GET /clients`, `GET /bank-accounts`, `GET /credit-cards` (listagem/detalhe) são liberados para qualquer usuário autenticado — o Gestor precisa listar o cadastro mestre para escolher o que associar ao projeto (spec §3 e §4.2). Mutações continuam Admin-only.
- Conversão de violação de unicidade (P2002) em `409 Conflict` é centralizada no helper `throwConflictIfUniqueViolation` (criado na Task 1) — não duplicar try/catch inline nos services.
- A obrigatoriedade condicional de `companyName`/`fullName` por `personType` é validada **no service, apenas no create** (helper `assertPersonNames`, Task 1) — não usar `@ValidateIf` nos DTOs, pois com `PartialType` isso quebraria PATCHes que reenviam `personType` sem o campo de nome.
- Comandos de backend rodam em `financial-control/backend/`; frontend em `financial-control/frontend/`.
- Testes E2E exigem PostgreSQL/Redis de dev rodando: `docker compose -f docker-compose.dev.yml up -d postgres redis` em `financial-control/` (e `.env` do backend apontando para ele, como na Fase 1).
- Todo `INestApplication` de teste E2E deve usar o mesmo `ValidationPipe` do `main.ts` de produção: `{ whitelist: true, forbidNonWhitelisted: true, transform: true }`. Payloads com propriedades fora do DTO retornam 400 em produção — os testes precisam refletir isso.
- Commits frequentes, mensagens em pt-BR no padrão da Fase 1 (`feat:`, `fix:`, `test:`).

---

## Estrutura de Arquivos

```
financial-control/
├── backend/
│   ├── src/
│   │   ├── app.module.ts                                  # modificar: registrar 7 módulos
│   │   └── modules/
│   │       ├── suppliers/
│   │       │   ├── suppliers.module.ts
│   │       │   ├── suppliers.controller.ts
│   │       │   ├── suppliers.service.ts
│   │       │   ├── dto/create-supplier.dto.ts
│   │       │   ├── dto/update-supplier.dto.ts
│   │       │   └── __tests__/suppliers.service.spec.ts
│   │       ├── clients/
│   │       │   ├── clients.module.ts
│   │       │   ├── clients.controller.ts                  # /clients (global)
│   │       │   ├── project-clients.controller.ts          # /projects/:projectId/clients
│   │       │   ├── clients.service.ts
│   │       │   ├── dto/{create-client,update-client,assign-client}.dto.ts
│   │       │   └── __tests__/clients.service.spec.ts
│   │       ├── bank-accounts/          # mesmo layout de clients
│   │       ├── credit-cards/           # mesmo layout de clients
│   │       ├── account-categories/     # controller único /projects/:projectId/account-categories
│   │       ├── cost-centers/           # controller único /projects/:projectId/cost-centers
│   │       └── notification-config/    # /notification-config (por usuário)
│   └── test/
│       ├── helpers/e2e-setup.ts        # helper compartilhado (criar usuário/login/admin)
│       └── {suppliers,clients,bank-accounts,credit-cards,account-categories,cost-centers,notification-config}.e2e-spec.ts
└── frontend/
    └── src/
        ├── app/
        │   ├── layout.tsx                                  # modificar: envolver com <Providers>
        │   ├── providers.tsx                               # QueryClientProvider + Toaster
        │   └── (app)/
        │       ├── layout.tsx                              # modificar: sidebar com seção Cadastros
        │       ├── cadastros/
        │       │   ├── fornecedores/page.tsx
        │       │   ├── clientes/page.tsx
        │       │   ├── contas-bancarias/page.tsx
        │       │   └── cartoes/page.tsx
        │       ├── projetos/
        │       │   ├── page.tsx                            # lista de projetos
        │       │   └── [projectId]/
        │       │       ├── cadastros/page.tsx              # associações do projeto
        │       │       ├── plano-de-contas/page.tsx
        │       │       └── centros-de-custo/page.tsx
        │       └── configuracoes/notificacoes/page.tsx
        ├── components/
        │   ├── ui/dialog.tsx                               # modal simples
        │   └── shared/
        │       ├── data-table.tsx                          # DataTable<T> genérico
        │       └── confirm-dialog.tsx
        ├── hooks/
        │   ├── use-crud.ts                                 # hook CRUD genérico (TanStack Query)
        │   └── use-project.ts                              # projeto atual + papel do usuário
        └── types/index.ts                                  # modificar: tipos das 7 entidades
```

---

## Task 1: Backend — Módulo `suppliers` + helper E2E

**Files:**
- Create: `financial-control/backend/src/common/utils/prisma-errors.ts`
- Create: `financial-control/backend/src/common/utils/person-names.util.ts`
- Create: `financial-control/backend/src/modules/suppliers/dto/create-supplier.dto.ts`
- Create: `financial-control/backend/src/modules/suppliers/dto/update-supplier.dto.ts`
- Create: `financial-control/backend/src/modules/suppliers/suppliers.service.ts`
- Create: `financial-control/backend/src/modules/suppliers/suppliers.controller.ts`
- Create: `financial-control/backend/src/modules/suppliers/suppliers.module.ts`
- Create: `financial-control/backend/src/modules/suppliers/__tests__/suppliers.service.spec.ts`
- Create: `financial-control/backend/test/helpers/e2e-setup.ts`
- Create: `financial-control/backend/test/suppliers.e2e-spec.ts`
- Modify: `financial-control/backend/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService`, guards/decorators de `src/common/` (Fase 1).
- Produces: `throwConflictIfUniqueViolation(error: unknown, message: string): never` e `assertPersonNames(dto): void` em `src/common/utils/` (usados pelos services das tasks 2–6); `SuppliersService` (`findAll()`, `findOne(id)`, `create(dto)`, `update(id, dto)`, `remove(id)`); helper E2E `createUserAndLogin(app, email, { admin? }): Promise<{ token: string; userId: string }>` usado por TODAS as suites E2E das tasks 2–7.

- [ ] **Step 1: Escrever os testes unitários (falhando)**

`financial-control/backend/src/modules/suppliers/__tests__/suppliers.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { SuppliersService } from '../suppliers.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { PersonType } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

const mockPrisma = {
  supplier: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  transaction: { count: jest.fn() },
  budgetLine: { count: jest.fn() },
};

describe('SuppliersService', () => {
  let service: SuppliersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);
    jest.clearAllMocks();
  });

  it('should create a supplier', async () => {
    mockPrisma.supplier.findFirst.mockResolvedValue(null);
    mockPrisma.supplier.create.mockResolvedValue({ id: 's1', taxId: '123' });

    const result = await service.create({
      personType: PersonType.COMPANY,
      companyName: 'Fornecedor X',
      taxId: '12345678000190',
    });
    expect(result.id).toBe('s1');
  });

  it('should throw ConflictException for duplicate taxId', async () => {
    mockPrisma.supplier.findFirst.mockResolvedValue({ id: 's1' });
    await expect(
      service.create({
        personType: PersonType.COMPANY,
        companyName: 'Y',
        taxId: '12345678000190',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject COMPANY without companyName on create', async () => {
    await expect(
      service.create({
        personType: PersonType.COMPANY,
        taxId: '12345678000190',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.supplier.create).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException for unknown supplier', async () => {
    mockPrisma.supplier.findFirst.mockResolvedValue(null);
    await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
  });

  it('should block remove when supplier has transactions', async () => {
    mockPrisma.supplier.findFirst.mockResolvedValue({ id: 's1', deletedAt: null });
    mockPrisma.transaction.count.mockResolvedValue(2);
    mockPrisma.budgetLine.count.mockResolvedValue(0);

    await expect(service.remove('s1')).rejects.toThrow(ConflictException);
    expect(mockPrisma.supplier.update).not.toHaveBeenCalled();
  });

  it('should soft-delete supplier without dependents', async () => {
    mockPrisma.supplier.findFirst.mockResolvedValue({ id: 's1', deletedAt: null });
    mockPrisma.transaction.count.mockResolvedValue(0);
    mockPrisma.budgetLine.count.mockResolvedValue(0);
    mockPrisma.supplier.update.mockResolvedValue({});

    await service.remove('s1');

    expect(mockPrisma.supplier.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { deletedAt: expect.any(Date), isActive: false },
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e verificar que falha**

Run (em `financial-control/backend/`): `npm test -- suppliers.service`
Expected: FAIL — `Cannot find module '../suppliers.service'`

- [ ] **Step 3: Implementar helpers compartilhados, DTOs, service, controller e module**

`financial-control/backend/src/common/utils/prisma-errors.ts`:

```typescript
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Converte violação de constraint única (P2002) em 409 Conflict;
 * relança qualquer outro erro. Necessário porque registros soft-deletados
 * ainda ocupam as constraints únicas do banco — o findFirst com
 * deletedAt: null não detecta esses casos.
 */
export function throwConflictIfUniqueViolation(
  error: unknown,
  message: string,
): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException(message);
  }
  throw error;
}
```

`financial-control/backend/src/common/utils/person-names.util.ts`:

```typescript
import { BadRequestException } from '@nestjs/common';
import { PersonType } from '@prisma/client';

/**
 * Valida a obrigatoriedade condicional de nome por tipo de pessoa.
 * Chamado APENAS no create — no update, exigir o campo de novo quebraria
 * PATCHes que reenviam personType sem alterar o nome já salvo.
 */
export function assertPersonNames(dto: {
  personType?: PersonType;
  companyName?: string | null;
  fullName?: string | null;
}): void {
  if (dto.personType === PersonType.COMPANY && !dto.companyName) {
    throw new BadRequestException(
      'Razão social (companyName) é obrigatória para pessoa jurídica',
    );
  }
  if (dto.personType === PersonType.INDIVIDUAL && !dto.fullName) {
    throw new BadRequestException(
      'Nome completo (fullName) é obrigatório para pessoa física',
    );
  }
}
```

`financial-control/backend/src/modules/suppliers/dto/create-supplier.dto.ts`:

```typescript
import {
  IsString,
  IsEnum,
  IsOptional,
  IsEmail,
  IsInt,
  IsBoolean,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PersonType, BankAccountType } from '@prisma/client';

export class CreateSupplierDto {
  @ApiProperty({ enum: PersonType })
  @IsEnum(PersonType)
  personType: PersonType;

  @ApiPropertyOptional({
    description: 'Obrigatório para pessoa jurídica (validado no service, só no create)',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tradeName?: string;

  @ApiPropertyOptional({
    description: 'Obrigatório para pessoa física (validado no service, só no create)',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @ApiProperty({ description: 'CPF ou CNPJ (somente dígitos)' })
  @IsString()
  @MinLength(11)
  taxId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mobile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pixKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAgency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccount?: string;

  @ApiPropertyOptional({ enum: BankAccountType })
  @IsOptional()
  @IsEnum(BankAccountType)
  bankAccountType?: BankAccountType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  paymentTermDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

`financial-control/backend/src/modules/suppliers/dto/update-supplier.dto.ts`:

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateSupplierDto } from './create-supplier.dto';

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}
```

`financial-control/backend/src/modules/suppliers/suppliers.service.ts`:

```typescript
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { throwConflictIfUniqueViolation } from '../../common/utils/prisma-errors';
import { assertPersonNames } from '../../common/utils/person-names.util';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.supplier.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, deletedAt: null },
    });
    if (!supplier) throw new NotFoundException(`Fornecedor ${id} não encontrado`);
    return supplier;
  }

  async create(dto: CreateSupplierDto) {
    assertPersonNames(dto);
    const exists = await this.prisma.supplier.findFirst({
      where: { taxId: dto.taxId, deletedAt: null },
    });
    if (exists) throw new ConflictException('CPF/CNPJ já cadastrado');
    try {
      return await this.prisma.supplier.create({ data: dto });
    } catch (error) {
      throwConflictIfUniqueViolation(error, 'CPF/CNPJ já cadastrado');
    }
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.findOne(id);
    if (dto.taxId) {
      const exists = await this.prisma.supplier.findFirst({
        where: { taxId: dto.taxId, deletedAt: null, id: { not: id } },
      });
      if (exists) throw new ConflictException('CPF/CNPJ já cadastrado');
    }
    try {
      return await this.prisma.supplier.update({ where: { id }, data: dto });
    } catch (error) {
      throwConflictIfUniqueViolation(error, 'CPF/CNPJ já cadastrado');
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    const [txCount, blCount] = await Promise.all([
      this.prisma.transaction.count({ where: { supplierId: id, deletedAt: null } }),
      this.prisma.budgetLine.count({ where: { supplierId: id } }),
    ]);
    if (txCount + blCount > 0) {
      throw new ConflictException(
        'Fornecedor possui lançamentos ou linhas de orçamento vinculados — desative-o (isActive: false) em vez de excluir',
      );
    }
    await this.prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
```

`financial-control/backend/src/modules/suppliers/suppliers.controller.ts`:

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
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequiresRole } from '../../common/decorators/requires-role.decorator';

@ApiTags('suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private suppliersService: SuppliersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar fornecedores' })
  findAll() {
    return this.suppliersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do fornecedor' })
  findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @RequiresRole(SystemRole.ADMIN)
  @ApiOperation({ summary: 'Criar fornecedor (Admin)' })
  create(@Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @RequiresRole(SystemRole.ADMIN)
  @ApiOperation({ summary: 'Atualizar fornecedor (Admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @RequiresRole(SystemRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir fornecedor (soft delete, Admin)' })
  remove(@Param('id') id: string) {
    return this.suppliersService.remove(id);
  }
}
```

`financial-control/backend/src/modules/suppliers/suppliers.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
```

Em `financial-control/backend/src/app.module.ts`, adicionar o import e registrar (mesmo padrão dos módulos existentes):

```typescript
import { SuppliersModule } from './modules/suppliers/suppliers.module';
// ... no array imports do @Module, após ProjectsModule:
    SuppliersModule,
```

- [ ] **Step 4: Rodar os testes unitários e verificar que passam**

Run: `npm test -- suppliers.service`
Expected: PASS (6 testes)

- [ ] **Step 5: Criar helper E2E compartilhado**

`financial-control/backend/test/helpers/e2e-setup.ts`:

```typescript
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
```

- [ ] **Step 6: Escrever o teste E2E**

`financial-control/backend/test/suppliers.e2e-spec.ts`:

```typescript
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
```

- [ ] **Step 7: Rodar o E2E e verificar que passa**

Run: `npm run test:e2e -- suppliers`
Expected: PASS (4 testes). Requer PostgreSQL dev rodando.

- [ ] **Step 8: Commit**

```bash
git add financial-control/backend/src/common/utils financial-control/backend/src/modules/suppliers financial-control/backend/src/app.module.ts financial-control/backend/test/helpers/e2e-setup.ts financial-control/backend/test/suppliers.e2e-spec.ts
git commit -m "feat: módulo suppliers — CRUD com soft delete e verificação de dependências"
```

---

## Task 2: Backend — Módulo `clients` (CRUD global + associação a projetos)

**Files:**
- Create: `financial-control/backend/src/modules/clients/dto/create-client.dto.ts`
- Create: `financial-control/backend/src/modules/clients/dto/update-client.dto.ts`
- Create: `financial-control/backend/src/modules/clients/dto/assign-client.dto.ts`
- Create: `financial-control/backend/src/modules/clients/clients.service.ts`
- Create: `financial-control/backend/src/modules/clients/clients.controller.ts`
- Create: `financial-control/backend/src/modules/clients/project-clients.controller.ts`
- Create: `financial-control/backend/src/modules/clients/clients.module.ts`
- Create: `financial-control/backend/src/modules/clients/__tests__/clients.service.spec.ts`
- Create: `financial-control/backend/test/clients.e2e-spec.ts`
- Modify: `financial-control/backend/src/app.module.ts`

**Interfaces:**
- Consumes: `createUserAndLogin` (Task 1), guards da Fase 1.
- Produces: `ClientsService` (`findAll()`, `findOne(id)`, `create(dto)`, `update(id, dto)`, `remove(id)`, `findByProject(projectId)`, `assignToProject(projectId, clientId)`, `unassignFromProject(projectId, clientId)`). Rotas `/clients` e `/projects/:projectId/clients`.

- [ ] **Step 1: Escrever os testes unitários (falhando)**

`financial-control/backend/src/modules/clients/__tests__/clients.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ClientsService } from '../clients.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { PersonType } from '@prisma/client';
import { ConflictException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  client: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  project: { findFirst: jest.fn() },
  projectClient: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  transaction: { count: jest.fn() },
  budgetLine: { count: jest.fn() },
};

describe('ClientsService', () => {
  let service: ClientsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ClientsService>(ClientsService);
    jest.clearAllMocks();
  });

  it('should throw ConflictException for duplicate taxId on create', async () => {
    mockPrisma.client.findFirst.mockResolvedValue({ id: 'c1' });
    await expect(
      service.create({
        personType: PersonType.COMPANY,
        companyName: 'X',
        taxId: '12345678000190',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should block remove when client has budget lines', async () => {
    mockPrisma.client.findFirst.mockResolvedValue({ id: 'c1', deletedAt: null });
    mockPrisma.transaction.count.mockResolvedValue(0);
    mockPrisma.budgetLine.count.mockResolvedValue(3);

    await expect(service.remove('c1')).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException when assigning unknown client', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1' });
    mockPrisma.client.findFirst.mockResolvedValue(null);
    await expect(service.assignToProject('p1', 'nope')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw ConflictException when client already assigned', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1' });
    mockPrisma.client.findFirst.mockResolvedValue({ id: 'c1', deletedAt: null });
    mockPrisma.projectClient.findUnique.mockResolvedValue({ id: 'pc1' });
    await expect(service.assignToProject('p1', 'c1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('should block unassign when project has transactions for the client', async () => {
    mockPrisma.projectClient.findUnique.mockResolvedValue({ id: 'pc1' });
    mockPrisma.transaction.count.mockResolvedValue(1);
    mockPrisma.budgetLine.count.mockResolvedValue(0);
    await expect(service.unassignFromProject('p1', 'c1')).rejects.toThrow(
      ConflictException,
    );
    expect(mockPrisma.projectClient.delete).not.toHaveBeenCalled();
  });

  it('should unassign client without dependents', async () => {
    mockPrisma.projectClient.findUnique.mockResolvedValue({ id: 'pc1' });
    mockPrisma.transaction.count.mockResolvedValue(0);
    mockPrisma.budgetLine.count.mockResolvedValue(0);
    mockPrisma.projectClient.delete.mockResolvedValue({});

    await service.unassignFromProject('p1', 'c1');

    expect(mockPrisma.projectClient.delete).toHaveBeenCalledWith({
      where: { projectId_clientId: { projectId: 'p1', clientId: 'c1' } },
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e verificar que falha**

Run: `npm test -- clients.service`
Expected: FAIL — `Cannot find module '../clients.service'`

- [ ] **Step 3: Implementar DTOs, service, controllers e module**

`financial-control/backend/src/modules/clients/dto/create-client.dto.ts`:

```typescript
import {
  IsString,
  IsEnum,
  IsOptional,
  IsEmail,
  IsInt,
  IsNumber,
  IsBoolean,
  IsUrl,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PersonType, BankAccountType } from '@prisma/client';

export class CreateClientDto {
  @ApiProperty({ enum: PersonType })
  @IsEnum(PersonType)
  personType: PersonType;

  @ApiPropertyOptional({
    description: 'Obrigatório para pessoa jurídica (validado no service, só no create)',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tradeName?: string;

  @ApiPropertyOptional({
    description: 'Obrigatório para pessoa física (validado no service, só no create)',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @ApiProperty({ description: 'CPF ou CNPJ (somente dígitos)' })
  @IsString()
  @MinLength(11)
  taxId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stateRegistration?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  emailSecondary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mobile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  streetNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  complement?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  paymentTermDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pixKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAgency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccount?: string;

  @ApiPropertyOptional({ enum: BankAccountType })
  @IsOptional()
  @IsEnum(BankAccountType)
  bankAccountType?: BankAccountType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  responsibleUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isClient?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isSupplier?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

`financial-control/backend/src/modules/clients/dto/update-client.dto.ts`:

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateClientDto } from './create-client.dto';

export class UpdateClientDto extends PartialType(CreateClientDto) {}
```

`financial-control/backend/src/modules/clients/dto/assign-client.dto.ts`:

```typescript
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignClientDto {
  @ApiProperty({ description: 'ID do cliente já cadastrado' })
  @IsString()
  clientId: string;
}
```

`financial-control/backend/src/modules/clients/clients.service.ts`:

```typescript
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { throwConflictIfUniqueViolation } from '../../common/utils/prisma-errors';
import { assertPersonNames } from '../../common/utils/person-names.util';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.client.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, deletedAt: null },
    });
    if (!client) throw new NotFoundException(`Cliente ${id} não encontrado`);
    return client;
  }

  async create(dto: CreateClientDto) {
    assertPersonNames(dto);
    const exists = await this.prisma.client.findFirst({
      where: { taxId: dto.taxId, deletedAt: null },
    });
    if (exists) throw new ConflictException('CPF/CNPJ já cadastrado');
    try {
      return await this.prisma.client.create({ data: dto });
    } catch (error) {
      throwConflictIfUniqueViolation(error, 'CPF/CNPJ já cadastrado');
    }
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id);
    if (dto.taxId) {
      const exists = await this.prisma.client.findFirst({
        where: { taxId: dto.taxId, deletedAt: null, id: { not: id } },
      });
      if (exists) throw new ConflictException('CPF/CNPJ já cadastrado');
    }
    try {
      return await this.prisma.client.update({ where: { id }, data: dto });
    } catch (error) {
      throwConflictIfUniqueViolation(error, 'CPF/CNPJ já cadastrado');
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    const [txCount, blCount] = await Promise.all([
      this.prisma.transaction.count({ where: { clientId: id, deletedAt: null } }),
      this.prisma.budgetLine.count({ where: { clientId: id } }),
    ]);
    if (txCount + blCount > 0) {
      throw new ConflictException(
        'Cliente possui lançamentos ou linhas de orçamento vinculados — desative-o (isActive: false) em vez de excluir',
      );
    }
    await this.prisma.client.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async findByProject(projectId: string) {
    const rows = await this.prisma.projectClient.findMany({
      where: { projectId, client: { deletedAt: null } },
      include: { client: true },
    });
    return rows.map((r) => r.client);
  }

  async assignToProject(projectId: string, clientId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Projeto ${projectId} não encontrado`);

    const client = await this.prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
    });
    if (!client)
      throw new NotFoundException(`Cliente ${clientId} não encontrado`);

    const existing = await this.prisma.projectClient.findUnique({
      where: { projectId_clientId: { projectId, clientId } },
    });
    if (existing)
      throw new ConflictException('Cliente já está associado ao projeto');

    return this.prisma.projectClient.create({ data: { projectId, clientId } });
  }

  async unassignFromProject(projectId: string, clientId: string) {
    const pc = await this.prisma.projectClient.findUnique({
      where: { projectId_clientId: { projectId, clientId } },
    });
    if (!pc)
      throw new NotFoundException('Cliente não está associado ao projeto');

    const [txCount, blCount] = await Promise.all([
      this.prisma.transaction.count({
        where: { projectId, clientId, deletedAt: null },
      }),
      this.prisma.budgetLine.count({
        where: { clientId, budget: { projectId } },
      }),
    ]);
    if (txCount + blCount > 0) {
      throw new ConflictException(
        'Cliente possui lançamentos ou linhas de orçamento neste projeto — não é possível desassociar',
      );
    }

    await this.prisma.projectClient.delete({
      where: { projectId_clientId: { projectId, clientId } },
    });
  }
}
```

`financial-control/backend/src/modules/clients/clients.controller.ts`:

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
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequiresRole } from '../../common/decorators/requires-role.decorator';

@ApiTags('clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clients')
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar clientes' })
  findAll() {
    return this.clientsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do cliente' })
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @RequiresRole(SystemRole.ADMIN)
  @ApiOperation({ summary: 'Criar cliente (Admin)' })
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @RequiresRole(SystemRole.ADMIN)
  @ApiOperation({ summary: 'Atualizar cliente (Admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @RequiresRole(SystemRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir cliente (soft delete, Admin)' })
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }
}
```

`financial-control/backend/src/modules/clients/project-clients.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { ClientsService } from './clients.service';
import { AssignClientDto } from './dto/assign-client.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProjectAccessGuard } from '../../common/guards/project-access.guard';
import { RequiresProjectRole } from '../../common/decorators/requires-project-role.decorator';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller('projects/:projectId/clients')
export class ProjectClientsController {
  constructor(private clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar clientes associados ao projeto' })
  findByProject(@Param('projectId') projectId: string) {
    return this.clientsService.findByProject(projectId);
  }

  @Post()
  @RequiresProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Associar cliente ao projeto (Admin/Gestor)' })
  assign(@Param('projectId') projectId: string, @Body() dto: AssignClientDto) {
    return this.clientsService.assignToProject(projectId, dto.clientId);
  }

  @Delete(':clientId')
  @RequiresProjectRole(ProjectRole.GESTOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desassociar cliente do projeto (Admin/Gestor)' })
  unassign(
    @Param('projectId') projectId: string,
    @Param('clientId') clientId: string,
  ) {
    return this.clientsService.unassignFromProject(projectId, clientId);
  }
}
```

`financial-control/backend/src/modules/clients/clients.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ProjectClientsController } from './project-clients.controller';
import { ClientsService } from './clients.service';

@Module({
  controllers: [ClientsController, ProjectClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
```

Registrar em `app.module.ts` (import + array `imports`): `ClientsModule`.

- [ ] **Step 4: Rodar os testes unitários e verificar que passam**

Run: `npm test -- clients.service`
Expected: PASS (6 testes)

- [ ] **Step 5: Escrever o teste E2E**

`financial-control/backend/test/clients.e2e-spec.ts`:

```typescript
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
```

- [ ] **Step 6: Rodar o E2E e verificar que passa**

Run: `npm run test:e2e -- clients`
Expected: PASS (5 testes)

- [ ] **Step 7: Commit**

```bash
git add financial-control/backend/src/modules/clients financial-control/backend/src/app.module.ts financial-control/backend/test/clients.e2e-spec.ts
git commit -m "feat: módulo clients — CRUD global (Admin) e associação a projetos (Gestor)"
```

---

## Task 3: Backend — Módulo `bank-accounts` (CRUD global + associação a projetos)

**Files:**
- Create: `financial-control/backend/src/modules/bank-accounts/dto/create-bank-account.dto.ts`
- Create: `financial-control/backend/src/modules/bank-accounts/dto/update-bank-account.dto.ts`
- Create: `financial-control/backend/src/modules/bank-accounts/dto/assign-bank-account.dto.ts`
- Create: `financial-control/backend/src/modules/bank-accounts/bank-accounts.service.ts`
- Create: `financial-control/backend/src/modules/bank-accounts/bank-accounts.controller.ts`
- Create: `financial-control/backend/src/modules/bank-accounts/project-bank-accounts.controller.ts`
- Create: `financial-control/backend/src/modules/bank-accounts/bank-accounts.module.ts`
- Create: `financial-control/backend/src/modules/bank-accounts/__tests__/bank-accounts.service.spec.ts`
- Create: `financial-control/backend/test/bank-accounts.e2e-spec.ts`
- Modify: `financial-control/backend/src/app.module.ts`

**Interfaces:**
- Consumes: `createUserAndLogin` (Task 1), guards da Fase 1.
- Produces: `BankAccountsService` (`findAll()`, `findOne(id)`, `create(dto)`, `update(id, dto)`, `remove(id)`, `findByProject(projectId)`, `assignToProject(projectId, bankAccountId)`, `unassignFromProject(projectId, bankAccountId)`). Rotas `/bank-accounts` e `/projects/:projectId/bank-accounts`.
- Dependentes no `remove()` (conforme schema): `Transaction.bankAccountId` (com `deletedAt: null`), `BankStatement.bankAccountId` (modelo SEM `deletedAt` — contar sem filtro) e `CreditCard.paymentAccountId` (com `deletedAt: null`).

- [ ] **Step 1: Escrever os testes unitários (falhando)**

`financial-control/backend/src/modules/bank-accounts/__tests__/bank-accounts.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BankAccountsService } from '../bank-accounts.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { BankAccountType } from '@prisma/client';
import { ConflictException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  bankAccount: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  project: { findFirst: jest.fn() },
  projectBankAccount: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  transaction: { count: jest.fn() },
  bankStatement: { count: jest.fn() },
  creditCard: { count: jest.fn() },
};

describe('BankAccountsService', () => {
  let service: BankAccountsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankAccountsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<BankAccountsService>(BankAccountsService);
    jest.clearAllMocks();
  });

  it('should create a bank account converting initialDate to Date', async () => {
    mockPrisma.bankAccount.create.mockResolvedValue({ id: 'b1' });

    await service.create({
      name: 'Conta Principal',
      bankName: 'Banco X',
      accountType: BankAccountType.CHECKING,
      initialDate: '2026-01-01',
    });

    expect(mockPrisma.bankAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ initialDate: expect.any(Date) }),
    });
  });

  it('should block remove when account has statements', async () => {
    mockPrisma.bankAccount.findFirst.mockResolvedValue({ id: 'b1', deletedAt: null });
    mockPrisma.transaction.count.mockResolvedValue(0);
    mockPrisma.bankStatement.count.mockResolvedValue(1);
    mockPrisma.creditCard.count.mockResolvedValue(0);

    await expect(service.remove('b1')).rejects.toThrow(ConflictException);
    expect(mockPrisma.bankAccount.update).not.toHaveBeenCalled();
  });

  it('should block remove when account is payment account of a card', async () => {
    mockPrisma.bankAccount.findFirst.mockResolvedValue({ id: 'b1', deletedAt: null });
    mockPrisma.transaction.count.mockResolvedValue(0);
    mockPrisma.bankStatement.count.mockResolvedValue(0);
    mockPrisma.creditCard.count.mockResolvedValue(1);

    await expect(service.remove('b1')).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException when assigning unknown account', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1' });
    mockPrisma.bankAccount.findFirst.mockResolvedValue(null);
    await expect(service.assignToProject('p1', 'nope')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should block unassign when project has transactions for the account', async () => {
    mockPrisma.projectBankAccount.findUnique.mockResolvedValue({ id: 'pb1' });
    mockPrisma.transaction.count.mockResolvedValue(2);
    await expect(service.unassignFromProject('p1', 'b1')).rejects.toThrow(
      ConflictException,
    );
    expect(mockPrisma.projectBankAccount.delete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar o teste e verificar que falha**

Run: `npm test -- bank-accounts.service`
Expected: FAIL — `Cannot find module '../bank-accounts.service'`

- [ ] **Step 3: Implementar DTOs, service, controllers e module**

`financial-control/backend/src/modules/bank-accounts/dto/create-bank-account.dto.ts`:

```typescript
import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BankAccountType } from '@prisma/client';

export class CreateBankAccountDto {
  @ApiProperty({ example: 'Conta Corrente Principal' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'Banco do Brasil' })
  @IsString()
  @MinLength(2)
  bankName: string;

  @ApiPropertyOptional({ example: '001' })
  @IsOptional()
  @IsString()
  bankCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiProperty({ enum: BankAccountType })
  @IsEnum(BankAccountType)
  accountType: BankAccountType;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  initialBalance?: number;

  @ApiProperty({ example: '2026-01-01', description: 'Data do saldo inicial' })
  @IsDateString()
  initialDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  openFinanceId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

`financial-control/backend/src/modules/bank-accounts/dto/update-bank-account.dto.ts`:

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateBankAccountDto } from './create-bank-account.dto';

export class UpdateBankAccountDto extends PartialType(CreateBankAccountDto) {}
```

`financial-control/backend/src/modules/bank-accounts/dto/assign-bank-account.dto.ts`:

```typescript
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignBankAccountDto {
  @ApiProperty({ description: 'ID da conta bancária já cadastrada' })
  @IsString()
  bankAccountId: string;
}
```

`financial-control/backend/src/modules/bank-accounts/bank-accounts.service.ts`:

```typescript
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';

@Injectable()
export class BankAccountsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.bankAccount.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id, deletedAt: null },
    });
    if (!account)
      throw new NotFoundException(`Conta bancária ${id} não encontrada`);
    return account;
  }

  async create(dto: CreateBankAccountDto) {
    const { initialDate, ...rest } = dto;
    return this.prisma.bankAccount.create({
      data: { ...rest, initialDate: new Date(initialDate) },
    });
  }

  async update(id: string, dto: UpdateBankAccountDto) {
    await this.findOne(id);
    const { initialDate, ...rest } = dto;
    return this.prisma.bankAccount.update({
      where: { id },
      data: {
        ...rest,
        ...(initialDate ? { initialDate: new Date(initialDate) } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    // BankStatement não tem deletedAt no schema — contar sem filtro
    const [txCount, stmtCount, cardCount] = await Promise.all([
      this.prisma.transaction.count({
        where: { bankAccountId: id, deletedAt: null },
      }),
      this.prisma.bankStatement.count({ where: { bankAccountId: id } }),
      this.prisma.creditCard.count({
        where: { paymentAccountId: id, deletedAt: null },
      }),
    ]);
    if (txCount + stmtCount + cardCount > 0) {
      throw new ConflictException(
        'Conta bancária possui lançamentos, extratos ou cartões vinculados — desative-a (isActive: false) em vez de excluir',
      );
    }
    await this.prisma.bankAccount.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async findByProject(projectId: string) {
    const rows = await this.prisma.projectBankAccount.findMany({
      where: { projectId, bankAccount: { deletedAt: null } },
      include: { bankAccount: true },
    });
    return rows.map((r) => r.bankAccount);
  }

  async assignToProject(projectId: string, bankAccountId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Projeto ${projectId} não encontrado`);

    const account = await this.prisma.bankAccount.findFirst({
      where: { id: bankAccountId, deletedAt: null },
    });
    if (!account)
      throw new NotFoundException(
        `Conta bancária ${bankAccountId} não encontrada`,
      );

    const existing = await this.prisma.projectBankAccount.findUnique({
      where: { projectId_bankAccountId: { projectId, bankAccountId } },
    });
    if (existing)
      throw new ConflictException('Conta bancária já está associada ao projeto');

    return this.prisma.projectBankAccount.create({
      data: { projectId, bankAccountId },
    });
  }

  async unassignFromProject(projectId: string, bankAccountId: string) {
    const pba = await this.prisma.projectBankAccount.findUnique({
      where: { projectId_bankAccountId: { projectId, bankAccountId } },
    });
    if (!pba)
      throw new NotFoundException('Conta bancária não está associada ao projeto');

    // BudgetLine não referencia conta bancária — só Transaction bloqueia
    const txCount = await this.prisma.transaction.count({
      where: { projectId, bankAccountId, deletedAt: null },
    });
    if (txCount > 0) {
      throw new ConflictException(
        'Conta bancária possui lançamentos neste projeto — não é possível desassociar',
      );
    }

    await this.prisma.projectBankAccount.delete({
      where: { projectId_bankAccountId: { projectId, bankAccountId } },
    });
  }
}
```

`financial-control/backend/src/modules/bank-accounts/bank-accounts.controller.ts`:

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
import { BankAccountsService } from './bank-accounts.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequiresRole } from '../../common/decorators/requires-role.decorator';

@ApiTags('bank-accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bank-accounts')
export class BankAccountsController {
  constructor(private bankAccountsService: BankAccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar contas bancárias' })
  findAll() {
    return this.bankAccountsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe da conta bancária' })
  findOne(@Param('id') id: string) {
    return this.bankAccountsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @RequiresRole(SystemRole.ADMIN)
  @ApiOperation({ summary: 'Criar conta bancária (Admin)' })
  create(@Body() dto: CreateBankAccountDto) {
    return this.bankAccountsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @RequiresRole(SystemRole.ADMIN)
  @ApiOperation({ summary: 'Atualizar conta bancária (Admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateBankAccountDto) {
    return this.bankAccountsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @RequiresRole(SystemRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir conta bancária (soft delete, Admin)' })
  remove(@Param('id') id: string) {
    return this.bankAccountsService.remove(id);
  }
}
```

`financial-control/backend/src/modules/bank-accounts/project-bank-accounts.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { BankAccountsService } from './bank-accounts.service';
import { AssignBankAccountDto } from './dto/assign-bank-account.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProjectAccessGuard } from '../../common/guards/project-access.guard';
import { RequiresProjectRole } from '../../common/decorators/requires-project-role.decorator';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller('projects/:projectId/bank-accounts')
export class ProjectBankAccountsController {
  constructor(private bankAccountsService: BankAccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar contas bancárias associadas ao projeto' })
  findByProject(@Param('projectId') projectId: string) {
    return this.bankAccountsService.findByProject(projectId);
  }

  @Post()
  @RequiresProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Associar conta bancária ao projeto (Admin/Gestor)' })
  assign(
    @Param('projectId') projectId: string,
    @Body() dto: AssignBankAccountDto,
  ) {
    return this.bankAccountsService.assignToProject(projectId, dto.bankAccountId);
  }

  @Delete(':bankAccountId')
  @RequiresProjectRole(ProjectRole.GESTOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desassociar conta bancária do projeto (Admin/Gestor)' })
  unassign(
    @Param('projectId') projectId: string,
    @Param('bankAccountId') bankAccountId: string,
  ) {
    return this.bankAccountsService.unassignFromProject(projectId, bankAccountId);
  }
}
```

`financial-control/backend/src/modules/bank-accounts/bank-accounts.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { BankAccountsController } from './bank-accounts.controller';
import { ProjectBankAccountsController } from './project-bank-accounts.controller';
import { BankAccountsService } from './bank-accounts.service';

@Module({
  controllers: [BankAccountsController, ProjectBankAccountsController],
  providers: [BankAccountsService],
  exports: [BankAccountsService],
})
export class BankAccountsModule {}
```

Registrar em `app.module.ts` (import + array `imports`): `BankAccountsModule`.

- [ ] **Step 4: Rodar os testes unitários e verificar que passam**

Run: `npm test -- bank-accounts.service`
Expected: PASS (5 testes)

- [ ] **Step 5: Escrever o teste E2E**

`financial-control/backend/test/bank-accounts.e2e-spec.ts`:

```typescript
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
```

- [ ] **Step 6: Rodar o E2E e verificar que passa**

Run: `npm run test:e2e -- bank-accounts`
Expected: PASS (4 testes)

- [ ] **Step 7: Commit**

```bash
git add financial-control/backend/src/modules/bank-accounts financial-control/backend/src/app.module.ts financial-control/backend/test/bank-accounts.e2e-spec.ts
git commit -m "feat: módulo bank-accounts — CRUD global (Admin) e associação a projetos (Gestor)"
```

---

## Task 4: Backend — Módulo `credit-cards` (CRUD global + associação a projetos)

**Files:**
- Create: `financial-control/backend/src/modules/credit-cards/dto/create-credit-card.dto.ts`
- Create: `financial-control/backend/src/modules/credit-cards/dto/update-credit-card.dto.ts`
- Create: `financial-control/backend/src/modules/credit-cards/dto/assign-credit-card.dto.ts`
- Create: `financial-control/backend/src/modules/credit-cards/credit-cards.service.ts`
- Create: `financial-control/backend/src/modules/credit-cards/credit-cards.controller.ts`
- Create: `financial-control/backend/src/modules/credit-cards/project-credit-cards.controller.ts`
- Create: `financial-control/backend/src/modules/credit-cards/credit-cards.module.ts`
- Create: `financial-control/backend/src/modules/credit-cards/__tests__/credit-cards.service.spec.ts`
- Create: `financial-control/backend/test/credit-cards.e2e-spec.ts`
- Modify: `financial-control/backend/src/app.module.ts`

**Interfaces:**
- Consumes: `createUserAndLogin` (Task 1), guards da Fase 1.
- Produces: `CreditCardsService` (mesma assinatura de `BankAccountsService`, trocando `bankAccountId` por `creditCardId`). Rotas `/credit-cards` e `/projects/:projectId/credit-cards`.
- Regra extra: `paymentAccountId` (se informado no create/update) deve referenciar uma `BankAccount` ativa — senão `404`.

- [ ] **Step 1: Escrever os testes unitários (falhando)**

`financial-control/backend/src/modules/credit-cards/__tests__/credit-cards.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { CreditCardsService } from '../credit-cards.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CardBrand } from '@prisma/client';
import { ConflictException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  creditCard: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  bankAccount: { findFirst: jest.fn() },
  project: { findFirst: jest.fn() },
  projectCreditCard: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  transaction: { count: jest.fn() },
};

const baseDto = {
  name: 'Cartão Corporativo',
  brand: CardBrand.VISA,
  lastFourDigits: '1234',
  creditLimit: 10000,
  billingDay: 10,
  closingDay: 3,
};

describe('CreditCardsService', () => {
  let service: CreditCardsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditCardsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<CreditCardsService>(CreditCardsService);
    jest.clearAllMocks();
  });

  it('should create a credit card', async () => {
    mockPrisma.creditCard.create.mockResolvedValue({ id: 'cc1' });
    const result = await service.create(baseDto);
    expect(result.id).toBe('cc1');
  });

  it('should throw NotFoundException for unknown paymentAccountId', async () => {
    mockPrisma.bankAccount.findFirst.mockResolvedValue(null);
    await expect(
      service.create({ ...baseDto, paymentAccountId: 'nope' }),
    ).rejects.toThrow(NotFoundException);
    expect(mockPrisma.creditCard.create).not.toHaveBeenCalled();
  });

  it('should block remove when card has transactions', async () => {
    mockPrisma.creditCard.findFirst.mockResolvedValue({ id: 'cc1', deletedAt: null });
    mockPrisma.transaction.count.mockResolvedValue(1);
    await expect(service.remove('cc1')).rejects.toThrow(ConflictException);
    expect(mockPrisma.creditCard.update).not.toHaveBeenCalled();
  });

  it('should block unassign when project has transactions for the card', async () => {
    mockPrisma.projectCreditCard.findUnique.mockResolvedValue({ id: 'pc1' });
    mockPrisma.transaction.count.mockResolvedValue(1);
    await expect(service.unassignFromProject('p1', 'cc1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('should throw ConflictException when card already assigned', async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1' });
    mockPrisma.creditCard.findFirst.mockResolvedValue({ id: 'cc1', deletedAt: null });
    mockPrisma.projectCreditCard.findUnique.mockResolvedValue({ id: 'pc1' });
    await expect(service.assignToProject('p1', 'cc1')).rejects.toThrow(
      ConflictException,
    );
  });
});
```

- [ ] **Step 2: Rodar o teste e verificar que falha**

Run: `npm test -- credit-cards.service`
Expected: FAIL — `Cannot find module '../credit-cards.service'`

- [ ] **Step 3: Implementar DTOs, service, controllers e module**

`financial-control/backend/src/modules/credit-cards/dto/create-credit-card.dto.ts`:

```typescript
import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsInt,
  IsBoolean,
  Min,
  Max,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CardBrand } from '@prisma/client';

export class CreateCreditCardDto {
  @ApiProperty({ example: 'Cartão Corporativo' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ enum: CardBrand })
  @IsEnum(CardBrand)
  brand: CardBrand;

  @ApiProperty({ example: '1234' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'lastFourDigits deve conter exatamente 4 dígitos' })
  lastFourDigits: string;

  @ApiProperty({ example: 10000 })
  @IsNumber()
  @Min(0)
  creditLimit: number;

  @ApiProperty({ example: 10, description: 'Dia do vencimento da fatura (1-31)' })
  @IsInt()
  @Min(1)
  @Max(31)
  billingDay: number;

  @ApiProperty({ example: 3, description: 'Dia do fechamento da fatura (1-31)' })
  @IsInt()
  @Min(1)
  @Max(31)
  closingDay: number;

  @ApiPropertyOptional({ description: 'Conta bancária de pagamento da fatura' })
  @IsOptional()
  @IsString()
  paymentAccountId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

`financial-control/backend/src/modules/credit-cards/dto/update-credit-card.dto.ts`:

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateCreditCardDto } from './create-credit-card.dto';

export class UpdateCreditCardDto extends PartialType(CreateCreditCardDto) {}
```

`financial-control/backend/src/modules/credit-cards/dto/assign-credit-card.dto.ts`:

```typescript
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignCreditCardDto {
  @ApiProperty({ description: 'ID do cartão já cadastrado' })
  @IsString()
  creditCardId: string;
}
```

`financial-control/backend/src/modules/credit-cards/credit-cards.service.ts`:

```typescript
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCreditCardDto } from './dto/create-credit-card.dto';
import { UpdateCreditCardDto } from './dto/update-credit-card.dto';

@Injectable()
export class CreditCardsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.creditCard.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const card = await this.prisma.creditCard.findFirst({
      where: { id, deletedAt: null },
    });
    if (!card) throw new NotFoundException(`Cartão ${id} não encontrado`);
    return card;
  }

  private async assertPaymentAccount(paymentAccountId?: string) {
    if (!paymentAccountId) return;
    const account = await this.prisma.bankAccount.findFirst({
      where: { id: paymentAccountId, deletedAt: null },
      select: { id: true },
    });
    if (!account)
      throw new NotFoundException(
        `Conta bancária ${paymentAccountId} não encontrada`,
      );
  }

  async create(dto: CreateCreditCardDto) {
    await this.assertPaymentAccount(dto.paymentAccountId);
    return this.prisma.creditCard.create({ data: dto });
  }

  async update(id: string, dto: UpdateCreditCardDto) {
    await this.findOne(id);
    await this.assertPaymentAccount(dto.paymentAccountId);
    return this.prisma.creditCard.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    // BudgetLine não referencia cartão — só Transaction bloqueia
    const txCount = await this.prisma.transaction.count({
      where: { creditCardId: id, deletedAt: null },
    });
    if (txCount > 0) {
      throw new ConflictException(
        'Cartão possui lançamentos vinculados — desative-o (isActive: false) em vez de excluir',
      );
    }
    await this.prisma.creditCard.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async findByProject(projectId: string) {
    const rows = await this.prisma.projectCreditCard.findMany({
      where: { projectId, creditCard: { deletedAt: null } },
      include: { creditCard: true },
    });
    return rows.map((r) => r.creditCard);
  }

  async assignToProject(projectId: string, creditCardId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Projeto ${projectId} não encontrado`);

    const card = await this.prisma.creditCard.findFirst({
      where: { id: creditCardId, deletedAt: null },
    });
    if (!card)
      throw new NotFoundException(`Cartão ${creditCardId} não encontrado`);

    const existing = await this.prisma.projectCreditCard.findUnique({
      where: { projectId_creditCardId: { projectId, creditCardId } },
    });
    if (existing)
      throw new ConflictException('Cartão já está associado ao projeto');

    return this.prisma.projectCreditCard.create({
      data: { projectId, creditCardId },
    });
  }

  async unassignFromProject(projectId: string, creditCardId: string) {
    const pcc = await this.prisma.projectCreditCard.findUnique({
      where: { projectId_creditCardId: { projectId, creditCardId } },
    });
    if (!pcc)
      throw new NotFoundException('Cartão não está associado ao projeto');

    const txCount = await this.prisma.transaction.count({
      where: { projectId, creditCardId, deletedAt: null },
    });
    if (txCount > 0) {
      throw new ConflictException(
        'Cartão possui lançamentos neste projeto — não é possível desassociar',
      );
    }

    await this.prisma.projectCreditCard.delete({
      where: { projectId_creditCardId: { projectId, creditCardId } },
    });
  }
}
```

`financial-control/backend/src/modules/credit-cards/credit-cards.controller.ts`:

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
import { CreditCardsService } from './credit-cards.service';
import { CreateCreditCardDto } from './dto/create-credit-card.dto';
import { UpdateCreditCardDto } from './dto/update-credit-card.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequiresRole } from '../../common/decorators/requires-role.decorator';

@ApiTags('credit-cards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('credit-cards')
export class CreditCardsController {
  constructor(private creditCardsService: CreditCardsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar cartões de crédito' })
  findAll() {
    return this.creditCardsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do cartão' })
  findOne(@Param('id') id: string) {
    return this.creditCardsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @RequiresRole(SystemRole.ADMIN)
  @ApiOperation({ summary: 'Criar cartão (Admin)' })
  create(@Body() dto: CreateCreditCardDto) {
    return this.creditCardsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @RequiresRole(SystemRole.ADMIN)
  @ApiOperation({ summary: 'Atualizar cartão (Admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateCreditCardDto) {
    return this.creditCardsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @RequiresRole(SystemRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir cartão (soft delete, Admin)' })
  remove(@Param('id') id: string) {
    return this.creditCardsService.remove(id);
  }
}
```

`financial-control/backend/src/modules/credit-cards/project-credit-cards.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { CreditCardsService } from './credit-cards.service';
import { AssignCreditCardDto } from './dto/assign-credit-card.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProjectAccessGuard } from '../../common/guards/project-access.guard';
import { RequiresProjectRole } from '../../common/decorators/requires-project-role.decorator';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller('projects/:projectId/credit-cards')
export class ProjectCreditCardsController {
  constructor(private creditCardsService: CreditCardsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar cartões associados ao projeto' })
  findByProject(@Param('projectId') projectId: string) {
    return this.creditCardsService.findByProject(projectId);
  }

  @Post()
  @RequiresProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Associar cartão ao projeto (Admin/Gestor)' })
  assign(
    @Param('projectId') projectId: string,
    @Body() dto: AssignCreditCardDto,
  ) {
    return this.creditCardsService.assignToProject(projectId, dto.creditCardId);
  }

  @Delete(':creditCardId')
  @RequiresProjectRole(ProjectRole.GESTOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desassociar cartão do projeto (Admin/Gestor)' })
  unassign(
    @Param('projectId') projectId: string,
    @Param('creditCardId') creditCardId: string,
  ) {
    return this.creditCardsService.unassignFromProject(projectId, creditCardId);
  }
}
```

`financial-control/backend/src/modules/credit-cards/credit-cards.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { CreditCardsController } from './credit-cards.controller';
import { ProjectCreditCardsController } from './project-credit-cards.controller';
import { CreditCardsService } from './credit-cards.service';

@Module({
  controllers: [CreditCardsController, ProjectCreditCardsController],
  providers: [CreditCardsService],
  exports: [CreditCardsService],
})
export class CreditCardsModule {}
```

Registrar em `app.module.ts` (import + array `imports`): `CreditCardsModule`.

- [ ] **Step 4: Rodar os testes unitários e verificar que passam**

Run: `npm test -- credit-cards.service`
Expected: PASS (5 testes)

- [ ] **Step 5: Escrever o teste E2E**

`financial-control/backend/test/credit-cards.e2e-spec.ts`:

```typescript
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
```

- [ ] **Step 6: Rodar o E2E e verificar que passa**

Run: `npm run test:e2e -- credit-cards`
Expected: PASS (4 testes)

- [ ] **Step 7: Commit**

```bash
git add financial-control/backend/src/modules/credit-cards financial-control/backend/src/app.module.ts financial-control/backend/test/credit-cards.e2e-spec.ts
git commit -m "feat: módulo credit-cards — CRUD global (Admin) e associação a projetos (Gestor)"
```

---

## Task 5: Backend — Módulo `account-categories` (Plano de Contas hierárquico, por projeto)

**Files:**
- Create: `financial-control/backend/src/modules/account-categories/dto/create-account-category.dto.ts`
- Create: `financial-control/backend/src/modules/account-categories/dto/update-account-category.dto.ts`
- Create: `financial-control/backend/src/modules/account-categories/account-categories.service.ts`
- Create: `financial-control/backend/src/modules/account-categories/account-categories.controller.ts`
- Create: `financial-control/backend/src/modules/account-categories/account-categories.module.ts`
- Create: `financial-control/backend/src/modules/account-categories/__tests__/account-categories.service.spec.ts`
- Create: `financial-control/backend/test/account-categories.e2e-spec.ts`
- Modify: `financial-control/backend/src/app.module.ts`

**Interfaces:**
- Consumes: `throwConflictIfUniqueViolation` (Task 1), `createUserAndLogin` (Task 1), guards da Fase 1.
- Produces: `AccountCategoriesService` (`findByProject(projectId)`, `create(projectId, dto)`, `update(projectId, id, dto)`, `remove(projectId, id)`). Rota `/projects/:projectId/account-categories`.
- Regras de hierarquia: níveis `PACKAGE` (1) → `CATEGORY` (2) → `SUBCATEGORY` (3). `PACKAGE` não tem `parentId`; `CATEGORY`/`SUBCATEGORY` exigem `parentId`. O pai deve pertencer ao mesmo projeto e ter nível imediatamente acima. `code` é único por projeto. Excluir categoria com filhos ativos → `409`; excluir categoria usada em `Transaction`/`BudgetLine` → `409`.

- [ ] **Step 1: Escrever os testes unitários (falhando)**

`financial-control/backend/src/modules/account-categories/__tests__/account-categories.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AccountCategoriesService } from '../account-categories.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CategoryLevel, CategoryType } from '@prisma/client';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  project: { findFirst: jest.fn() },
  accountCategory: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  transaction: { count: jest.fn() },
  budgetLine: { count: jest.fn() },
};

describe('AccountCategoriesService', () => {
  let service: AccountCategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountCategoriesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<AccountCategoriesService>(AccountCategoriesService);
    jest.clearAllMocks();
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1' });
  });

  it('should create a PACKAGE without parent', async () => {
    mockPrisma.accountCategory.create.mockResolvedValue({ id: 'c1' });
    const result = await service.create('p1', {
      code: '1',
      name: 'Receitas',
      type: CategoryType.REVENUE,
      level: CategoryLevel.PACKAGE,
    });
    expect(result.id).toBe('c1');
  });

  it('should reject PACKAGE with a parentId', async () => {
    await expect(
      service.create('p1', {
        code: '1',
        name: 'X',
        type: CategoryType.REVENUE,
        level: CategoryLevel.PACKAGE,
        parentId: 'somebody',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject CATEGORY without a parentId', async () => {
    await expect(
      service.create('p1', {
        code: '1.1',
        name: 'X',
        type: CategoryType.REVENUE,
        level: CategoryLevel.CATEGORY,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject CATEGORY whose parent is not a PACKAGE', async () => {
    // parent existe mas é do nível errado (CATEGORY, não PACKAGE)
    mockPrisma.accountCategory.findFirst.mockResolvedValue({
      id: 'parent',
      projectId: 'p1',
      level: CategoryLevel.CATEGORY,
    });
    await expect(
      service.create('p1', {
        code: '1.1',
        name: 'X',
        type: CategoryType.REVENUE,
        level: CategoryLevel.CATEGORY,
        parentId: 'parent',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject when parent belongs to another project', async () => {
    mockPrisma.accountCategory.findFirst.mockResolvedValue(null); // não achou no projeto p1
    await expect(
      service.create('p1', {
        code: '1.1',
        name: 'X',
        type: CategoryType.REVENUE,
        level: CategoryLevel.CATEGORY,
        parentId: 'parent-de-outro-projeto',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should create a CATEGORY with a valid PACKAGE parent', async () => {
    mockPrisma.accountCategory.findFirst.mockResolvedValue({
      id: 'parent',
      projectId: 'p1',
      level: CategoryLevel.PACKAGE,
    });
    mockPrisma.accountCategory.create.mockResolvedValue({ id: 'c2' });
    const result = await service.create('p1', {
      code: '1.1',
      name: 'Vendas',
      type: CategoryType.REVENUE,
      level: CategoryLevel.CATEGORY,
      parentId: 'parent',
    });
    expect(result.id).toBe('c2');
  });

  it('should block moving a node that has active children', async () => {
    // current é um PACKAGE com filhos ativos; tenta virar CATEGORY
    mockPrisma.accountCategory.findFirst.mockResolvedValue({
      id: 'c1',
      projectId: 'p1',
      level: CategoryLevel.PACKAGE,
      parentId: null,
      deletedAt: null,
    });
    mockPrisma.accountCategory.count.mockResolvedValue(2); // filhos ativos
    await expect(
      service.update('p1', 'c1', {
        level: CategoryLevel.CATEGORY,
        parentId: 'outro-pacote',
      }),
    ).rejects.toThrow(ConflictException);
    expect(mockPrisma.accountCategory.update).not.toHaveBeenCalled();
  });

  it('should block remove when category has active children', async () => {
    mockPrisma.accountCategory.findFirst.mockResolvedValue({
      id: 'c1',
      projectId: 'p1',
      deletedAt: null,
    });
    mockPrisma.accountCategory.count.mockResolvedValue(2); // filhos
    await expect(service.remove('p1', 'c1')).rejects.toThrow(ConflictException);
    expect(mockPrisma.accountCategory.update).not.toHaveBeenCalled();
  });

  it('should block remove when category is used in transactions', async () => {
    mockPrisma.accountCategory.findFirst.mockResolvedValue({
      id: 'c1',
      projectId: 'p1',
      deletedAt: null,
    });
    mockPrisma.accountCategory.count.mockResolvedValue(0);
    mockPrisma.transaction.count.mockResolvedValue(1);
    mockPrisma.budgetLine.count.mockResolvedValue(0);
    await expect(service.remove('p1', 'c1')).rejects.toThrow(ConflictException);
  });

  it('should soft-delete a leaf category with no usage', async () => {
    mockPrisma.accountCategory.findFirst.mockResolvedValue({
      id: 'c1',
      projectId: 'p1',
      deletedAt: null,
    });
    mockPrisma.accountCategory.count.mockResolvedValue(0);
    mockPrisma.transaction.count.mockResolvedValue(0);
    mockPrisma.budgetLine.count.mockResolvedValue(0);
    mockPrisma.accountCategory.update.mockResolvedValue({});

    await service.remove('p1', 'c1');

    expect(mockPrisma.accountCategory.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { deletedAt: expect.any(Date), isActive: false },
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e verificar que falha**

Run: `npm test -- account-categories.service`
Expected: FAIL — `Cannot find module '../account-categories.service'`

- [ ] **Step 3: Implementar DTOs, service, controller e module**

`financial-control/backend/src/modules/account-categories/dto/create-account-category.dto.ts`:

```typescript
import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryType, CategoryLevel } from '@prisma/client';

export class CreateAccountCategoryDto {
  @ApiProperty({ example: '1.1', description: 'Código único dentro do projeto' })
  @IsString()
  @MinLength(1)
  code: string;

  @ApiProperty({ example: 'Vendas de Produtos' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ enum: CategoryType })
  @IsEnum(CategoryType)
  type: CategoryType;

  @ApiProperty({ enum: CategoryLevel })
  @IsEnum(CategoryLevel)
  level: CategoryLevel;

  @ApiPropertyOptional({
    description: 'Obrigatório para CATEGORY e SUBCATEGORY; ausente em PACKAGE',
  })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

`financial-control/backend/src/modules/account-categories/dto/update-account-category.dto.ts`:

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateAccountCategoryDto } from './create-account-category.dto';

export class UpdateAccountCategoryDto extends PartialType(
  CreateAccountCategoryDto,
) {}
```

`financial-control/backend/src/modules/account-categories/account-categories.service.ts`:

```typescript
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAccountCategoryDto } from './dto/create-account-category.dto';
import { UpdateAccountCategoryDto } from './dto/update-account-category.dto';
import { throwConflictIfUniqueViolation } from '../../common/utils/prisma-errors';
import { CategoryLevel } from '@prisma/client';

const LEVEL_RANK: Record<CategoryLevel, number> = {
  [CategoryLevel.PACKAGE]: 1,
  [CategoryLevel.CATEGORY]: 2,
  [CategoryLevel.SUBCATEGORY]: 3,
};

@Injectable()
export class AccountCategoriesService {
  constructor(private prisma: PrismaService) {}

  private async assertProject(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Projeto ${projectId} não encontrado`);
  }

  /**
   * Valida a coerência entre level e parentId e retorna nada.
   * PACKAGE não pode ter pai; CATEGORY/SUBCATEGORY exigem pai do nível
   * imediatamente acima, no mesmo projeto.
   */
  private async assertHierarchy(
    projectId: string,
    level: CategoryLevel,
    parentId?: string,
  ) {
    if (level === CategoryLevel.PACKAGE) {
      if (parentId) {
        throw new BadRequestException(
          'Um pacote (PACKAGE) não pode ter categoria pai',
        );
      }
      return;
    }

    if (!parentId) {
      throw new BadRequestException(
        `Nível ${level} exige uma categoria pai (parentId)`,
      );
    }

    const parent = await this.prisma.accountCategory.findFirst({
      where: { id: parentId, projectId, deletedAt: null },
      select: { id: true, level: true },
    });
    if (!parent) {
      throw new NotFoundException(
        `Categoria pai ${parentId} não encontrada neste projeto`,
      );
    }
    if (LEVEL_RANK[parent.level] !== LEVEL_RANK[level] - 1) {
      throw new BadRequestException(
        `Categoria pai deve ser do nível imediatamente acima de ${level}`,
      );
    }
  }

  async findByProject(projectId: string) {
    await this.assertProject(projectId);
    return this.prisma.accountCategory.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { code: 'asc' },
    });
  }

  async findOneInProject(projectId: string, id: string) {
    const category = await this.prisma.accountCategory.findFirst({
      where: { id, projectId, deletedAt: null },
    });
    if (!category)
      throw new NotFoundException(`Categoria ${id} não encontrada neste projeto`);
    return category;
  }

  async create(projectId: string, dto: CreateAccountCategoryDto) {
    await this.assertProject(projectId);
    await this.assertHierarchy(projectId, dto.level, dto.parentId);
    try {
      return await this.prisma.accountCategory.create({
        data: { ...dto, projectId },
      });
    } catch (error) {
      throwConflictIfUniqueViolation(
        error,
        `Código '${dto.code}' já existe neste projeto`,
      );
    }
  }

  async update(projectId: string, id: string, dto: UpdateAccountCategoryDto) {
    const current = await this.findOneInProject(projectId, id);
    const nextLevel = dto.level ?? current.level;
    const levelChanged = dto.level !== undefined && dto.level !== current.level;
    const parentChanged =
      dto.parentId !== undefined && dto.parentId !== current.parentId;

    // Só revalida hierarquia se level ou parentId mudaram
    if (levelChanged || parentChanged) {
      // Reposicionar um nó que tem filhos ativos quebraria a coerência de
      // níveis da subárvore — bloqueia até que os filhos sejam movidos/removidos.
      const childCount = await this.prisma.accountCategory.count({
        where: { parentId: id, deletedAt: null },
      });
      if (childCount > 0) {
        throw new ConflictException(
          'Não é possível mudar o nível ou o pai de uma categoria que possui subcategorias ativas',
        );
      }
      const nextParent =
        dto.parentId !== undefined ? dto.parentId : current.parentId ?? undefined;
      await this.assertHierarchy(projectId, nextLevel, nextParent);
    }
    try {
      return await this.prisma.accountCategory.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      throwConflictIfUniqueViolation(
        error,
        `Código '${dto.code}' já existe neste projeto`,
      );
    }
  }

  async remove(projectId: string, id: string) {
    await this.findOneInProject(projectId, id);

    const childCount = await this.prisma.accountCategory.count({
      where: { parentId: id, deletedAt: null },
    });
    if (childCount > 0) {
      throw new ConflictException(
        'Categoria possui subcategorias ativas — exclua ou mova os filhos antes',
      );
    }

    const [txCount, blCount] = await Promise.all([
      this.prisma.transaction.count({ where: { categoryId: id, deletedAt: null } }),
      this.prisma.budgetLine.count({ where: { categoryId: id } }),
    ]);
    if (txCount + blCount > 0) {
      throw new ConflictException(
        'Categoria é usada em lançamentos ou orçamento — desative-a (isActive: false) em vez de excluir',
      );
    }

    await this.prisma.accountCategory.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
```

`financial-control/backend/src/modules/account-categories/account-categories.controller.ts`:

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
import { ProjectRole } from '@prisma/client';
import { AccountCategoriesService } from './account-categories.service';
import { CreateAccountCategoryDto } from './dto/create-account-category.dto';
import { UpdateAccountCategoryDto } from './dto/update-account-category.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProjectAccessGuard } from '../../common/guards/project-access.guard';
import { RequiresProjectRole } from '../../common/decorators/requires-project-role.decorator';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller('projects/:projectId/account-categories')
export class AccountCategoriesController {
  constructor(private service: AccountCategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar plano de contas do projeto' })
  findByProject(@Param('projectId') projectId: string) {
    return this.service.findByProject(projectId);
  }

  @Post()
  @RequiresProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Criar categoria (Admin/Gestor)' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateAccountCategoryDto,
  ) {
    return this.service.create(projectId, dto);
  }

  @Patch(':id')
  @RequiresProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Atualizar categoria (Admin/Gestor)' })
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAccountCategoryDto,
  ) {
    return this.service.update(projectId, id, dto);
  }

  @Delete(':id')
  @RequiresProjectRole(ProjectRole.GESTOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir categoria (soft delete, Admin/Gestor)' })
  remove(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.service.remove(projectId, id);
  }
}
```

`financial-control/backend/src/modules/account-categories/account-categories.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AccountCategoriesController } from './account-categories.controller';
import { AccountCategoriesService } from './account-categories.service';

@Module({
  controllers: [AccountCategoriesController],
  providers: [AccountCategoriesService],
  exports: [AccountCategoriesService],
})
export class AccountCategoriesModule {}
```

Registrar em `app.module.ts` (import + array `imports`): `AccountCategoriesModule`.

- [ ] **Step 4: Rodar os testes unitários e verificar que passam**

Run: `npm test -- account-categories.service`
Expected: PASS (10 testes)

- [ ] **Step 5: Escrever o teste E2E**

`financial-control/backend/test/account-categories.e2e-spec.ts`:

```typescript
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
```

- [ ] **Step 6: Rodar o E2E e verificar que passa**

Run: `npm run test:e2e -- account-categories`
Expected: PASS (6 testes)

- [ ] **Step 7: Commit**

```bash
git add financial-control/backend/src/modules/account-categories financial-control/backend/src/app.module.ts financial-control/backend/test/account-categories.e2e-spec.ts
git commit -m "feat: módulo account-categories — plano de contas hierárquico por projeto"
```

---

## Task 6: Backend — Módulo `cost-centers` (Centros de Custo, por projeto)

**Files:**
- Create: `financial-control/backend/src/modules/cost-centers/dto/create-cost-center.dto.ts`
- Create: `financial-control/backend/src/modules/cost-centers/dto/update-cost-center.dto.ts`
- Create: `financial-control/backend/src/modules/cost-centers/cost-centers.service.ts`
- Create: `financial-control/backend/src/modules/cost-centers/cost-centers.controller.ts`
- Create: `financial-control/backend/src/modules/cost-centers/cost-centers.module.ts`
- Create: `financial-control/backend/src/modules/cost-centers/__tests__/cost-centers.service.spec.ts`
- Create: `financial-control/backend/test/cost-centers.e2e-spec.ts`
- Modify: `financial-control/backend/src/app.module.ts`

**Interfaces:**
- Consumes: `throwConflictIfUniqueViolation` (Task 1), `createUserAndLogin` (Task 1), guards da Fase 1.
- Produces: `CostCentersService` (`findByProject(projectId)`, `findOneInProject(projectId, id)`, `create(projectId, dto)`, `update(projectId, id, dto)`, `remove(projectId, id)`). Rota `/projects/:projectId/cost-centers`. `code` único por projeto; sem hierarquia. Excluir usado em `Transaction`/`BudgetLine` → `409`.

- [ ] **Step 1: Escrever os testes unitários (falhando)**

`financial-control/backend/src/modules/cost-centers/__tests__/cost-centers.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { CostCentersService } from '../cost-centers.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  project: { findFirst: jest.fn() },
  costCenter: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  transaction: { count: jest.fn() },
  budgetLine: { count: jest.fn() },
};

describe('CostCentersService', () => {
  let service: CostCentersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CostCentersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<CostCentersService>(CostCentersService);
    jest.clearAllMocks();
    mockPrisma.project.findFirst.mockResolvedValue({ id: 'p1' });
  });

  it('should create a cost center', async () => {
    mockPrisma.costCenter.create.mockResolvedValue({ id: 'cc1' });
    const result = await service.create('p1', { code: 'ADM', name: 'Administrativo' });
    expect(result.id).toBe('cc1');
    expect(mockPrisma.costCenter.create).toHaveBeenCalledWith({
      data: { code: 'ADM', name: 'Administrativo', projectId: 'p1' },
    });
  });

  it('should throw NotFoundException for unknown project', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);
    await expect(
      service.create('nope', { code: 'X', name: 'Y' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should block remove when used in budget lines', async () => {
    mockPrisma.costCenter.findFirst.mockResolvedValue({ id: 'cc1', projectId: 'p1', deletedAt: null });
    mockPrisma.transaction.count.mockResolvedValue(0);
    mockPrisma.budgetLine.count.mockResolvedValue(2);
    await expect(service.remove('p1', 'cc1')).rejects.toThrow(ConflictException);
    expect(mockPrisma.costCenter.update).not.toHaveBeenCalled();
  });

  it('should soft-delete a cost center with no usage', async () => {
    mockPrisma.costCenter.findFirst.mockResolvedValue({ id: 'cc1', projectId: 'p1', deletedAt: null });
    mockPrisma.transaction.count.mockResolvedValue(0);
    mockPrisma.budgetLine.count.mockResolvedValue(0);
    mockPrisma.costCenter.update.mockResolvedValue({});

    await service.remove('p1', 'cc1');

    expect(mockPrisma.costCenter.update).toHaveBeenCalledWith({
      where: { id: 'cc1' },
      data: { deletedAt: expect.any(Date), isActive: false },
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e verificar que falha**

Run: `npm test -- cost-centers.service`
Expected: FAIL — `Cannot find module '../cost-centers.service'`

- [ ] **Step 3: Implementar DTOs, service, controller e module**

`financial-control/backend/src/modules/cost-centers/dto/create-cost-center.dto.ts`:

```typescript
import { IsString, IsOptional, IsBoolean, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCostCenterDto {
  @ApiProperty({ example: 'ADM', description: 'Código único dentro do projeto' })
  @IsString()
  @MinLength(1)
  code: string;

  @ApiProperty({ example: 'Administrativo' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

`financial-control/backend/src/modules/cost-centers/dto/update-cost-center.dto.ts`:

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateCostCenterDto } from './create-cost-center.dto';

export class UpdateCostCenterDto extends PartialType(CreateCostCenterDto) {}
```

`financial-control/backend/src/modules/cost-centers/cost-centers.service.ts`:

```typescript
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto';
import { throwConflictIfUniqueViolation } from '../../common/utils/prisma-errors';

@Injectable()
export class CostCentersService {
  constructor(private prisma: PrismaService) {}

  private async assertProject(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project)
      throw new NotFoundException(`Projeto ${projectId} não encontrado`);
  }

  async findByProject(projectId: string) {
    await this.assertProject(projectId);
    return this.prisma.costCenter.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { code: 'asc' },
    });
  }

  async findOneInProject(projectId: string, id: string) {
    const cc = await this.prisma.costCenter.findFirst({
      where: { id, projectId, deletedAt: null },
    });
    if (!cc)
      throw new NotFoundException(
        `Centro de custo ${id} não encontrado neste projeto`,
      );
    return cc;
  }

  async create(projectId: string, dto: CreateCostCenterDto) {
    await this.assertProject(projectId);
    try {
      return await this.prisma.costCenter.create({
        data: { ...dto, projectId },
      });
    } catch (error) {
      throwConflictIfUniqueViolation(
        error,
        `Código '${dto.code}' já existe neste projeto`,
      );
    }
  }

  async update(projectId: string, id: string, dto: UpdateCostCenterDto) {
    await this.findOneInProject(projectId, id);
    try {
      return await this.prisma.costCenter.update({ where: { id }, data: dto });
    } catch (error) {
      throwConflictIfUniqueViolation(
        error,
        `Código '${dto.code}' já existe neste projeto`,
      );
    }
  }

  async remove(projectId: string, id: string) {
    await this.findOneInProject(projectId, id);
    const [txCount, blCount] = await Promise.all([
      this.prisma.transaction.count({ where: { costCenterId: id, deletedAt: null } }),
      this.prisma.budgetLine.count({ where: { costCenterId: id } }),
    ]);
    if (txCount + blCount > 0) {
      throw new ConflictException(
        'Centro de custo é usado em lançamentos ou orçamento — desative-o (isActive: false) em vez de excluir',
      );
    }
    await this.prisma.costCenter.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
```

`financial-control/backend/src/modules/cost-centers/cost-centers.controller.ts`:

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
import { ProjectRole } from '@prisma/client';
import { CostCentersService } from './cost-centers.service';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProjectAccessGuard } from '../../common/guards/project-access.guard';
import { RequiresProjectRole } from '../../common/decorators/requires-project-role.decorator';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller('projects/:projectId/cost-centers')
export class CostCentersController {
  constructor(private service: CostCentersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar centros de custo do projeto' })
  findByProject(@Param('projectId') projectId: string) {
    return this.service.findByProject(projectId);
  }

  @Post()
  @RequiresProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Criar centro de custo (Admin/Gestor)' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateCostCenterDto,
  ) {
    return this.service.create(projectId, dto);
  }

  @Patch(':id')
  @RequiresProjectRole(ProjectRole.GESTOR)
  @ApiOperation({ summary: 'Atualizar centro de custo (Admin/Gestor)' })
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCostCenterDto,
  ) {
    return this.service.update(projectId, id, dto);
  }

  @Delete(':id')
  @RequiresProjectRole(ProjectRole.GESTOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir centro de custo (soft delete, Admin/Gestor)' })
  remove(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.service.remove(projectId, id);
  }
}
```

`financial-control/backend/src/modules/cost-centers/cost-centers.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { CostCentersController } from './cost-centers.controller';
import { CostCentersService } from './cost-centers.service';

@Module({
  controllers: [CostCentersController],
  providers: [CostCentersService],
  exports: [CostCentersService],
})
export class CostCentersModule {}
```

Registrar em `app.module.ts` (import + array `imports`): `CostCentersModule`.

- [ ] **Step 4: Rodar os testes unitários e verificar que passam**

Run: `npm test -- cost-centers.service`
Expected: PASS (4 testes)

- [ ] **Step 5: Escrever o teste E2E**

`financial-control/backend/test/cost-centers.e2e-spec.ts`:

```typescript
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
```

- [ ] **Step 6: Rodar o E2E e verificar que passa**

Run: `npm run test:e2e -- cost-centers`
Expected: PASS (3 testes)

- [ ] **Step 7: Commit**

```bash
git add financial-control/backend/src/modules/cost-centers financial-control/backend/src/app.module.ts financial-control/backend/test/cost-centers.e2e-spec.ts
git commit -m "feat: módulo cost-centers — CRUD de centros de custo por projeto"
```

---

## Task 7: Backend — Módulo `notification-config` (por usuário autenticado)

**Files:**
- Create: `financial-control/backend/src/modules/notification-config/dto/upsert-notification-config.dto.ts`
- Create: `financial-control/backend/src/modules/notification-config/notification-config.service.ts`
- Create: `financial-control/backend/src/modules/notification-config/notification-config.controller.ts`
- Create: `financial-control/backend/src/modules/notification-config/notification-config.module.ts`
- Create: `financial-control/backend/src/modules/notification-config/__tests__/notification-config.service.spec.ts`
- Create: `financial-control/backend/test/notification-config.e2e-spec.ts`
- Modify: `financial-control/backend/src/app.module.ts`

**Interfaces:**
- Consumes: `createUserAndLogin` (Task 1), `JwtAuthGuard` + `@CurrentUser()` da Fase 1.
- Produces: `NotificationConfigService` (`findAllForUser(userId)`, `upsert(userId, channel, dto)`). Rotas `GET /notification-config` e `PUT /notification-config/:channel`. Sem soft delete — `@@unique([userId, channel])` garante 1 registro por canal; `isActive: false` "desliga".
- `channel` no path é validado contra o enum `NotificationChannel` (TELEGRAM | WHATSAPP | EMAIL) via `ParseEnumPipe`.

- [ ] **Step 1: Escrever os testes unitários (falhando)**

`financial-control/backend/src/modules/notification-config/__tests__/notification-config.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationConfigService } from '../notification-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationChannel } from '@prisma/client';

const mockPrisma = {
  notificationConfig: {
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
};

describe('NotificationConfigService', () => {
  let service: NotificationConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationConfigService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<NotificationConfigService>(NotificationConfigService);
    jest.clearAllMocks();
  });

  it('should list configs for a user', async () => {
    mockPrisma.notificationConfig.findMany.mockResolvedValue([{ id: 'n1' }]);
    const result = await service.findAllForUser('u1');
    expect(result).toHaveLength(1);
    expect(mockPrisma.notificationConfig.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: { channel: 'asc' },
    });
  });

  it('should upsert a config scoped to userId + channel', async () => {
    mockPrisma.notificationConfig.upsert.mockResolvedValue({ id: 'n1' });

    await service.upsert('u1', NotificationChannel.EMAIL, {
      alertDueToday: false,
    });

    expect(mockPrisma.notificationConfig.upsert).toHaveBeenCalledWith({
      where: {
        userId_channel: { userId: 'u1', channel: NotificationChannel.EMAIL },
      },
      create: {
        userId: 'u1',
        channel: NotificationChannel.EMAIL,
        alertDueToday: false,
      },
      update: { alertDueToday: false },
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e verificar que falha**

Run: `npm test -- notification-config.service`
Expected: FAIL — `Cannot find module '../notification-config.service'`

- [ ] **Step 3: Implementar DTO, service, controller e module**

`financial-control/backend/src/modules/notification-config/dto/upsert-notification-config.dto.ts`:

```typescript
import {
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpsertNotificationConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  alertDueToday?: boolean;

  @ApiPropertyOptional({ example: '08:00', description: 'Formato HH:mm' })
  @IsOptional()
  @Matches(TIME_REGEX, { message: 'alertDueTodayTime deve estar no formato HH:mm' })
  alertDueTodayTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  alertDueInDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  alertOverdue?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  alertLowBalance?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  alertLowBalanceAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  alertPendingApproval?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  alertDailySummary?: boolean;

  @ApiPropertyOptional({ example: '08:00', description: 'Formato HH:mm' })
  @IsOptional()
  @Matches(TIME_REGEX, { message: 'alertDailySummaryTime deve estar no formato HH:mm' })
  alertDailySummaryTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  alertWeeklySummary?: boolean;

  @ApiPropertyOptional({ description: 'Dia da semana (0=domingo ... 6=sábado)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  alertWeeklyDay?: number;
}
```

`financial-control/backend/src/modules/notification-config/notification-config.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertNotificationConfigDto } from './dto/upsert-notification-config.dto';
import { NotificationChannel } from '@prisma/client';

@Injectable()
export class NotificationConfigService {
  constructor(private prisma: PrismaService) {}

  async findAllForUser(userId: string) {
    return this.prisma.notificationConfig.findMany({
      where: { userId },
      orderBy: { channel: 'asc' },
    });
  }

  async upsert(
    userId: string,
    channel: NotificationChannel,
    dto: UpsertNotificationConfigDto,
  ) {
    return this.prisma.notificationConfig.upsert({
      where: { userId_channel: { userId, channel } },
      create: { userId, channel, ...dto },
      update: { ...dto },
    });
  }
}
```

`financial-control/backend/src/modules/notification-config/notification-config.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  ParseEnumPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationChannel } from '@prisma/client';
import { NotificationConfigService } from './notification-config.service';
import { UpsertNotificationConfigDto } from './dto/upsert-notification-config.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('notification-config')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notification-config')
export class NotificationConfigController {
  constructor(private service: NotificationConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Listar minhas configurações de notificação' })
  findMine(@CurrentUser() user: { id: string }) {
    return this.service.findAllForUser(user.id);
  }

  @Put(':channel')
  @ApiOperation({ summary: 'Criar/atualizar configuração de um canal (upsert)' })
  upsert(
    @CurrentUser() user: { id: string },
    @Param('channel', new ParseEnumPipe(NotificationChannel))
    channel: NotificationChannel,
    @Body() dto: UpsertNotificationConfigDto,
  ) {
    return this.service.upsert(user.id, channel, dto);
  }
}
```

`financial-control/backend/src/modules/notification-config/notification-config.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { NotificationConfigController } from './notification-config.controller';
import { NotificationConfigService } from './notification-config.service';

@Module({
  controllers: [NotificationConfigController],
  providers: [NotificationConfigService],
  exports: [NotificationConfigService],
})
export class NotificationConfigModule {}
```

Registrar em `app.module.ts` (import + array `imports`): `NotificationConfigModule`.

- [ ] **Step 4: Rodar os testes unitários e verificar que passam**

Run: `npm test -- notification-config.service`
Expected: PASS (2 testes)

- [ ] **Step 5: Escrever o teste E2E**

`financial-control/backend/test/notification-config.e2e-spec.ts`:

```typescript
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
```

- [ ] **Step 6: Rodar o E2E e verificar que passa**

Run: `npm run test:e2e -- notification-config`
Expected: PASS (5 testes)

- [ ] **Step 7: Rodar toda a suíte de backend e o build**

Run: `npm test` (todos os unitários), depois `npm run build`
Expected: todos PASS, build sem erros de tipo. Corrigir qualquer import faltante em `app.module.ts` (os 7 módulos devem estar registrados).

- [ ] **Step 8: Commit**

```bash
git add financial-control/backend/src/modules/notification-config financial-control/backend/src/app.module.ts financial-control/backend/test/notification-config.e2e-spec.ts
git commit -m "feat: módulo notification-config — configurações de notificação por usuário"
```

---

## Task 8: Frontend — Fundação (Providers, hook CRUD, DataTable, Dialog) + página de Fornecedores

**Files:**
- Create: `financial-control/frontend/src/app/providers.tsx`
- Modify: `financial-control/frontend/src/app/layout.tsx`
- Modify: `financial-control/frontend/src/types/index.ts`
- Create: `financial-control/frontend/src/lib/crud-api.ts`
- Create: `financial-control/frontend/src/hooks/use-crud.ts`
- Create: `financial-control/frontend/src/components/ui/dialog.tsx`
- Create: `financial-control/frontend/src/components/shared/data-table.tsx`
- Create: `financial-control/frontend/src/components/shared/confirm-dialog.tsx`
- Create: `financial-control/frontend/src/components/shared/entity-form-dialog.tsx`
- Create: `financial-control/frontend/src/app/(app)/cadastros/fornecedores/page.tsx`
- Modify: `financial-control/frontend/src/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `api` (`src/lib/api.ts`), TanStack Query, sonner, react-hook-form.
- Produces (usados nas Tasks 9–11):
  - `createResourceApi<T>(basePath): { list, create, update, remove }` e `extractApiMessage(err): string` em `src/lib/crud-api.ts`.
  - `useCrud<T>({ queryKey, resource, labels }): { rows, isLoading, create, update, remove, isMutating }` em `src/hooks/use-crud.ts`.
  - `DataTable<T>({ columns, rows, isLoading, actions })` e tipo `Column<T>` em `src/components/shared/data-table.tsx`.
  - `Dialog({ open, onClose, title, children })` em `src/components/ui/dialog.tsx`.
  - `ConfirmDialog({ open, title, message, onConfirm, onCancel, loading })` em `src/components/shared/confirm-dialog.tsx`.
  - `EntityFormDialog<T>({ open, title, fields, defaultValues, onSubmit, onClose, submitting })` e tipo `FieldSpec` em `src/components/shared/entity-form-dialog.tsx`.
  - Tipos `Supplier`, `Client`, `BankAccount`, `CreditCard`, `AccountCategory`, `CostCenter`, `NotificationConfig`, `PersonType`, `BankAccountType`, `CardBrand`, `CategoryType`, `CategoryLevel`, `NotificationChannel` em `src/types/index.ts`.

- [ ] **Step 1: Providers (TanStack Query + Toaster) e wiring no root layout**

`financial-control/frontend/src/app/providers.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
```

Em `financial-control/frontend/src/app/layout.tsx`, importar e envolver o `children` do `<body>` com `<Providers>`:

```tsx
import { Providers } from './providers';
// ...
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
```

- [ ] **Step 2: Tipos das entidades**

Acrescentar ao final de `financial-control/frontend/src/types/index.ts`:

```typescript
export type PersonType = 'INDIVIDUAL' | 'COMPANY';
export type BankAccountType = 'CHECKING' | 'SAVINGS' | 'INVESTMENT' | 'PETTY_CASH';
export type CardBrand = 'VISA' | 'MASTERCARD' | 'ELO' | 'AMEX' | 'HIPERCARD' | 'OTHER';
export type CategoryType = 'REVENUE' | 'EXPENSE';
export type CategoryLevel = 'PACKAGE' | 'CATEGORY' | 'SUBCATEGORY';
export type NotificationChannel = 'TELEGRAM' | 'WHATSAPP' | 'EMAIL';

export interface Supplier {
  id: string;
  personType: PersonType;
  companyName?: string;
  tradeName?: string;
  fullName?: string;
  taxId: string;
  email?: string;
  phone?: string;
  mobile?: string;
  paymentTermDays?: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Client {
  id: string;
  personType: PersonType;
  companyName?: string;
  tradeName?: string;
  fullName?: string;
  taxId: string;
  email?: string;
  phone?: string;
  mobile?: string;
  city?: string;
  state?: string;
  paymentTermDays?: number;
  isClient: boolean;
  isSupplier: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface BankAccount {
  id: string;
  name: string;
  bankName: string;
  bankCode?: string;
  agency?: string;
  accountNumber?: string;
  accountType: BankAccountType;
  initialBalance: string;
  initialDate: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreditCard {
  id: string;
  name: string;
  brand: CardBrand;
  lastFourDigits: string;
  creditLimit: string;
  billingDay: number;
  closingDay: number;
  paymentAccountId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface AccountCategory {
  id: string;
  projectId: string;
  parentId?: string;
  code: string;
  name: string;
  type: CategoryType;
  level: CategoryLevel;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CostCenter {
  id: string;
  projectId: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface NotificationConfig {
  id: string;
  userId: string;
  channel: NotificationChannel;
  isActive: boolean;
  alertDueToday: boolean;
  alertDueTodayTime: string;
  alertDueInDays?: number;
  alertOverdue: boolean;
  alertLowBalance: boolean;
  alertLowBalanceAmount?: string;
  alertPendingApproval: boolean;
  alertDailySummary: boolean;
  alertDailySummaryTime: string;
  alertWeeklySummary: boolean;
  alertWeeklyDay?: number;
}
```

- [ ] **Step 3: Helper de API por recurso + extração de mensagem de erro**

`financial-control/frontend/src/lib/crud-api.ts`:

```typescript
import { api } from './api';

export interface ResourceApi<T> {
  list: () => Promise<T[]>;
  create: (payload: Partial<T>) => Promise<T>;
  update: (id: string, payload: Partial<T>) => Promise<T>;
  remove: (id: string) => Promise<void>;
}

export function createResourceApi<T>(basePath: string): ResourceApi<T> {
  return {
    list: async () => (await api.get<T[]>(basePath)).data,
    create: async (payload) => (await api.post<T>(basePath, payload)).data,
    update: async (id, payload) =>
      (await api.patch<T>(`${basePath}/${id}`, payload)).data,
    remove: async (id) => {
      await api.delete(`${basePath}/${id}`);
    },
  };
}

/** Extrai a mensagem de erro do backend (string ou array de class-validator). */
export function extractApiMessage(err: unknown): string {
  const message = (
    err as { response?: { data?: { message?: string | string[] } } }
  )?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? 'Ocorreu um erro inesperado';
}
```

- [ ] **Step 4: Hook CRUD genérico (TanStack Query + toasts)**

`financial-control/frontend/src/hooks/use-crud.ts`:

```typescript
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { extractApiMessage, type ResourceApi } from '@/lib/crud-api';

interface UseCrudOptions<T> {
  queryKey: (string | number)[];
  resource: ResourceApi<T>;
  labels?: { entity?: string };
}

export function useCrud<T extends { id: string }>({
  queryKey,
  resource,
  labels,
}: UseCrudOptions<T>) {
  const qc = useQueryClient();
  const entity = labels?.entity ?? 'Registro';

  const query = useQuery({ queryKey, queryFn: resource.list });

  const invalidate = () => qc.invalidateQueries({ queryKey });
  const onError = (err: unknown) => toast.error(extractApiMessage(err));

  const create = useMutation({
    mutationFn: (payload: Partial<T>) => resource.create(payload),
    onSuccess: () => {
      invalidate();
      toast.success(`${entity} criado com sucesso`);
    },
    onError,
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<T> }) =>
      resource.update(id, payload),
    onSuccess: () => {
      invalidate();
      toast.success(`${entity} atualizado com sucesso`);
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => resource.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success(`${entity} excluído com sucesso`);
    },
    onError,
  });

  return {
    rows: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    create,
    update,
    remove,
    isMutating:
      create.isPending || update.isPending || remove.isPending,
  };
}
```

- [ ] **Step 5: Dialog (modal) reutilizável**

`financial-control/frontend/src/components/ui/dialog.tsx`:

```tsx
'use client';

import { useEffect } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Dialog({ open, onClose, title, children }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-800">{title}</h2>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: DataTable genérico**

`financial-control/frontend/src/components/shared/data-table.tsx`:

```tsx
'use client';

export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  isLoading?: boolean;
  actions?: (row: T) => React.ReactNode;
  emptyMessage?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  isLoading,
  actions,
  emptyMessage = 'Nenhum registro encontrado',
}: DataTableProps<T>) {
  if (isLoading) {
    return <p className="py-8 text-center text-sm text-gray-500">Carregando…</p>;
  }
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-gray-600">
            {columns.map((col) => (
              <th key={col.header} className={`px-4 py-2 font-medium ${col.className ?? ''}`}>
                {col.header}
              </th>
            ))}
            {actions && <th className="px-4 py-2 text-right font-medium">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50">
              {columns.map((col) => (
                <td key={col.header} className={`px-4 py-2 text-gray-800 ${col.className ?? ''}`}>
                  {col.cell(row)}
                </td>
              ))}
              {actions && (
                <td className="px-4 py-2 text-right whitespace-nowrap">{actions(row)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 7: ConfirmDialog**

`financial-control/frontend/src/components/shared/confirm-dialog.tsx`:

```tsx
'use client';

import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  loading,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} title={title}>
      <p className="mb-6 text-sm text-gray-600">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="destructive" onClick={onConfirm} disabled={loading}>
          {loading ? 'Excluindo…' : 'Excluir'}
        </Button>
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 8: EntityFormDialog (formulário declarativo com react-hook-form)**

`financial-control/frontend/src/components/shared/entity-form-dialog.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type FieldSpec =
  | {
      name: string;
      label: string;
      type: 'text' | 'number' | 'date';
      required?: boolean;
      placeholder?: string;
    }
  | {
      name: string;
      label: string;
      type: 'select';
      options: { value: string; label: string }[];
      required?: boolean;
    }
  | { name: string; label: string; type: 'checkbox' };

interface EntityFormDialogProps<T> {
  open: boolean;
  title: string;
  fields: FieldSpec[];
  defaultValues: Partial<T>;
  onSubmit: (values: Partial<T>) => void;
  onClose: () => void;
  submitting?: boolean;
}

// T é intencionalmente sem constraint: as entidades são `interface`, que não
// satisfazem `Record<string, unknown>`. O formulário opera internamente sobre
// Record<string, unknown> e converte nas fronteiras (defaultValues/onSubmit).
export function EntityFormDialog<T>({
  open,
  title,
  fields,
  defaultValues,
  onSubmit,
  onClose,
  submitting,
}: EntityFormDialogProps<T>) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Record<string, unknown>>({
    defaultValues: defaultValues as Record<string, unknown>,
  });

  // Reset ao abrir/trocar o registro editado
  useEffect(() => {
    if (open) reset(defaultValues as Record<string, unknown>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function submit(raw: Record<string, unknown>) {
    // Projeta o payload SOMENTE sobre os campos declarados. Na edição, o
    // react-hook-form retém chaves não-registradas vindas dos defaultValues
    // (id, createdAt, updatedAt, deletedAt, projectId…); enviá-las causaria
    // 400 no backend, que roda com forbidNonWhitelisted: true. Também descarta
    // strings vazias e NaN (campos opcionais não preenchidos — number vazio
    // com valueAsNumber vira NaN) para não mandar valores inválidos.
    const cleaned: Record<string, unknown> = {};
    for (const field of fields) {
      const v = raw[field.name];
      if (v === '' || v === undefined) continue;
      if (typeof v === 'number' && Number.isNaN(v)) continue;
      cleaned[field.name] = v;
    }
    onSubmit(cleaned as Partial<T>);
  }

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit(submit)} className="space-y-3">
        {fields.map((field) => (
          <div key={field.name} className="space-y-1">
            {field.type !== 'checkbox' && (
              <Label htmlFor={field.name}>
                {field.label}
                {'required' in field && field.required && (
                  <span className="text-red-500"> *</span>
                )}
              </Label>
            )}

            {field.type === 'select' ? (
              <select
                id={field.name}
                className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
                {...register(field.name, {
                  required: field.required ? 'Campo obrigatório' : false,
                })}
              >
                <option value="">Selecione…</option>
                {field.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : field.type === 'checkbox' ? (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" {...register(field.name)} />
                {field.label}
              </label>
            ) : (
              <Input
                id={field.name}
                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                placeholder={'placeholder' in field ? field.placeholder : undefined}
                step={field.type === 'number' ? 'any' : undefined}
                {...register(field.name, {
                  required:
                    'required' in field && field.required
                      ? 'Campo obrigatório'
                      : false,
                  valueAsNumber: field.type === 'number',
                })}
              />
            )}

            {errors[field.name] && (
              <p className="text-xs text-red-500">
                {String(errors[field.name]?.message)}
              </p>
            )}
          </div>
        ))}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
```

- [ ] **Step 9: Página de Fornecedores (primeiro consumidor da fundação)**

`financial-control/frontend/src/app/(app)/cadastros/fornecedores/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { createResourceApi } from '@/lib/crud-api';
import { useCrud } from '@/hooks/use-crud';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EntityFormDialog, type FieldSpec } from '@/components/shared/entity-form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import type { Supplier } from '@/types';

const resource = createResourceApi<Supplier>('/suppliers');

const FIELDS: FieldSpec[] = [
  {
    name: 'personType',
    label: 'Tipo de pessoa',
    type: 'select',
    required: true,
    options: [
      { value: 'COMPANY', label: 'Pessoa Jurídica' },
      { value: 'INDIVIDUAL', label: 'Pessoa Física' },
    ],
  },
  { name: 'companyName', label: 'Razão social (PJ)', type: 'text' },
  { name: 'fullName', label: 'Nome completo (PF)', type: 'text' },
  { name: 'taxId', label: 'CPF/CNPJ', type: 'text', required: true },
  { name: 'email', label: 'E-mail', type: 'text' },
  { name: 'phone', label: 'Telefone', type: 'text' },
  { name: 'paymentTermDays', label: 'Prazo de pagamento (dias)', type: 'number' },
];

const columns: Column<Supplier>[] = [
  { header: 'Nome', cell: (s) => s.companyName ?? s.fullName ?? '—' },
  { header: 'CPF/CNPJ', cell: (s) => s.taxId },
  { header: 'Tipo', cell: (s) => (s.personType === 'COMPANY' ? 'PJ' : 'PF') },
  {
    header: 'Status',
    cell: (s) => (s.isActive ? 'Ativo' : 'Inativo'),
  },
];

export default function FornecedoresPage() {
  const { rows, isLoading, create, update, remove, isMutating } = useCrud<Supplier>({
    queryKey: ['suppliers'],
    resource,
    labels: { entity: 'Fornecedor' },
  });

  const [editing, setEditing] = useState<Supplier | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Supplier | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(supplier: Supplier) {
    setEditing(supplier);
    setFormOpen(true);
  }

  function handleSubmit(values: Partial<Supplier>) {
    if (editing) {
      update.mutate(
        { id: editing.id, payload: values },
        { onSuccess: () => setFormOpen(false) },
      );
    } else {
      create.mutate(values, { onSuccess: () => setFormOpen(false) });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Fornecedores</h1>
        <Button onClick={openCreate}>Novo fornecedor</Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        actions={(s) => (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
              Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update.mutate({ id: s.id, payload: { isActive: !s.isActive } })}
            >
              {s.isActive ? 'Desativar' : 'Ativar'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(s)}>
              Excluir
            </Button>
          </div>
        )}
      />

      <EntityFormDialog<Supplier>
        open={formOpen}
        title={editing ? 'Editar fornecedor' : 'Novo fornecedor'}
        fields={FIELDS}
        defaultValues={
          editing ?? { personType: 'COMPANY', isActive: true }
        }
        onSubmit={handleSubmit}
        onClose={() => setFormOpen(false)}
        submitting={isMutating}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Excluir fornecedor"
        message={`Tem certeza que deseja excluir "${
          deleting?.companyName ?? deleting?.fullName ?? ''
        }"? Fornecedores com lançamentos vinculados não podem ser excluídos — desative-os.`}
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
```

- [ ] **Step 10: Atualizar a sidebar com a seção Cadastros**

Substituir o array de navegação em `financial-control/frontend/src/app/(app)/layout.tsx` para incluir os links de cadastro. Como Admin/Gestor/Analista veem itens diferentes, usar `usePermissions` para condicionar os links Admin-only:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isAuthenticated } from '@/lib/auth';
import { usePermissions } from '@/hooks/usePermissions';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAdmin } = usePermissions();

  useEffect(() => {
    if (!isAuthenticated()) router.push('/login');
  }, [router]);

  const links = [
    { href: '/dashboard', label: 'Dashboard', show: true },
    { href: '/projetos', label: 'Projetos', show: true },
    { href: '/cadastros/clientes', label: 'Clientes', show: isAdmin },
    { href: '/cadastros/fornecedores', label: 'Fornecedores', show: isAdmin },
    { href: '/cadastros/contas-bancarias', label: 'Contas Bancárias', show: isAdmin },
    { href: '/cadastros/cartoes', label: 'Cartões', show: isAdmin },
    { href: '/configuracoes/notificacoes', label: 'Notificações', show: true },
  ].filter((l) => l.show);

  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-64 bg-white shadow-sm border-r">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold text-gray-800">Controle Financeiro</h1>
        </div>
        <nav className="p-4 space-y-1">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
```

- [ ] **Step 11: Rodar o build e verificar a página**

Run (em `financial-control/frontend/`): `npm run build`
Expected: build sem erros de tipo. Com backend + banco rodando, subir `npm run dev`, logar como Admin, acessar `/cadastros/fornecedores`, criar/editar/excluir um fornecedor e confirmar os toasts.

- [ ] **Step 12: Commit**

```bash
git add financial-control/frontend/src/app/providers.tsx financial-control/frontend/src/app/layout.tsx financial-control/frontend/src/types financial-control/frontend/src/lib/crud-api.ts financial-control/frontend/src/hooks/use-crud.ts financial-control/frontend/src/components financial-control/frontend/src/app/\(app\)
git commit -m "feat: frontend — fundação de cadastros (providers, useCrud, DataTable, dialogs) e página de fornecedores"
```

---

## Task 9: Frontend — Páginas de Clientes, Contas Bancárias e Cartões (cadastros globais)

**Files:**
- Create: `financial-control/frontend/src/app/(app)/cadastros/clientes/page.tsx`
- Create: `financial-control/frontend/src/app/(app)/cadastros/contas-bancarias/page.tsx`
- Create: `financial-control/frontend/src/app/(app)/cadastros/cartoes/page.tsx`

**Interfaces:**
- Consumes: `createResourceApi`, `useCrud`, `DataTable`, `EntityFormDialog`, `ConfirmDialog` (Task 8); tipos `Client`, `BankAccount`, `CreditCard`.
- Produces: 3 páginas de gestão (mesma estrutura da página de Fornecedores).

- [ ] **Step 1: Página de Clientes**

`financial-control/frontend/src/app/(app)/cadastros/clientes/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { createResourceApi } from '@/lib/crud-api';
import { useCrud } from '@/hooks/use-crud';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EntityFormDialog, type FieldSpec } from '@/components/shared/entity-form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import type { Client } from '@/types';

const resource = createResourceApi<Client>('/clients');

const FIELDS: FieldSpec[] = [
  {
    name: 'personType',
    label: 'Tipo de pessoa',
    type: 'select',
    required: true,
    options: [
      { value: 'COMPANY', label: 'Pessoa Jurídica' },
      { value: 'INDIVIDUAL', label: 'Pessoa Física' },
    ],
  },
  { name: 'companyName', label: 'Razão social (PJ)', type: 'text' },
  { name: 'fullName', label: 'Nome completo (PF)', type: 'text' },
  { name: 'taxId', label: 'CPF/CNPJ', type: 'text', required: true },
  { name: 'email', label: 'E-mail', type: 'text' },
  { name: 'phone', label: 'Telefone', type: 'text' },
  { name: 'city', label: 'Cidade', type: 'text' },
  { name: 'state', label: 'UF', type: 'text' },
  { name: 'paymentTermDays', label: 'Prazo de pagamento (dias)', type: 'number' },
];

const columns: Column<Client>[] = [
  { header: 'Nome', cell: (c) => c.companyName ?? c.fullName ?? '—' },
  { header: 'CPF/CNPJ', cell: (c) => c.taxId },
  { header: 'Cidade/UF', cell: (c) => [c.city, c.state].filter(Boolean).join('/') || '—' },
  { header: 'Status', cell: (c) => (c.isActive ? 'Ativo' : 'Inativo') },
];

export default function ClientesPage() {
  const { rows, isLoading, create, update, remove, isMutating } = useCrud<Client>({
    queryKey: ['clients'],
    resource,
    labels: { entity: 'Cliente' },
  });

  const [editing, setEditing] = useState<Client | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Client | null>(null);

  function handleSubmit(values: Partial<Client>) {
    if (editing) {
      update.mutate({ id: editing.id, payload: values }, { onSuccess: () => setFormOpen(false) });
    } else {
      create.mutate(values, { onSuccess: () => setFormOpen(false) });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Clientes</h1>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>Novo cliente</Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        actions={(c) => (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setFormOpen(true); }}>
              Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update.mutate({ id: c.id, payload: { isActive: !c.isActive } })}
            >
              {c.isActive ? 'Desativar' : 'Ativar'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(c)}>
              Excluir
            </Button>
          </div>
        )}
      />

      <EntityFormDialog<Client>
        open={formOpen}
        title={editing ? 'Editar cliente' : 'Novo cliente'}
        fields={FIELDS}
        defaultValues={editing ?? { personType: 'COMPANY', isClient: true, isActive: true }}
        onSubmit={handleSubmit}
        onClose={() => setFormOpen(false)}
        submitting={isMutating}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Excluir cliente"
        message={`Excluir "${deleting?.companyName ?? deleting?.fullName ?? ''}"? Clientes com lançamentos vinculados não podem ser excluídos — desative-os.`}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Página de Contas Bancárias**

`financial-control/frontend/src/app/(app)/cadastros/contas-bancarias/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { createResourceApi } from '@/lib/crud-api';
import { useCrud } from '@/hooks/use-crud';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EntityFormDialog, type FieldSpec } from '@/components/shared/entity-form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import type { BankAccount } from '@/types';

const resource = createResourceApi<BankAccount>('/bank-accounts');

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: 'Corrente',
  SAVINGS: 'Poupança',
  INVESTMENT: 'Investimento',
  PETTY_CASH: 'Caixa',
};

const FIELDS: FieldSpec[] = [
  { name: 'name', label: 'Nome da conta', type: 'text', required: true },
  { name: 'bankName', label: 'Banco', type: 'text', required: true },
  { name: 'bankCode', label: 'Código do banco', type: 'text' },
  { name: 'agency', label: 'Agência', type: 'text' },
  { name: 'accountNumber', label: 'Número da conta', type: 'text' },
  {
    name: 'accountType',
    label: 'Tipo',
    type: 'select',
    required: true,
    options: [
      { value: 'CHECKING', label: 'Corrente' },
      { value: 'SAVINGS', label: 'Poupança' },
      { value: 'INVESTMENT', label: 'Investimento' },
      { value: 'PETTY_CASH', label: 'Caixa' },
    ],
  },
  { name: 'initialBalance', label: 'Saldo inicial', type: 'number' },
  { name: 'initialDate', label: 'Data do saldo inicial', type: 'date', required: true },
];

const columns: Column<BankAccount>[] = [
  { header: 'Conta', cell: (a) => a.name },
  { header: 'Banco', cell: (a) => a.bankName },
  { header: 'Tipo', cell: (a) => ACCOUNT_TYPE_LABELS[a.accountType] ?? a.accountType },
  { header: 'Status', cell: (a) => (a.isActive ? 'Ativa' : 'Inativa') },
];

export default function ContasBancariasPage() {
  const { rows, isLoading, create, update, remove, isMutating } = useCrud<BankAccount>({
    queryKey: ['bank-accounts'],
    resource,
    labels: { entity: 'Conta bancária' },
  });

  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<BankAccount | null>(null);

  function handleSubmit(values: Partial<BankAccount>) {
    if (editing) {
      update.mutate({ id: editing.id, payload: values }, { onSuccess: () => setFormOpen(false) });
    } else {
      create.mutate(values, { onSuccess: () => setFormOpen(false) });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Contas Bancárias</h1>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>Nova conta</Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        actions={(a) => (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setEditing(a); setFormOpen(true); }}>
              Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update.mutate({ id: a.id, payload: { isActive: !a.isActive } })}
            >
              {a.isActive ? 'Desativar' : 'Ativar'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(a)}>
              Excluir
            </Button>
          </div>
        )}
      />

      <EntityFormDialog<BankAccount>
        open={formOpen}
        title={editing ? 'Editar conta bancária' : 'Nova conta bancária'}
        fields={FIELDS}
        defaultValues={
          editing
            ? // <input type="date"> exige yyyy-MM-dd; o backend devolve ISO completo
              { ...editing, initialDate: editing.initialDate?.slice(0, 10) }
            : { accountType: 'CHECKING', isActive: true }
        }
        onSubmit={handleSubmit}
        onClose={() => setFormOpen(false)}
        submitting={isMutating}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Excluir conta bancária"
        message={`Excluir "${deleting?.name ?? ''}"? Contas com lançamentos, extratos ou cartões vinculados não podem ser excluídas — desative-as.`}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
```

- [ ] **Step 3: Página de Cartões**

`financial-control/frontend/src/app/(app)/cadastros/cartoes/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { createResourceApi } from '@/lib/crud-api';
import { useCrud } from '@/hooks/use-crud';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EntityFormDialog, type FieldSpec } from '@/components/shared/entity-form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import type { CreditCard } from '@/types';

const resource = createResourceApi<CreditCard>('/credit-cards');

const FIELDS: FieldSpec[] = [
  { name: 'name', label: 'Nome do cartão', type: 'text', required: true },
  {
    name: 'brand',
    label: 'Bandeira',
    type: 'select',
    required: true,
    options: [
      { value: 'VISA', label: 'Visa' },
      { value: 'MASTERCARD', label: 'Mastercard' },
      { value: 'ELO', label: 'Elo' },
      { value: 'AMEX', label: 'Amex' },
      { value: 'HIPERCARD', label: 'Hipercard' },
      { value: 'OTHER', label: 'Outra' },
    ],
  },
  { name: 'lastFourDigits', label: 'Últimos 4 dígitos', type: 'text', required: true },
  { name: 'creditLimit', label: 'Limite', type: 'number', required: true },
  { name: 'billingDay', label: 'Dia de vencimento', type: 'number', required: true },
  { name: 'closingDay', label: 'Dia de fechamento', type: 'number', required: true },
];

const columns: Column<CreditCard>[] = [
  { header: 'Cartão', cell: (c) => c.name },
  { header: 'Bandeira', cell: (c) => c.brand },
  { header: 'Final', cell: (c) => `•••• ${c.lastFourDigits}` },
  { header: 'Status', cell: (c) => (c.isActive ? 'Ativo' : 'Inativo') },
];

export default function CartoesPage() {
  const { rows, isLoading, create, update, remove, isMutating } = useCrud<CreditCard>({
    queryKey: ['credit-cards'],
    resource,
    labels: { entity: 'Cartão' },
  });

  const [editing, setEditing] = useState<CreditCard | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<CreditCard | null>(null);

  function handleSubmit(values: Partial<CreditCard>) {
    if (editing) {
      update.mutate({ id: editing.id, payload: values }, { onSuccess: () => setFormOpen(false) });
    } else {
      create.mutate(values, { onSuccess: () => setFormOpen(false) });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Cartões de Crédito</h1>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>Novo cartão</Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        actions={(c) => (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setFormOpen(true); }}>
              Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update.mutate({ id: c.id, payload: { isActive: !c.isActive } })}
            >
              {c.isActive ? 'Desativar' : 'Ativar'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(c)}>
              Excluir
            </Button>
          </div>
        )}
      />

      <EntityFormDialog<CreditCard>
        open={formOpen}
        title={editing ? 'Editar cartão' : 'Novo cartão'}
        fields={FIELDS}
        defaultValues={editing ?? { brand: 'VISA', isActive: true }}
        onSubmit={handleSubmit}
        onClose={() => setFormOpen(false)}
        submitting={isMutating}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Excluir cartão"
        message={`Excluir "${deleting?.name ?? ''}"? Cartões com lançamentos vinculados não podem ser excluídos — desative-os.`}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Rodar o build**

Run (em `financial-control/frontend/`): `npm run build`
Expected: build sem erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add financial-control/frontend/src/app/\(app\)/cadastros
git commit -m "feat: frontend — páginas de clientes, contas bancárias e cartões"
```

---

## Task 10: Frontend — Páginas por projeto (Plano de Contas, Centros de Custo, Associações)

**Files:**
- Create: `financial-control/frontend/src/hooks/use-project-role.ts`
- Create: `financial-control/frontend/src/components/shared/association-manager.tsx`
- Create: `financial-control/frontend/src/app/(app)/projetos/page.tsx`
- Create: `financial-control/frontend/src/app/(app)/projetos/[projectId]/cadastros/page.tsx`
- Create: `financial-control/frontend/src/app/(app)/projetos/[projectId]/plano-de-contas/page.tsx`
- Create: `financial-control/frontend/src/app/(app)/projetos/[projectId]/centros-de-custo/page.tsx`

**Interfaces:**
- Consumes: `createResourceApi`, `useCrud`, `DataTable`, `EntityFormDialog`, `ConfirmDialog` (Task 8); `api`; tipos `Project`, `AccountCategory`, `CostCenter`, `Client`, `BankAccount`, `CreditCard`.
- Produces: `useProjectRole(projectId): { canManage, role, project }`; `AssociationManager<T>` component; 4 páginas.

- [ ] **Step 1: Hook de papel no projeto**

`financial-control/frontend/src/hooks/use-project-role.ts`:

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import type { ProjectRole } from '@/types';

interface ProjectDetail {
  id: string;
  name: string;
  projectUsers: { userId: string; role: ProjectRole }[];
}

export function useProjectRole(projectId: string) {
  const user = getCurrentUser();
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () =>
      (await api.get<ProjectDetail>(`/projects/${projectId}`)).data,
  });

  const isAdmin = user?.systemRole === 'ADMIN';
  const membership = project?.projectUsers?.find(
    (pu) => pu.userId === user?.id,
  );
  const role = membership?.role;
  const canManage = isAdmin || role === 'GESTOR';

  return { canManage, role, project };
}
```

- [ ] **Step 2: Lista de projetos**

`financial-control/frontend/src/app/(app)/projetos/page.tsx`:

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable, type Column } from '@/components/shared/data-table';
import type { Project } from '@/types';

const columns: Column<Project>[] = [
  { header: 'Projeto', cell: (p) => p.name },
  { header: 'Status', cell: (p) => p.status },
  {
    header: 'Cadastros',
    cell: (p) => (
      <div className="flex gap-3 text-sm">
        <Link className="text-primary underline" href={`/projetos/${p.id}/cadastros`}>
          Associações
        </Link>
        <Link className="text-primary underline" href={`/projetos/${p.id}/plano-de-contas`}>
          Plano de Contas
        </Link>
        <Link className="text-primary underline" href={`/projetos/${p.id}/centros-de-custo`}>
          Centros de Custo
        </Link>
      </div>
    ),
  },
];

export default function ProjetosPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => (await api.get<Project[]>('/projects')).data,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-800">Projetos</h1>
      <DataTable columns={columns} rows={data ?? []} isLoading={isLoading} />
    </div>
  );
}
```

- [ ] **Step 3: Componente AssociationManager**

`financial-control/frontend/src/components/shared/association-manager.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { extractApiMessage } from '@/lib/crud-api';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface AssociationManagerProps<T extends { id: string }> {
  title: string;
  /** Ex.: `/projects/${projectId}/clients` */
  listPath: string;
  /** Ex.: `/clients` (cadastro mestre global) */
  globalPath: string;
  /** Campo do body do POST de associação. Ex.: 'clientId' */
  assignKey: string;
  getLabel: (item: T) => string;
  canManage: boolean;
}

export function AssociationManager<T extends { id: string }>({
  title,
  listPath,
  globalPath,
  assignKey,
  getLabel,
  canManage,
}: AssociationManagerProps<T>) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const associated = useQuery({
    queryKey: ['assoc', listPath],
    queryFn: async () => (await api.get<T[]>(listPath)).data,
  });

  const global = useQuery({
    queryKey: ['global', globalPath],
    queryFn: async () => (await api.get<T[]>(globalPath)).data,
    enabled: dialogOpen, // só carrega o mestre ao abrir o diálogo
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['assoc', listPath] });
  const onError = (err: unknown) => toast.error(extractApiMessage(err));

  const assign = useMutation({
    mutationFn: (id: string) => api.post(listPath, { [assignKey]: id }),
    onSuccess: () => {
      invalidate();
      toast.success('Associado com sucesso');
      setDialogOpen(false);
      setSelectedId('');
    },
    onError,
  });

  const unassign = useMutation({
    mutationFn: (id: string) => api.delete(`${listPath}/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success('Desassociado com sucesso');
    },
    onError,
  });

  const associatedIds = new Set((associated.data ?? []).map((i) => i.id));
  const available = (global.data ?? []).filter((i) => !associatedIds.has(i.id));

  const columns: Column<T>[] = [{ header: 'Nome', cell: (i) => getLabel(i) }];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        {canManage && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            Associar
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={associated.data ?? []}
        isLoading={associated.isLoading}
        emptyMessage="Nenhum item associado a este projeto"
        actions={
          canManage
            ? (item) => (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={unassign.isPending}
                  onClick={() => unassign.mutate(item.id)}
                >
                  Desassociar
                </Button>
              )
            : undefined
        }
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={`Associar — ${title}`}>
        {global.isLoading ? (
          <p className="text-sm text-gray-500">Carregando cadastro…</p>
        ) : (
          <div className="space-y-4">
            <select
              className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">Selecione…</option>
              {available.map((item) => (
                <option key={item.id} value={item.id}>
                  {getLabel(item)}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!selectedId || assign.isPending}
                onClick={() => assign.mutate(selectedId)}
              >
                {assign.isPending ? 'Associando…' : 'Associar'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  );
}
```

- [ ] **Step 4: Página de Associações do projeto**

`financial-control/frontend/src/app/(app)/projetos/[projectId]/cadastros/page.tsx`:

```tsx
'use client';

import { use } from 'react';
import { AssociationManager } from '@/components/shared/association-manager';
import { useProjectRole } from '@/hooks/use-project-role';
import type { Client, BankAccount, CreditCard } from '@/types';

export default function ProjetoCadastrosPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { canManage, project } = useProjectRole(projectId);

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-gray-800">
        Cadastros do projeto {project?.name ? `— ${project.name}` : ''}
      </h1>

      <AssociationManager<Client>
        title="Clientes"
        listPath={`/projects/${projectId}/clients`}
        globalPath="/clients"
        assignKey="clientId"
        getLabel={(c) => c.companyName ?? c.fullName ?? c.taxId}
        canManage={canManage}
      />

      <AssociationManager<BankAccount>
        title="Contas Bancárias"
        listPath={`/projects/${projectId}/bank-accounts`}
        globalPath="/bank-accounts"
        assignKey="bankAccountId"
        getLabel={(a) => `${a.name} — ${a.bankName}`}
        canManage={canManage}
      />

      <AssociationManager<CreditCard>
        title="Cartões de Crédito"
        listPath={`/projects/${projectId}/credit-cards`}
        globalPath="/credit-cards"
        assignKey="creditCardId"
        getLabel={(c) => `${c.name} (•••• ${c.lastFourDigits})`}
        canManage={canManage}
      />
    </div>
  );
}
```

- [ ] **Step 5: Página de Plano de Contas**

`financial-control/frontend/src/app/(app)/projetos/[projectId]/plano-de-contas/page.tsx`:

```tsx
'use client';

import { use, useState } from 'react';
import { createResourceApi } from '@/lib/crud-api';
import { useCrud } from '@/hooks/use-crud';
import { useProjectRole } from '@/hooks/use-project-role';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EntityFormDialog, type FieldSpec } from '@/components/shared/entity-form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import type { AccountCategory } from '@/types';

const LEVEL_LABELS: Record<string, string> = {
  PACKAGE: 'Pacote',
  CATEGORY: 'Categoria',
  SUBCATEGORY: 'Subcategoria',
};

export default function PlanoDeContasPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { canManage } = useProjectRole(projectId);
  const resource = createResourceApi<AccountCategory>(
    `/projects/${projectId}/account-categories`,
  );

  const { rows, isLoading, create, update, remove, isMutating } =
    useCrud<AccountCategory>({
      queryKey: ['account-categories', projectId],
      resource,
      labels: { entity: 'Categoria' },
    });

  const [editing, setEditing] = useState<AccountCategory | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<AccountCategory | null>(null);

  // Pais possíveis = pacotes e categorias existentes (para montar a hierarquia)
  const parentOptions = rows
    .filter((r) => r.level !== 'SUBCATEGORY')
    .map((r) => ({ value: r.id, label: `${r.code} — ${r.name}` }));

  const fields: FieldSpec[] = [
    { name: 'code', label: 'Código', type: 'text', required: true },
    { name: 'name', label: 'Nome', type: 'text', required: true },
    {
      name: 'type',
      label: 'Tipo',
      type: 'select',
      required: true,
      options: [
        { value: 'REVENUE', label: 'Receita' },
        { value: 'EXPENSE', label: 'Despesa' },
      ],
    },
    {
      name: 'level',
      label: 'Nível',
      type: 'select',
      required: true,
      options: [
        { value: 'PACKAGE', label: 'Pacote' },
        { value: 'CATEGORY', label: 'Categoria' },
        { value: 'SUBCATEGORY', label: 'Subcategoria' },
      ],
    },
    {
      name: 'parentId',
      label: 'Categoria pai (deixe vazio para Pacote)',
      type: 'select',
      options: parentOptions,
    },
  ];

  const columns: Column<AccountCategory>[] = [
    { header: 'Código', cell: (c) => c.code },
    { header: 'Nome', cell: (c) => c.name },
    { header: 'Nível', cell: (c) => LEVEL_LABELS[c.level] ?? c.level },
    { header: 'Tipo', cell: (c) => (c.type === 'REVENUE' ? 'Receita' : 'Despesa') },
  ];

  function handleSubmit(values: Partial<AccountCategory>) {
    if (editing) {
      update.mutate({ id: editing.id, payload: values }, { onSuccess: () => setFormOpen(false) });
    } else {
      create.mutate(values, { onSuccess: () => setFormOpen(false) });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Plano de Contas</h1>
        {canManage && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            Nova categoria
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        actions={
          canManage
            ? (c) => (
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setFormOpen(true); }}>
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => update.mutate({ id: c.id, payload: { isActive: !c.isActive } })}
                  >
                    {c.isActive ? 'Desativar' : 'Ativar'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(c)}>
                    Excluir
                  </Button>
                </div>
              )
            : undefined
        }
      />

      <EntityFormDialog<AccountCategory>
        open={formOpen}
        title={editing ? 'Editar categoria' : 'Nova categoria'}
        fields={fields}
        defaultValues={editing ?? { type: 'EXPENSE', level: 'PACKAGE', isActive: true }}
        onSubmit={handleSubmit}
        onClose={() => setFormOpen(false)}
        submitting={isMutating}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Excluir categoria"
        message={`Excluir "${deleting?.name ?? ''}"? Categorias com subcategorias ou usadas em lançamentos/orçamento não podem ser excluídas — desative-as.`}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
```

- [ ] **Step 6: Página de Centros de Custo**

`financial-control/frontend/src/app/(app)/projetos/[projectId]/centros-de-custo/page.tsx`:

```tsx
'use client';

import { use, useState } from 'react';
import { createResourceApi } from '@/lib/crud-api';
import { useCrud } from '@/hooks/use-crud';
import { useProjectRole } from '@/hooks/use-project-role';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EntityFormDialog, type FieldSpec } from '@/components/shared/entity-form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import type { CostCenter } from '@/types';

const FIELDS: FieldSpec[] = [
  { name: 'code', label: 'Código', type: 'text', required: true },
  { name: 'name', label: 'Nome', type: 'text', required: true },
  { name: 'description', label: 'Descrição', type: 'text' },
];

const columns: Column<CostCenter>[] = [
  { header: 'Código', cell: (c) => c.code },
  { header: 'Nome', cell: (c) => c.name },
  { header: 'Status', cell: (c) => (c.isActive ? 'Ativo' : 'Inativo') },
];

export default function CentrosDeCustoPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { canManage } = useProjectRole(projectId);
  const resource = createResourceApi<CostCenter>(
    `/projects/${projectId}/cost-centers`,
  );

  const { rows, isLoading, create, update, remove, isMutating } =
    useCrud<CostCenter>({
      queryKey: ['cost-centers', projectId],
      resource,
      labels: { entity: 'Centro de custo' },
    });

  const [editing, setEditing] = useState<CostCenter | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<CostCenter | null>(null);

  function handleSubmit(values: Partial<CostCenter>) {
    if (editing) {
      update.mutate({ id: editing.id, payload: values }, { onSuccess: () => setFormOpen(false) });
    } else {
      create.mutate(values, { onSuccess: () => setFormOpen(false) });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Centros de Custo</h1>
        {canManage && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            Novo centro de custo
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        actions={
          canManage
            ? (c) => (
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setFormOpen(true); }}>
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => update.mutate({ id: c.id, payload: { isActive: !c.isActive } })}
                  >
                    {c.isActive ? 'Desativar' : 'Ativar'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(c)}>
                    Excluir
                  </Button>
                </div>
              )
            : undefined
        }
      />

      <EntityFormDialog<CostCenter>
        open={formOpen}
        title={editing ? 'Editar centro de custo' : 'Novo centro de custo'}
        fields={FIELDS}
        defaultValues={editing ?? { isActive: true }}
        onSubmit={handleSubmit}
        onClose={() => setFormOpen(false)}
        submitting={isMutating}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Excluir centro de custo"
        message={`Excluir "${deleting?.name ?? ''}"? Centros usados em lançamentos/orçamento não podem ser excluídos — desative-os.`}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
```

- [ ] **Step 7: Rodar o build**

Run (em `financial-control/frontend/`): `npm run build`
Expected: build sem erros de tipo.

- [ ] **Step 8: Commit**

```bash
git add financial-control/frontend/src/hooks/use-project-role.ts financial-control/frontend/src/components/shared/association-manager.tsx financial-control/frontend/src/app/\(app\)/projetos
git commit -m "feat: frontend — páginas por projeto (plano de contas, centros de custo, associações)"
```

---

## Task 11: Frontend — Página de Notificações + verificação final

**Files:**
- Create: `financial-control/frontend/src/app/(app)/configuracoes/notificacoes/page.tsx`

**Interfaces:**
- Consumes: `api`, `extractApiMessage` (Task 8), react-hook-form, sonner; tipo `NotificationConfig`, `NotificationChannel`.

- [ ] **Step 1: Página de Notificações (form por canal)**

`financial-control/frontend/src/app/(app)/configuracoes/notificacoes/page.tsx`:

```tsx
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { extractApiMessage } from '@/lib/crud-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { NotificationConfig, NotificationChannel } from '@/types';

const CHANNELS: { value: NotificationChannel; label: string }[] = [
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'TELEGRAM', label: 'Telegram' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
];

type ChannelFormValues = {
  isActive: boolean;
  alertDueToday: boolean;
  alertDueTodayTime: string;
  alertOverdue: boolean;
  alertPendingApproval: boolean;
  alertDailySummary: boolean;
  alertDailySummaryTime: string;
};

function ChannelForm({
  channel,
  label,
  config,
}: {
  channel: NotificationChannel;
  label: string;
  config?: NotificationConfig;
}) {
  const qc = useQueryClient();
  const { register, handleSubmit } = useForm<ChannelFormValues>({
    defaultValues: {
      isActive: config?.isActive ?? false,
      alertDueToday: config?.alertDueToday ?? true,
      alertDueTodayTime: config?.alertDueTodayTime ?? '08:00',
      alertOverdue: config?.alertOverdue ?? true,
      alertPendingApproval: config?.alertPendingApproval ?? true,
      alertDailySummary: config?.alertDailySummary ?? false,
      alertDailySummaryTime: config?.alertDailySummaryTime ?? '08:00',
    },
  });

  const save = useMutation({
    mutationFn: (values: ChannelFormValues) =>
      api.put(`/notification-config/${channel}`, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-config'] });
      toast.success(`Notificações de ${label} salvas`);
    },
    onError: (err) => toast.error(extractApiMessage(err)),
  });

  return (
    <form
      onSubmit={handleSubmit((v) => save.mutate(v))}
      className="space-y-3 rounded-lg border bg-white p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">{label}</h2>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" {...register('isActive')} />
          Canal ativo
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" {...register('alertDueToday')} />
        Alertar vencimentos do dia
      </label>
      <div className="flex items-center gap-2">
        <Label htmlFor={`${channel}-dueTime`} className="text-sm">Horário</Label>
        <Input id={`${channel}-dueTime`} type="time" className="w-32" {...register('alertDueTodayTime')} />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" {...register('alertOverdue')} />
        Alertar contas em atraso
      </label>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" {...register('alertPendingApproval')} />
        Alertar lançamentos aguardando aprovação
      </label>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" {...register('alertDailySummary')} />
        Enviar resumo diário
      </label>
      <div className="flex items-center gap-2">
        <Label htmlFor={`${channel}-dailyTime`} className="text-sm">Horário do resumo</Label>
        <Input id={`${channel}-dailyTime`} type="time" className="w-32" {...register('alertDailySummaryTime')} />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}

export default function NotificacoesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['notification-config'],
    queryFn: async () =>
      (await api.get<NotificationConfig[]>('/notification-config')).data,
  });

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-gray-500">Carregando…</p>;
  }

  const byChannel = new Map((data ?? []).map((c) => [c.channel, c]));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-800">Minhas Notificações</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {CHANNELS.map((ch) => (
          <ChannelForm
            key={ch.value}
            channel={ch.value}
            label={ch.label}
            config={byChannel.get(ch.value)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificação final do backend**

Com PostgreSQL/Redis de dev rodando (`docker compose -f docker-compose.dev.yml up -d postgres redis` em `financial-control/`):

Run (em `financial-control/backend/`): `npm test` — depois — `npm run test:e2e` — depois — `npm run build`
Expected: todos os testes unitários e E2E PASS; build sem erros. Se algum E2E falhar por e-mail duplicado entre execuções, confirmar que cada suite usa sufixo `Date.now()` nos e-mails (helper `createUserAndLogin`).

- [ ] **Step 3: Verificação final do frontend**

Run (em `financial-control/frontend/`): `npm run build`
Expected: build sem erros de tipo.

Com backend + banco no ar, subir `npm run dev` e validar manualmente o fluxo ponta a ponta:
- Logar como Admin → criar Cliente, Fornecedor, Conta Bancária e Cartão em `/cadastros/*`.
- Criar um projeto (ou usar existente), associar Cliente/Conta/Cartão em `/projetos/[id]/cadastros`.
- Criar Pacote → Categoria → Subcategoria em `/projetos/[id]/plano-de-contas` (confirmar que Categoria sem pai dá erro 400 com toast).
- Criar Centro de Custo em `/projetos/[id]/centros-de-custo`.
- Ajustar e salvar notificações em `/configuracoes/notificacoes`.
- Logar como um usuário Analista do projeto → confirmar que os botões de criar/editar/excluir de plano de contas e centros de custo não aparecem, e que a listagem continua visível.

- [ ] **Step 4: Atualizar a memória de status do projeto**

Editar `C:\Users\LeandroFerreiraLFTec\.claude\projects\C--Users-LeandroFerreiraLFTec-claude-pcontroleorc\memory\project_status.md` registrando que a Fase 2 (Módulo de Cadastros) está completa e que a próxima é a Fase 3 (Orçamento). Manter a linha correspondente em `MEMORY.md`.

- [ ] **Step 5: Commit final**

```bash
git add financial-control/frontend/src/app/\(app\)/configuracoes
git commit -m "feat: frontend — página de configurações de notificação por canal"
```

- [ ] **Step 6: Abrir o Pull Request da Fase 2**

Criar branch (se ainda não estiver em uma), fazer push e abrir PR com `gh` (já instalado/autenticado como `lsf1974`). Se o Bash não achar o `gh`, exportar o PATH: `export PATH="$PATH:/c/Program Files/GitHub CLI"`.

```bash
git push -u origin HEAD
gh pr create --title "Fase 2 — Módulo de Cadastros" --body "Implementa CRUD (backend + frontend) de Fornecedores, Clientes, Contas Bancárias, Cartões, Plano de Contas, Centros de Custo e Configurações de Notificação. Ref: docs/superpowers/specs/2026-07-07-fase2-cadastros-design.md"
```
