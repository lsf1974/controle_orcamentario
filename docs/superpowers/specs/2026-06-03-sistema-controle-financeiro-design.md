# Sistema de Controle Financeiro Multi-usuário — Design Document

**Data:** 2026-06-03
**Versão:** 1.2 (segunda revisão após code review)
**Status:** Aprovado para implementação

---

## 1. Objetivo

Sistema web completo de controle financeiro multi-usuário, orientado a projetos, com integração bancária e entrada de dados via Telegram e WhatsApp. Permite que equipes gerenciem orçamentos, lançamentos financeiros e conciliação bancária com controle de acesso por perfil (Admin / Gestor / Analista).

---

## 2. Arquitetura

### 2.1 Visão Geral

Monorepo com três serviços independentes orquestrados via Docker Compose:

```
financial-control/
├── backend/        # NestJS — REST API + WebSocket
├── frontend/       # Next.js 14 — interface web
└── telegram-bot/   # Telegraf.js — bot standalone
```

Todos os serviços compartilham o mesmo banco PostgreSQL e a mesma instância Redis. O frontend e o bot nunca acessam o banco diretamente — toda lógica de negócio fica no backend.

### 2.2 Fluxo de Dados

```
Browser / Bot Telegram / WhatsApp
         │
         ▼
   NestJS REST API (porta 3001)
         │
         ├── PostgreSQL 16  (dados persistentes)
         ├── Redis 7        (sessões, filas de notificação)
         └── Bull           (jobs assíncronos: notificações, extratos)
```

### 2.3 Decisões de Arquitetura

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Monorepo vs multi-repo | Monorepo | Simplifica deploy local e Docker Compose |
| ORM | Prisma 5 | Type-safety nativa com TypeScript, migrations versionadas |
| Filas | Bull + Redis | Notificações assíncronas sem overhead de broker externo |
| Auth tokens | JWT access (15min) + Refresh (7d, armazenado no DB) | Revogação granular por dispositivo/sessão |
| Upload de arquivos | Armazenamento local (`./uploads`) → migração para S3/R2 futura | Reduz dependências externas no MVP |
| WebSocket | Socket.io via NestJS Gateway | Atualizações em tempo real no dashboard sem polling |

---

## 3. Stack Tecnológica

### Backend
- **Runtime:** Node.js 24 + TypeScript
- **Framework:** NestJS 10 (modular, Guards, Interceptors, Pipes nativos)
- **ORM:** Prisma 5 + PostgreSQL 16
- **Cache/Filas:** Redis 7 + Bull
- **Auth:** passport-jwt + bcrypt (hash rounds: 12)
- **Documentação API:** Swagger (`@nestjs/swagger`)
- **Validação:** class-validator + class-transformer

### Frontend
- **Framework:** Next.js 14+ com App Router e TypeScript
- **UI:** shadcn/ui + Tailwind CSS
- **Gráficos:** Recharts
- **Estado/Cache:** TanStack Query (React Query)
- **Formulários:** React Hook Form + Zod
- **Estado global leve:** Zustand

### Integrações
- **Telegram:** Telegraf.js (gratuito, sem custo por mensagem)
- **WhatsApp:** Evolution API self-hosted (fase 8)
- **Bancos:** OFX + CSV + CNAB240 + Open Finance Brasil OAuth2 (fase 8)

### Infraestrutura
- **Containerização:** Docker + Docker Compose
- **CI/CD:** GitHub Actions (fase futura)
- **Variáveis de ambiente:** dotenv com validação via Zod no startup

---

## 4. Modelo de Controle de Acesso

### 4.1 Dois Níveis de Controle

O sistema implementa controle de acesso em dois níveis ortogonais:

**Nível 1 — SystemRole (global, por usuário):**
- `ADMIN` — acesso total ao sistema, independente de projeto
- `USER` — acesso restrito aos projetos em que está associado

**Nível 2 — ProjectRole (por projeto, por usuário):**
- `GESTOR` — gerencia o projeto, aprova lançamentos e orçamentos
- `ANALISTA` — cria lançamentos (que entram como "Aguardando Aprovação"), visualiza dados

Um mesmo usuário pode ser `GESTOR` no Projeto A e `ANALISTA` no Projeto B.

### 4.2 Implementação no Backend

