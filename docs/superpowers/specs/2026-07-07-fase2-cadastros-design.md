# Fase 2 — Módulo de Configurações e Cadastros — Design Document

**Data:** 2026-07-07
**Status:** Aprovado para implementação
**Referência:** `docs/superpowers/specs/2026-06-03-sistema-controle-financeiro-design.md` (design geral do sistema, seção 6 — Módulo 2)

---

## 1. Objetivo

Implementar o CRUD completo (backend + frontend) das entidades de cadastro base do sistema: Clientes, Fornecedores, Plano de Contas, Contas Bancárias, Cartões de Crédito, Centros de Custo e Configurações de Notificação. Todas as entidades já estão modeladas em `backend/prisma/schema.prisma` (criado na Fase 1); esta fase implementa a lógica de negócio, autorização, API e telas de gestão.

Segue o mesmo padrão de entrega da Fase 1: backend completo + frontend funcional, testável de ponta a ponta.

---

## 2. Modelo de Dados (recapitulação)

Todas as entidades já existem no schema (`backend/prisma/schema.prisma`). Não há alterações de schema previstas nesta fase.

| Entidade | Escopo | Associação a projeto |
|---|---|---|
| `Supplier` | Global | Nenhuma — `Transaction.supplierId` referencia diretamente, sem tabela de junção |
| `Client` | Global | `ProjectClient` (N:N) |
| `BankAccount` | Global | `ProjectBankAccount` (N:N) |
| `CreditCard` | Global | `ProjectCreditCard` (N:N) |
| `AccountCategory` | Por projeto (`projectId` direto) | — |
| `CostCenter` | Por projeto (`projectId` direto) | — |
| `NotificationConfig` | Por usuário (`userId` + `channel`) | Nenhuma |

---

## 3. Modelo de Permissões

| Ação | Admin | Gestor (do projeto) | Analista |
|---|:---:|:---:|:---:|
| CRUD do cadastro mestre (Client/Supplier/BankAccount/CreditCard) | ✅ | ❌ | ❌ |
| Listar cadastro mestre global (somente leitura) | ✅ | ✅ | ✅ |
| Associar/desassociar Client/BankAccount/CreditCard a um projeto | ✅ | ✅ (apenas no(s) projeto(s) onde é Gestor) | ❌ |
| Listar entidades associadas ao projeto (Client/BankAccount/CreditCard/Supplier) | ✅ | ✅ | ✅ (leitura) |
| CRUD de `AccountCategory` / `CostCenter` do projeto | ✅ | ✅ (apenas no(s) projeto(s) onde é Gestor) | ❌ |
| Listar `AccountCategory` / `CostCenter` do projeto | ✅ | ✅ | ✅ (leitura) |
| `NotificationConfig` — ler/editar | Apenas a própria | Apenas a própria | Apenas a própria |

`Supplier` não tem tabela de associação por projeto — é global e visível (somente leitura) a qualquer usuário autenticado, para uso futuro em lançamentos (Fase 4).

---

## 4. Backend — Módulos e Endpoints

7 módulos NestJS, seguindo a estrutura de `users`/`projects` da Fase 1 (controller + service + dto + testes por módulo).

### 4.1 `suppliers`
- `GET /suppliers`, `GET /suppliers/:id` — qualquer usuário autenticado
- `POST /suppliers`, `PATCH /suppliers/:id`, `DELETE /suppliers/:id` — `RequiresRole(ADMIN)`

### 4.2 `clients`
- `GET /clients`, `GET /clients/:id` — qualquer usuário autenticado (leitura; necessária para o Gestor escolher o que associar ao seu projeto)
- `POST /clients`, `PATCH /clients/:id`, `DELETE /clients/:id` — `RequiresRole(ADMIN)`
- `GET /projects/:projectId/clients` — `ProjectAccessGuard` (qualquer role do projeto)
- `POST /projects/:projectId/clients` (body: `{ clientId }`, associa cliente existente) — Admin ou Gestor do projeto
- `DELETE /projects/:projectId/clients/:clientId` (desassocia) — Admin ou Gestor do projeto

### 4.3 `bank-accounts`
Mesmo padrão de `clients`, substituindo `ProjectClient` por `ProjectBankAccount`.

### 4.4 `credit-cards`
Mesmo padrão de `clients`, substituindo `ProjectClient` por `ProjectCreditCard`.

### 4.5 `account-categories`
- `GET /projects/:projectId/account-categories` — `ProjectAccessGuard` (qualquer role)
- `POST /projects/:projectId/account-categories` — Admin ou Gestor do projeto
- `PATCH /projects/:projectId/account-categories/:id` — Admin ou Gestor do projeto
- `DELETE /projects/:projectId/account-categories/:id` — Admin ou Gestor do projeto

### 4.6 `cost-centers`
Mesmo padrão de `account-categories`, sem hierarquia.

### 4.7 `notification-config`
- `GET /notification-config` — usuário autenticado (retorna configs de todos os canais já criados para o usuário)
- `PUT /notification-config/:channel` — upsert da config daquele canal para o usuário autenticado

---

## 5. Regras de Negócio e Validação

