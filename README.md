# Sistema de Controle Financeiro Multi-usuário

Sistema web completo de controle financeiro, orientado a projetos, com bot Telegram.

## Requisitos

- Node.js 20+
- Docker Desktop
- Git

## Setup rápido

```powershell
# 1. Copiar variáveis de ambiente
Copy-Item financial-control/.env.example financial-control/.env
# Editar .env com JWT_SECRET e JWT_REFRESH_SECRET (mínimo 32 chars cada)

# 2. Subir infraestrutura (Postgres + Redis)
docker compose -f financial-control/docker-compose.dev.yml up -d

# 3. Backend — instalar, migrar e rodar
Set-Location financial-control/backend
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
cd financial-control/backend && npx jest --no-coverage

# E2E (requer banco rodando)
cd financial-control/backend && npm run test:e2e
```