```typescript
// Guard global — systemRole
@RequiresRole(SystemRole.ADMIN)

// Guard por projeto — projectRole
@RequiresProjectRole(ProjectRole.GESTOR)   // aceita GESTOR e ADMIN
@RequiresProjectRole(ProjectRole.ANALISTA) // aceita ANALISTA, GESTOR e ADMIN

// Guard de acesso ao projeto (valida se userId está no projeto)
@UseGuards(ProjectAccessGuard)
```

### 4.3 Matriz de Permissões

| Ação | Admin | Gestor | Analista |
|------|:-----:|:------:|:--------:|
| Gerenciar usuários do sistema | ✅ | ❌ | ❌ |
| Criar/excluir projetos | ✅ | ❌ | ❌ |
| Editar dados do projeto | ✅ | ✅ | ❌ |
| Gerenciar plano de contas | ✅ | ✅ | ❌ |
| Criar/editar orçamento | ✅ | ✅ | ❌ |
| Aprovar orçamento | ✅ | ✅ | ❌ |
| Criar lançamentos | ✅ | ✅ | ✅* |
| Aprovar lançamentos | ✅ | ✅ | ❌ |
| Importar extratos | ✅ | ✅ | ❌ |
| Conciliação bancária | ✅ | ✅ | ❌ |
| Exportar relatórios | ✅ | ✅ | ✅** |
| Dashboard e consultas | ✅ | ✅ | ✅ |
| Log de auditoria | ✅ | ❌ | ❌ |

*Lançamentos do Analista entram como `PENDING_APPROVAL`
**Analista exporta relatórios analíticos; Admin/Gestor exportam auditoria e conciliação

---

## 5. Modelo de Dados

### 5.1 Entidades Principais

O schema completo está em `backend/prisma/schema.prisma`. Resumo das entidades:

**Usuários e Acesso:**
- `User` — usuário do sistema com SystemRole, 2FA opcional, soft delete
- `RefreshToken` — tokens de sessão com revogação por dispositivo; índice em `userId` para performance no logout
- `TelegramLinkToken` — token de 6 dígitos para vincular Telegram (TTL: 10 min)
- `PasswordResetToken` — token de recuperação de senha (TTL: 30 min, invalidado após uso); ao gerar novo token, todos os tokens anteriores não usados do mesmo `userId` são invalidados para evitar race condition
- `ProjectUser` — associação N:N entre User e Project com ProjectRole

**Projetos:**
- `Project` — projeto financeiro com status, cor e ícone

**Cadastros Base:**
- `Client` — cliente (PF/PJ) com flags `isClient`/`isSupplier` para entidades duais
- `Supplier` — fornecedor (PF/PJ)
- `AccountCategory` — plano de contas hierárquico (Pacote → Categoria → Subcategoria, auto-referência)
- `BankAccount` — conta bancária com saldo calculado
- `CreditCard` — cartão de crédito com controle de fatura
- `CostCenter` — centro de custo por projeto

**Financeiro:**
- `Budget` / `BudgetLine` / `BudgetMonthlyValue` — orçamentos com distribuição temporal
- `Transaction` / `TransactionAttachment` / `TransactionSplit` — lançamentos com comprovantes e rateio
- `BankStatement` / `BankStatementItem` — extratos e status de conciliação

**Suporte:**
- `NotificationConfig` — configurações de alerta por usuário e canal
- `AuditLog` — log imutável de todas as ações
- `RefreshToken` — gestão de sessões múltiplas

### 5.2 Padrões Aplicados a Todas as Entidades

- **Soft delete:** campo `deletedAt DateTime?` — registros deletados nunca são removidos do banco. **Exceções intencionais:** `BudgetMonthlyValue` e `TransactionSplit` são entidades de valor derivado sem ciclo de vida próprio — são recriados junto com sua entidade pai.
- **Prisma middleware global de soft delete:** o `PrismaService` registra middleware no construtor (antes de `$connect`) que: (1) injeta `deletedAt: null` em `findMany`/`findFirst`/`findUnique` **somente se o caller não especificou `deletedAt` explicitamente** — permitindo queries de auditoria com `{ deletedAt: { not: null } }`; (2) redireciona `delete`/`deleteMany` para `update`/`updateMany` com `{ deletedAt: new Date() }`. Modelos sem `deletedAt` (`RefreshToken`, `PasswordResetToken`, etc.) não são interceptados. A lista de modelos usa `Set` para lookup O(1).
- **Auditoria:** `createdAt`, `updatedAt` em todas as entidades mutáveis
- **IDs:** CUID (`@default(cuid())`) — evita colisões em ambientes distribuídos
- **approvalStatus default:** `Transaction.approvalStatus` tem `@default(PENDING)`. O service de criação de lançamentos define `approvalStatus: APPROVED` explicitamente apenas para Admin e Gestor.