- **Unicidade:** `taxId` único em `Client`/`Supplier` (já garantido no schema); `code` único por `projectId` em `AccountCategory` e `CostCenter` (já garantido no schema).
- **Soft delete com verificação de dependência** (padrão já definido no design geral, seção 8.3): antes de excluir, verificar se há registros dependentes ativos; se houver, retornar `409 Conflict` com mensagem sugerindo desativar (`isActive: false`) em vez de excluir. Dependentes por entidade (conforme o schema): `Client`/`Supplier` → `Transaction` e `BudgetLine`; `AccountCategory`/`CostCenter` → `Transaction` e `BudgetLine`; `BankAccount` → `Transaction`, `BankStatement` e `CreditCard.paymentAccountId`; `CreditCard` → `Transaction`. (`BudgetLine` não referencia conta bancária nem cartão.) `NotificationConfig` não tem soft delete (é upsert por canal).
- **Hierarquia de `AccountCategory`:** ao criar ou mover uma categoria, validar que `parentId` (se informado) pertence ao mesmo `projectId` e que o `level` do registro é o imediatamente inferior ao do pai (`PACOTE` → `CATEGORIA` → `SUBCATEGORIA`). Excluir uma categoria que possui `children` ativos é bloqueado com `409`, independentemente de haver transações. Da mesma forma, **mudar o `level` ou o `parentId`** de uma categoria com `children` ativos é bloqueado com `409` (reposicionar o nó quebraria a coerência de níveis da subárvore).
- **Desassociação de projeto:** `DELETE /projects/:projectId/clients/:clientId` deve ser bloqueado com `409` se existirem `Transaction` ou `BudgetLine` daquele projeto específico referenciando o cliente. Para bank-accounts e credit-cards, o bloqueio considera apenas `Transaction` do projeto (`BudgetLine` não referencia essas entidades).
- **`NotificationConfig`:** validação de campos condicionais (ex.: exibir `alertDueInDays` apenas quando relevante) é responsabilidade do formulário no frontend; o backend apenas valida tipos/ranges básicos via DTO.

---

## 6. Frontend

### 6.1 Rotas novas (App Router)

- `/cadastros/fornecedores` — gestão global (Admin only no menu)
- `/cadastros/clientes` — gestão global (Admin only no menu)
- `/cadastros/contas-bancarias` — gestão global (Admin only no menu)
- `/cadastros/cartoes` — gestão global (Admin only no menu)
- `/projetos/[projectId]/cadastros` — aba com listas de clientes/contas/cartões associados ao projeto + ação de associar/desassociar (Admin/Gestor do projeto; Analista vê somente leitura)
- `/projetos/[projectId]/plano-de-contas` — CRUD hierárquico (Admin/Gestor gerenciam; Analista visualiza)
- `/projetos/[projectId]/centros-de-custo` — CRUD (Admin/Gestor gerenciam; Analista visualiza)
- `/configuracoes/notificacoes` — "minhas notificações", uma seção por canal (`NotificationChannel`)

### 6.2 Componentes compartilhados

- `DataTable<T>` genérico — colunas configuráveis, paginação simples, busca, ações de editar/excluir/toggle-ativo. Reaproveitado nas 6 entidades de cadastro.
- `EntityFormDialog` — modal de criar/editar com React Hook Form + Zod, schema e campos parametrizados por entidade.
- Hooks TanStack Query por entidade (`useClients`, `useSuppliers`, `useBankAccounts`, `useCreditCards`, `useAccountCategories`, `useCostCenters`, `useNotificationConfig`) encapsulando fetch/mutate + invalidação de cache.

### 6.3 Navegação

Menu lateral ganha seção "Cadastros" (itens visíveis conforme `systemRole`); dentro do contexto de um projeto, "Plano de Contas" e "Centros de Custo" aparecem na navegação do projeto.

---

## 7. Tratamento de Erros

Segue o padrão já estabelecido no design geral (seção 8): `400` validação de campos, `403` perfil insuficiente, `404` não encontrado, `409` entidade já existe / dependências ativas ao excluir.

---

## 8. Estratégia de Testes

- **Unitários (Jest):** um `*.service.spec.ts` por módulo, `PrismaService` mockado. Cobrir: criação, unicidade (`taxId`/`code`), validação de hierarquia (`account-categories`), bloqueio de exclusão com dependências ativas.
- **E2E (Supertest):** um arquivo por módulo cobrindo CRUD feliz + guards — Admin bloqueando não-Admin nas rotas globais; Analista bloqueado em create/update/delete de `account-categories`/`cost-centers`; usuário sem acesso ao projeto bloqueado pelo `ProjectAccessGuard`.
- Sem testes automatizados de frontend nesta fase (consistente com a Fase 1) — validação manual das telas via navegador.

---

## 9. Fora de Escopo (adiado para fases futuras)

- Uso dos cadastros em lançamentos (`Transaction`) — Fase 4.
- Uso do plano de contas/centro de custo em orçamento (`Budget`/`BudgetLine`) — Fase 3.
- Envio real de notificações (Bull + Redis) — Fase 5. Esta fase entrega apenas a configuração (CRUD), não o disparo.
- Admin gerenciar `NotificationConfig` de outros usuários — não incluído nesta fase.