---

## 6. Módulos do Sistema

### Módulo 1 — Autenticação e Acesso (Fase 1)
Registro, login JWT, refresh token, logout, recuperação de senha, 2FA TOTP opcional, sessões múltiplas com revogação.

### Módulo 2 — Configurações e Cadastros (Fase 2)
CRUD completo de Clientes, Fornecedores, Plano de Contas, Contas Bancárias, Cartões de Crédito, Centros de Custo, Projetos e Configurações de Notificação.

### Módulo 3 — Orçamento (Fase 3)
Múltiplos orçamentos por projeto, versionamento, distribuição temporal em 4 modos (Bloco único, Igual, Manual, Recorrência), fluxo de aprovação, comparativo entre versões, importação Excel.

### Módulo 4 — Lançamentos (Fase 4)
CRUD de lançamentos com tipo Despesa/Receita, fluxo de aprovação por perfil, recorrências com edição granular (este / este e futuros / todos), upload múltiplo de comprovantes, rateio por projeto/centro de custo.

### Módulo 5 — Bot Telegram (Fase 5)
Fluxo conversacional com botões inline para criação de lançamentos, vinculação de conta via token, comandos de consulta (`/vencimentos`, `/saldo`, `/resumo`, `/pendentes`, `/aprovar`, `/clientes`), notificações agendadas via Bull + Redis.

### Módulo 6 — Conciliação Bancária (Fase 6)
Importação OFX / CSV / CNAB240, algoritmo de conciliação automática (tolerância ±R$0,01, janela ±3 dias), tela de conciliação manual em duas colunas com drag-and-drop, relatório exportável.

### Módulo 7 — Dashboard e Relatórios (Fase 7)
6 painéis (Visão Geral, Orçado×Planejado×Realizado, Fluxo de Caixa, Posição de Clientes, Pendências, Conciliação), filtros globais persistentes, exportação PDF e Excel de 8 tipos de relatório.

### Módulo 8 — Expansões (Fase 8)
Open Finance Brasil OAuth2, WhatsApp via Evolution API, 2FA para todos os usuários, PWA, log de auditoria com interface Admin, backup automático.

---

## 7. Comunicação Frontend ↔ Backend

### 7.1 REST API
- Base URL: `http://localhost:3001`
- Autenticação: `Authorization: Bearer <accessToken>`
- Formato: JSON em todas as rotas
- Documentação: Swagger em `/api/docs`

### 7.2 WebSocket
- URL: `ws://localhost:3001`
- Eventos em tempo real: atualização de saldo, novo lançamento aguardando aprovação, notificação de vencimento

### 7.3 Refresh Token Flow
```
1. Login → accessToken (15min) + refreshToken (configurável via JWT_REFRESH_EXPIRES_IN)
2. Request com accessToken expirado → 401
3. Frontend intercepta → POST /auth/refresh com refreshToken
4. Backend valida no DB, revoga token antigo, emite par novo
5. Frontend repete request original com novo accessToken
6. Logout → POST /auth/logout (revoga todos os refresh tokens do usuário no DB)
```

**Race condition em refreshes paralelos:** o interceptor do axios usa flag `isRefreshing` + fila de promises pendentes. Quando múltiplas requests recebem 401 simultaneamente, apenas a primeira executa o refresh; as demais aguardam o par novo e reenviam com o novo accessToken. **O interceptor só opera no browser** (`typeof window !== 'undefined'`) — em Next.js SSR, 401s são rejeitados diretamente pois não há `localStorage` nem sessão de usuário individual no servidor.

### 7.4 ProjectAccessGuard — Cache Redis
Para evitar uma query ao banco em toda request autenticada, o `ProjectAccessGuard` armazena o resultado da verificação `userId:projectId → role` no Redis com TTL de 60 segundos. O cache é invalidado quando o `ProjectUser` é criado, atualizado ou removido.

```
Cache key: project_access:{userId}:{projectId}
Valor: role (GESTOR | ANALISTA | null)
TTL: 60 segundos
```

### 7.5 AuditInterceptor — Contrato

O `AuditInterceptor` é aplicado globalmente via `APP_INTERCEPTOR`. Captura as seguintes ações:

| Método HTTP | Ação auditada |
|-------------|---------------|
| POST | CREATE |
| PATCH / PUT | UPDATE |
| DELETE | DELETE |

Para cada ação registra: `userId`, `action`, `entity` (nome do resource da rota, ex.: `transactions`), `entityId` (`:id` do path), `ipAddress`, `userAgent`. `oldValues` e `newValues` são populados apenas em UPDATE quando o service retorna os dados antes e depois da alteração — não captura body por padrão (evita logar senhas).

---

## 8. Tratamento de Erros

### 8.1 Padrão de Resposta de Erro

```json
{
  "statusCode": 400,
  "message": "E-mail já cadastrado",
  "error": "Conflict"
}
```

### 8.2 Mapeamento de Erros

| Situação | HTTP Status |
|----------|-------------|
| Credenciais inválidas | 401 Unauthorized |
| Token expirado/inválido | 401 Unauthorized |
| Perfil insuficiente | 403 Forbidden |
| Recurso não encontrado | 404 Not Found |
| Entidade já existe | 409 Conflict |
| Validação de campos | 400 Bad Request |
| Erro interno | 500 Internal Server Error |

### 8.3 Soft Delete com Verificação de Dependências
Ao tentar excluir um registro com dependências ativas (ex.: Categoria usada em lançamentos), o sistema retorna 409 com sugestão de desativar (`isActive: false`) em vez de excluir.

---

## 9. Estratégia de Testes

### 9.1 Testes Unitários (Jest)
- Cada Service tem seu spec com mocks do PrismaService
- Guards testados com contextos de execução mockados
- Calculadores financeiros (conciliação, distribuição orçamentária) testados por propriedades

### 9.2 Testes E2E (Supertest)
- Banco de teste dedicado (`financial_control_test`)
- Fixtures de setup/teardown por suite
- Cobertura obrigatória: autenticação, guards de autorização, regras de perfil

### 9.3 Cobertura Mínima por Módulo
- Auth: register, login, refresh, logout, token expirado, permissão negada
- Guards: ADMIN bloqueando USER, GESTOR bloqueando ANALISTA, ADMIN passando em rotas de projeto
- Financeiro: algoritmo de conciliação, distribuição temporal de orçamento

---

## 10. Variáveis de Ambiente

Todas as credenciais são injetadas via `.env` (nunca hardcoded). Validação com Zod no startup — o processo falha com mensagem clara se uma variável obrigatória estiver ausente.

Variáveis obrigatórias para MVP:
- `DATABASE_URL` — connection string PostgreSQL
- `REDIS_URL` — connection string Redis
- `JWT_SECRET` — mínimo 32 caracteres
- `JWT_REFRESH_SECRET` — mínimo 32 caracteres, diferente do anterior

---

## 11. Plano de Fases

| Fase | Entrega | Semana |
|------|---------|--------|
| 1 | Fundação: Auth JWT, CRUD Users/Projects, login frontend | 1–2 |
| 2 | Cadastros: Clientes, Fornecedores, Plano de Contas, Contas, Cartões, Centros de Custo | 2–3 |
| 3 | Orçamento com versionamento, distribuição temporal e aprovação | 3–4 |
| 4 | Lançamentos com recorrência, comprovantes e aprovação por perfil | 4–5 |
| 5 | Bot Telegram + notificações via Bull | 5–6 |
| 6 | Conciliação bancária OFX/CSV/CNAB240 | 6–7 |
| 7 | Dashboard completo (6 painéis) + relatórios PDF/Excel | 7–8 |
| 8 | Open Finance, WhatsApp, 2FA, PWA, auditoria | 8+ |

Cada fase entrega software funcional e testável, sem dependência direta da fase seguinte (exceto modelo de dados compartilhado).

---

## 12. Referências

- **Spec original:** `prompt-controle-financeiro-claude-code.md`
- **Plano Fase 1:** `docs/superpowers/plans/2026-06-03-fase1-fundacao-autenticacao.md`
- **Schema Prisma completo:** `backend/prisma/schema.prisma` (gerado na Fase 1)
