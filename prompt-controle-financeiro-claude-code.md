# PROMPT MESTRE — Sistema de Controle Financeiro Multi-usuário
> Para uso no Claude Code via terminal (PowerShell ou Bash) — Versão 2.0

---

## CONTEXTO E OBJETIVO

Você é um arquiteto de software sênior. Preciso que você crie, do zero, um sistema web completo de **controle financeiro multi-usuário**, orientado a projetos, com integração bancária e suporte a entrada de dados via Telegram ou WhatsApp.

Antes de escrever qualquer código, apresente:
1. A arquitetura completa escolhida (stack, banco de dados, estrutura de pastas)
2. O plano de execução em fases, com cada fase gerando código funcional e testável
3. Aguarde minha aprovação antes de iniciar a fase 1

---

## STACK TECNOLÓGICA

### Backend
- **Runtime:** Node.js com TypeScript
- **Framework:** NestJS (modular, escalável, suporte nativo a TypeScript)
- **Banco de Dados:** PostgreSQL com Prisma ORM
- **Autenticação:** JWT + Refresh Token + bcrypt para senhas
- **Cache:** Redis (sessões, filas de notificação)
- **Filas:** Bull (processamento assíncrono de extratos, notificações)
- **API:** REST + WebSocket para atualizações em tempo real no dashboard

### Frontend
- **Framework:** Next.js 14+ com App Router e TypeScript
- **UI Components:** shadcn/ui + Tailwind CSS
- **Gráficos:** Recharts ou Chart.js
- **Estado Global:** Zustand ou React Query (TanStack Query)
- **Formulários:** React Hook Form + Zod para validação

### Integrações
- **Telegram Bot:** Telegraf.js (gratuito, sem custo de mensagem)
- **WhatsApp:** Evolution API (self-hosted, gratuito) ou Twilio WhatsApp Sandbox (teste gratuito)
- **Bancos:** Open Finance Brasil (API oficial, gratuita) + importação OFX / CSV / CNAB240
- **Upload de comprovantes:** Armazenamento local ou AWS S3 / Cloudflare R2

### Infraestrutura
- **Containerização:** Docker + Docker Compose (ambiente completo local e produção)
- **CI/CD:** GitHub Actions
- **Variáveis de ambiente:** dotenv com validação via Zod

---

## MÓDULO 1 — AUTENTICAÇÃO, PERFIS E CONTROLE DE ACESSO

### 1.1 Autenticação
- Cadastro de usuários com nome, e-mail e senha
- Login com JWT (access token 15 min + refresh token 7 dias)
- Recuperação de senha por e-mail com link temporário
- Autenticação em dois fatores (2FA) opcional via TOTP (Google Authenticator)
- Sessões múltiplas com listagem e revogação por dispositivo
- Soft delete de usuários (desativar sem excluir histórico)

### 1.2 Perfis Globais de Usuário

O sistema possui dois níveis de controle: perfil global (o que o usuário é no sistema) e perfil por projeto (o que ele pode fazer em cada projeto). Um usuário pode ter diferentes papéis em projetos distintos.

#### PERFIL GLOBAL: ADMINISTRADOR (ADMIN)
O Administrador tem controle total sobre o sistema, independentemente de projeto.

**Gestão do sistema:**
- Criar, editar, ativar/desativar e excluir usuários
- Definir perfil global de cada usuário
- Visualizar log de auditoria de todas as ações do sistema
- Gerenciar configurações globais (integrações, notificações padrão, parâmetros do sistema)
- Acessar todos os projetos, mesmo sem associação direta

**Gestão de projetos:**
- Criar, editar, encerrar e excluir qualquer projeto
- Associar e remover usuários de qualquer projeto, definindo o perfil por projeto
- Acessar todos os módulos de todos os projetos: orçamento, lançamentos, conciliação, dashboard

**Orçamento:**
- Criar, editar, aprovar, rejeitar e encerrar orçamentos de qualquer projeto
- Comparar versões e aprovar revisões orçamentárias

**Lançamentos:**
- Criar, editar, aprovar e excluir qualquer lançamento
- Alterar status de qualquer lançamento (pago, recebido, cancelado)

**Conciliação bancária:**
- Importar extratos, executar conciliação automática e manual em qualquer conta

**Relatórios:**
- Exportar qualquer relatório sem restrição de projeto ou período

---

#### PERFIL POR PROJETO: GESTOR
O Gestor tem controle amplo sobre os projetos aos quais está associado. Um Administrador define quais projetos cada Gestor acessa.

**Gestão do projeto:**
- Editar dados do projeto (nome, descrição, datas, status, cor/ícone)
- Visualizar os usuários associados ao projeto (não pode adicionar/remover — isso é função do Admin)
- Configurar o plano de contas do projeto: criar, editar e desativar Pacotes, Categorias e Subcategorias
- Criar e editar Centros de Custo do projeto
- Configurar as contas bancárias e cartões de crédito vinculados ao projeto

**Orçamento:**
- Criar e editar orçamentos do projeto
- Aprovar ou rejeitar orçamentos submetidos por Analistas
- Comparar versões de orçamento
- Importar orçamento via planilha

**Lançamentos:**
- Criar, editar e excluir lançamentos no projeto
- Aprovar ou rejeitar lançamentos submetidos por Analistas
- Alterar status de lançamentos (pago, recebido, cancelado)
- Visualizar e baixar comprovantes

**Conciliação bancária:**
- Importar extratos das contas do projeto
- Executar e revisar conciliação automática e manual

**Relatórios:**
- Exportar todos os relatórios do projeto

---

#### PERFIL POR PROJETO: ANALISTA
O Analista pode consultar dados e registrar informações, mas não aprova nem configura o projeto. É o perfil para equipes operacionais.

**Visualização:**
- Acessar dashboard, gráficos e painéis do projeto com todos os filtros disponíveis
- Visualizar orçamentos ativos do projeto
- Consultar lançamentos, comprovantes e histórico do projeto
- Consultar posição das contas bancárias e cartões do projeto

**Lançamentos:**
- Criar novos lançamentos (despesas e receitas) — ficam com status "Aguardando aprovação" até revisão do Gestor ou Admin
- Editar apenas os próprios lançamentos enquanto ainda estiverem com status "Aguardando aprovação"
- Fazer upload de comprovantes nos próprios lançamentos
- Usar o bot Telegram/WhatsApp para registrar lançamentos

**Orçamento:**
- Visualizar orçamentos e comparativos — sem permissão para criar ou editar

**Conciliação bancária:**
- Apenas visualização do status de conciliação — sem permissão para importar ou conciliar

**Relatórios:**
- Exportar relatórios analíticos e de posição do projeto (sem relatórios de auditoria)

---

### 1.3 Regras de Acesso Implementadas no Backend

Implementar as seguintes guards e decorators no NestJS:

```typescript
// Decorator para verificar perfil global
@RequiresRole(SystemRole.ADMIN)

// Decorator para verificar perfil por projeto
@RequiresProjectRole(ProjectRole.GESTOR)  // aceita GESTOR ou ADMIN global
@RequiresProjectRole(ProjectRole.ANALISTA) // aceita ANALISTA, GESTOR ou ADMIN global

// Guard que valida se o usuário tem acesso ao projeto informado na rota
@UseGuards(ProjectAccessGuard)
```

**Matriz de permissões resumida:**

| Ação                              | Admin | Gestor | Analista |
|-----------------------------------|:-----:|:------:|:--------:|
| Gerenciar usuários do sistema     | ✅    | ❌     | ❌       |
| Criar/excluir projetos            | ✅    | ❌     | ❌       |
| Editar dados do projeto           | ✅    | ✅     | ❌       |
| Gerenciar plano de contas         | ✅    | ✅     | ❌       |
| Criar/editar orçamento            | ✅    | ✅     | ❌       |
| Aprovar orçamento                 | ✅    | ✅     | ❌       |
| Criar lançamentos                 | ✅    | ✅     | ✅*      |
| Aprovar lançamentos               | ✅    | ✅     | ❌       |
| Editar qualquer lançamento        | ✅    | ✅     | ❌       |
| Importar extratos                 | ✅    | ✅     | ❌       |
| Conciliação bancária              | ✅    | ✅     | ❌       |
| Exportar relatórios               | ✅    | ✅     | ✅**     |
| Dashboard e consultas             | ✅    | ✅     | ✅       |
| Log de auditoria                  | ✅    | ❌     | ❌       |

*Lançamentos do Analista entram como "Aguardando aprovação"
**Analista exporta relatórios analíticos; Admin/Gestor exportam também auditoria e conciliação

---

## MÓDULO 2 — CONFIGURAÇÕES E CADASTROS

Todos os cadastros devem ter: **criar, listar (com busca e paginação), editar, ativar/desativar e excluir (soft delete com verificação de dependências)**. Ao tentar excluir um registro com dependências ativas, o sistema deve alertar e sugerir desativar em vez de excluir.

### 2.1 Projetos
- Nome, descrição, data de início, data de término prevista
- Status: Ativo / Encerrado / Suspenso
- Cor e ícone para identificação visual no dashboard
- **Associação de usuários:** o Admin vincula usuários ao projeto atribuindo o perfil (Gestor ou Analista)
- Um usuário pode estar em múltiplos projetos com perfis diferentes em cada um
- Histórico de alterações do projeto

### 2.2 Clientes
O cadastro de Clientes é a entidade central para registro e acompanhamento de receitas. Cada receita lançada deve estar vinculada a um cliente.

**Dados cadastrais:**
- Tipo de pessoa: Física (CPF) ou Jurídica (CNPJ)
- Razão social / Nome completo
- Nome fantasia (para PJ)
- CPF ou CNPJ com validação de formato
- Inscrição estadual (opcional, para PJ)
- E-mail principal e secundário
- Telefone e celular
- Endereço completo (logradouro, número, complemento, bairro, cidade, estado, CEP)
- Website (opcional)
- Observações internas

**Dados financeiros do cliente:**
- Condições de pagamento padrão (à vista, 30/60/90 dias, parcelado)
- Limite de crédito (opcional)
- Conta bancária do cliente para recebimento via PIX/TED (banco, agência, conta, tipo, chave PIX)
- Responsável interno pelo relacionamento (usuário do sistema)

**Associação a projetos:**
- Um cliente pode estar vinculado a um ou mais projetos
- No projeto, exibir o histórico de receitas do cliente: planejadas, recebidas e em aberto
- Indicador de inadimplência: receitas em atraso por cliente

**Visão consolidada do cliente:**
- Tela de perfil do cliente com timeline de todas as transações
- Totais: total faturado, total recebido, total em aberto, total em atraso
- Gráfico de recebimentos mensais do cliente no período

### 2.3 Fornecedores
- Tipo de pessoa: Física (CPF) ou Jurídica (CNPJ)
- Razão social / Nome completo, Nome fantasia
- CPF ou CNPJ com validação
- E-mail, telefone, endereço completo
- Dados bancários para pagamento (banco, agência, conta, tipo, chave PIX)
- Condições de pagamento negociadas
- Categoria principal de fornecimento
- Observações internas
- Histórico de pagamentos e despesas vinculadas

> **Nota:** Um cadastro pode ser simultaneamente Fornecedor e Cliente (ex.: parceiro que também compra serviços). Neste caso, o sistema mantém uma única entidade com flag `isSupplier` e `isClient` ambas ativas, e os lançamentos de despesa e receita são separados por tipo.

### 2.4 Plano de Contas (Categorias)
- Hierarquia de 3 níveis: **Pacote → Categoria → Subcategoria**
- Tipo: Receita ou Despesa (definido no Pacote; herdado pelos filhos)
- Código alfanumérico customizável (ex.: 1.2.3)
- Descrição e observações
- Associação por projeto: cada projeto tem seu próprio plano de contas
- O Admin pode criar um plano de contas padrão para ser copiado em novos projetos
- **Permissão de edição:** apenas Admin e Gestor do projeto

### 2.5 Contas Bancárias
- Nome de identificação, banco, código do banco (ISPB)
- Agência e conta com dígito
- Tipo: Corrente / Poupança / Investimento / Caixa Interno
- Saldo inicial e data do saldo inicial
- Chave de integração Open Finance (quando habilitado)
- Configuração de importação (mapeamento de colunas CSV, se aplicável)
- Associação a um ou mais projetos
- Exibição do saldo calculado (saldo inicial + entradas - saídas conciliadas)

### 2.6 Cartões de Crédito
- Nome de identificação, bandeira (Visa / Master / Elo / Amex / Hipercard)
- Banco emissor, últimos 4 dígitos
- Limite total e limite disponível (calculado)
- Dia de fechamento da fatura e dia de vencimento
- Conta bancária vinculada para pagamento da fatura
- Associação a projetos
- Histórico de faturas mensais

### 2.7 Centros de Custo
- Nome, código, descrição
- Associação a projetos (cada projeto tem seus centros)
- **Permissão de edição:** Admin e Gestor do projeto
- Relatório de gastos consolidado por centro de custo

### 2.8 Configurações de Notificação (por usuário)
Cada usuário configura seus próprios alertas na tela de perfil:

- **Canal preferencial:** Telegram, WhatsApp, e-mail (ou combinação)
- **Vinculação Telegram:** botão "Vincular minha conta" gera token único de 6 dígitos válido por 10 minutos; usuário envia o token ao bot para associar o Telegram ID
- **Vinculação WhatsApp:** número de telefone + confirmação por código SMS/WhatsApp
- **Tipos de alertas configuráveis:**
  - Vencimentos do dia (horário configurável, ex.: 08h00)
  - Vencimentos nos próximos N dias (configurável: 3, 7, 15, 30 dias)
  - Recebimentos previstos para o dia
  - Saldo bancário abaixo de valor mínimo (configurável por conta)
  - Pagamentos em atraso (alerta diário até regularização)
  - Novos lançamentos aguardando minha aprovação (Gestor/Admin)
  - Resumo diário do fluxo de caixa (horário configurável)
  - Resumo semanal consolidado (dia da semana configurável)

---

## MÓDULO 3 — ORÇAMENTO

### 3.1 Criação e Gestão de Orçamentos
- Um projeto pode ter **múltiplos orçamentos** (ex.: Base, Revisão 1, Revisão 2, Realinhamento)
- Apenas **um orçamento por vez** pode estar com status Ativo — é o que aparece no dashboard
- Campos do orçamento: nome, descrição, versão (auto-incremento), status (Rascunho / Ativo / Encerrado), data de vigência início e fim
- Histórico de aprovações: quem aprovou, quando e com qual comentário

### 3.2 Estrutura do Orçamento
Organizado por Pacote → Categoria → Subcategoria, separando Receitas de Despesas.

Para cada linha orçamentária definir:
- Pacote, Categoria, Subcategoria
- Cliente vinculado (obrigatório para linhas de Receita)
- Fornecedor sugerido (opcional para linhas de Despesa)
- Centro de custo (opcional)
- Valor total da linha
- **Forma de distribuição temporal:**
  - **Bloco único:** valor cheio em um mês/data específica
  - **Distribuição igual:** valor dividido igualmente por N meses consecutivos
  - **Distribuição manual:** informar valor individualmente para cada mês do período
  - **Recorrência:** mesmo valor replicado automaticamente para N meses subsequentes
- Data de início e data de fim da competência
- Observações e justificativa

### 3.3 Comparação de Versões
- Comparativo lado a lado entre dois orçamentos do mesmo projeto
- Delta absoluto (R$) e percentual (%) por linha, categoria e pacote
- Indicação visual de linhas novas, removidas e alteradas
- Exportação do comparativo em Excel

### 3.4 Aprovação de Orçamentos
- Gestor submete orçamento para aprovação → Admin aprova ou rejeita com comentário
- Notificação automática ao Admin quando orçamento é submetido
- Notificação ao Gestor quando orçamento é aprovado/rejeitado

### 3.5 Importação de Orçamento
- Download de template Excel com o plano de contas do projeto já preenchido
- Importação do Excel preenchido com validação linha a linha
- Relatório de erros de validação antes de confirmar a importação

---

## MÓDULO 4 — LANÇAMENTOS (COMPROMISSOS DE PAGAMENTO E RECEBIMENTO)

### 4.1 Lançamento via Interface Web

**Campos obrigatórios:**
- Tipo: Despesa ou Receita
- Projeto
- Pacote / Categoria / Subcategoria (seleção hierárquica)
- **Para Receita:** Cliente (obrigatório — vincula a receita a um cliente cadastrado)
- **Para Despesa:** Fornecedor (obrigatório — vincula a despesa ao fornecedor)
- Conta bancária ou Cartão de crédito
- Valor bruto (R$)
- Data de competência (quando ocorreu o fato gerador)
- Data de vencimento
- Status: Previsto / Pago / Recebido / Cancelado

**Campos opcionais:**
- Descrição / Histórico livre
- Centro de custo
- Número do documento (NF, boleto, contrato, recibo)
- Tags customizáveis (ex.: "urgente", "aprovado-diretoria")
- Comprovante (upload de imagem JPG/PNG ou PDF — máx. 10 MB por arquivo, múltiplos arquivos por lançamento)
- Rateio: dividir o valor entre múltiplos projetos ou centros de custo com percentuais configuráveis
- Observações internas

**Comportamento por perfil:**
- Admin e Gestor: lançamento criado diretamente com o status informado
- Analista: lançamento criado sempre como "Aguardando aprovação", independentemente do status informado; Gestor ou Admin recebe notificação para revisão

### 4.2 Lançamentos Recorrentes
- Frequência: semanal / quinzenal / mensal / bimestral / trimestral / semestral / anual
- Data de início e data de término (ou "sem término")
- Ao criar, gerar automaticamente todos os lançamentos futuros do período, agrupados por um `recurringGroupId`
- Edição granular: alterar **só este** / **este e todos os futuros** / **todos do grupo**
- Cancelamento: mesma granularidade da edição

### 4.3 Lançamento via Telegram Bot
Fluxo conversacional com botões inline (teclado do Telegram):

```
Usuário: /novo
Bot: Que tipo de lançamento?
     [💸 Despesa]  [💰 Receita]

Usuário: [💸 Despesa]
Bot: Projeto:
     [Projeto Alpha]  [Projeto Beta]  [Projeto Gamma]

Usuário: [Projeto Alpha]
Bot: Pacote:
     [Pessoal]  [Operacional]  [Marketing]

Usuário: [Operacional]
Bot: Categoria:
     [Aluguel]  [Utilities]  [Serviços]  [Outros]

Usuário: [Aluguel]
Bot: Fornecedor (digite o nome ou parte dele):

Usuário: Imobiliária
Bot: Selecione:
     [Imobiliária Central]  [Imobiliária Norte]  [Novo fornecedor]

Usuário: [Imobiliária Central]
Bot: Qual o valor? (ex: 1500,00)

Usuário: 3200,00
Bot: Data de vencimento? (ex: 20/07/2025 | "hoje" | "amanhã")

Usuário: 05/07/2025
Bot: Descrição (opcional):

Usuário: Aluguel julho - sala 302
Bot: Deseja adicionar comprovante? Envie a foto/PDF ou toque em Pular.
     [Pular]

Usuário: [envia foto do boleto]
Bot: ✅ Lançamento registrado!
     ─────────────────────────
     💸 Despesa: R$ 3.200,00
     📅 Vencimento: 05/07/2025
     📁 Projeto: Projeto Alpha
     🗂️ Categoria: Operacional › Aluguel
     🏢 Fornecedor: Imobiliária Central
     📎 Comprovante: ✔ anexado
     ─────────────────────────
     [✏️ Editar]  [✅ Confirmar]  [🗑️ Cancelar]
```

**Comandos de consulta via bot:**
- `/vencimentos` — pagamentos e recebimentos de hoje e dos próximos 7 dias
- `/saldo` — saldo atual de todas as contas bancárias vinculadas ao usuário
- `/resumo` — resumo do mês atual: previsto x realizado por projeto
- `/pendentes` — lançamentos em atraso ordenados por data
- `/aprovar` — lista de lançamentos aguardando aprovação (Gestor/Admin)
- `/clientes` — posição de recebimentos por cliente (receitas em aberto e em atraso)

### 4.4 Lançamento via WhatsApp (Evolution API self-hosted)
- Mesmo fluxo do Telegram, adaptado para WhatsApp com listas e botões de resposta rápida
- Envio de comprovante diretamente pelo WhatsApp (imagem ou PDF)
- Configurar Evolution API no Docker Compose do projeto (container dedicado)

### 4.5 Aprovação de Lançamentos (Gestor / Admin)
- Lançamentos de Analistas ficam na fila "Aguardando Aprovação"
- Gestor e Admin recebem notificação (canal configurado)
- Na interface web: tela de revisão com opção de Aprovar / Rejeitar com comentário / Editar e aprovar
- Via bot: comando `/aprovar` lista os pendentes com botões de ação direto no chat

---

## MÓDULO 5 — INTEGRAÇÃO E CONCILIAÇÃO BANCÁRIA

### 5.1 Importação de Extratos
Formatos suportados:
- **OFX** — padrão exportado por BB, Bradesco, Itaú, Caixa, Santander, Nubank, Inter, C6 e demais
- **CSV** — com mapeamento configurável de colunas (data, valor, descrição, tipo)
- **CNAB 240** — para empresas com convênio bancário (recebimentos em lote)
- **API Open Finance Brasil** — integração direta com consentimento OAuth2 do usuário (fase futura)

### 5.2 Processo de Conciliação Automática
Após importar o extrato, executar o seguinte algoritmo para cada item:

1. Filtrar lançamentos não conciliados na mesma conta bancária
2. Buscar correspondência por:
   - **Valor exato** (tolerância configurável: ±R$ 0,01 para arredondamentos)
   - **Data próxima** (janela configurável: ±3 dias da data do extrato)
   - **Tipo de operação** (débito → despesa; crédito → receita)
3. Classificar o resultado:
   - ✅ **Conciliado automaticamente** — match único e com alta confiança (vincular sem intervenção)
   - ⚠️ **Conciliação sugerida** — múltiplos candidatos ou baixa confiança (exibe sugestão, requer confirmação)
   - ❌ **Não conciliado** — sem correspondência (requer ação manual)

### 5.3 Tela de Conciliação Manual
- Layout em duas colunas lado a lado:
  - **Esquerda:** itens do extrato bancário importado, com filtros e busca
  - **Direita:** lançamentos do sistema não conciliados, com filtros e busca
- Drag-and-drop ou clique para vincular item do extrato a lançamento
- Ações disponíveis por item do extrato:
  - Vincular a lançamento existente (busca por valor, data, descrição, fornecedor/cliente)
  - **Criar novo lançamento** a partir do extrato (abre formulário pré-preenchido com dados do extrato)
  - Ignorar item (marcar como "não relevante" — ex.: transferência entre contas próprias)
  - Dividir item do extrato em múltiplos lançamentos (ex.: pagamento de fatura com vários itens)
- Indicador de progresso: "X de Y itens conciliados (ZZ%)"
- Exportar relatório de conciliação em PDF ou Excel

### 5.4 Open Finance Brasil (Fase Futura)
- Fluxo OAuth2 para consentimento por banco
- Sincronização automática de extratos agendada (a cada 6 horas ou sob demanda)
- Suporte planejado: Nubank, Inter, Itaú, Bradesco, BB, Caixa, Santander

---

## MÓDULO 6 — DASHBOARD E RELATÓRIOS

### 6.1 Filtros Globais do Dashboard
Todos os painéis respondem a estes filtros, que devem ser persistidos na sessão do usuário:
- **Projeto** — seleção múltipla (mostra projetos acessíveis ao perfil do usuário)
- **Conta bancária** — múltipla seleção
- **Cartão de crédito** — múltipla seleção
- **Pacote / Categoria** — seleção hierárquica
- **Centro de custo** — múltipla seleção
- **Cliente** — múltipla seleção (para visão de receitas)
- **Fornecedor** — múltipla seleção (para visão de despesas)
- **Período:**
  - Ano completo
  - Mês específico
  - Intervalo de datas personalizado
- **Tipo:** Receita / Despesa / Ambos

### 6.2 Painel 1 — Visão Geral
- **Cards de resumo:** Saldo total nas contas, Total previsto a pagar no período, Total previsto a receber no período, Resultado líquido (receitas - despesas)
- **Alertas em destaque:** quantidade de lançamentos em atraso, próximos vencimentos em 7 dias, lançamentos aguardando aprovação
- **Mini-gráfico de saldo bancário:** evolução do saldo nos últimos 30 dias

### 6.3 Painel 2 — Orçado × Planejado × Realizado
- **Gráfico de barras agrupadas** por mês: Orçado / Planejado / Realizado
- **Gráfico de área acumulado** no período com as três dimensões
- **Tabela detalhada** com drill-down: Pacote → Categoria → Subcategoria
- Variação absoluta (R$) e percentual (%) entre Orçado × Planejado e Planejado × Realizado
- Separado por tipo (Receita / Despesa) com toggle
- Filtro adicional por cliente (para receitas) e por fornecedor (para despesas)

### 6.4 Painel 3 — Fluxo de Caixa
- **Gráfico de linha:** entradas e saídas diárias/semanais/mensais no período
- **Projeção de saldo:** curva de saldo futuro baseada nos lançamentos planejados e não realizados
- **Saldo por conta:** cards com saldo atual de cada conta bancária e limite disponível dos cartões
- **Gráfico de pizza:** composição percentual das despesas por Pacote/Categoria

### 6.5 Painel 4 — Posição de Clientes e Receitas
- Lista de clientes com:
  - Total orçado × planejado × realizado no período
  - Receitas em aberto (vencidas e a vencer)
  - Indicador de inadimplência (receitas em atraso há mais de N dias, configurável)
- Gráfico de barras: receita por cliente no período
- Filtro de clientes inadimplentes

### 6.6 Painel 5 — Pendências e Próximos Vencimentos
- Lista de pagamentos em atraso (Despesas vencidas e não pagas), ordenado por data e valor
- Lista de recebimentos em atraso (Receitas vencidas e não recebidas por cliente)
- Calendário ou lista dos próximos pagamentos e recebimentos (próximos 7, 15 ou 30 dias — configurável)
- Faturas de cartão de crédito com vencimento próximo

### 6.7 Painel 6 — Status de Conciliação
- % de lançamentos conciliados no período por conta bancária
- Número de itens do extrato sem conciliação
- Número de lançamentos do sistema sem correspondência no extrato
- Atalho direto para a tela de Conciliação Manual

### 6.8 Relatórios Exportáveis (PDF e Excel)
- Extrato analítico por projeto / categoria / período
- DRE simplificado: Receitas − Despesas = Resultado por período
- Fluxo de caixa realizado × previsto
- Posição de contas bancárias e cartões
- Orçado × Realizado detalhado por linha do orçamento
- Posição de clientes (receitas por cliente: orçado, planejado, realizado, em atraso)
- Relatório de conciliação bancária
- Log de auditoria (somente Admin)

---

## ESTRUTURA DE PASTAS DO PROJETO

```
financial-control/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── README.md
│
├── backend/                              # NestJS API
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/                     # JWT, refresh token, 2FA
│   │   │   ├── users/                    # Cadastro e perfil global
│   │   │   ├── projects/                 # Projetos e associação de usuários
│   │   │   ├── project-roles/            # Perfis por projeto (Gestor/Analista)
│   │   │   ├── clients/                  # Cadastro de clientes
│   │   │   ├── suppliers/                # Cadastro de fornecedores
│   │   │   ├── chart-of-accounts/        # Plano de contas hierárquico
│   │   │   ├── bank-accounts/            # Contas bancárias
│   │   │   ├── credit-cards/             # Cartões de crédito
│   │   │   ├── cost-centers/             # Centros de custo
│   │   │   ├── budget/                   # Orçamentos e linhas
│   │   │   ├── transactions/             # Lançamentos e recorrências
│   │   │   ├── bank-statements/          # Extratos e conciliação
│   │   │   ├── notifications/            # Alertas e agendamentos (Bull)
│   │   │   ├── audit/                    # Log de auditoria
│   │   │   ├── reports/                  # Geração de relatórios
│   │   │   └── integrations/
│   │   │       ├── telegram/             # Bot Telegraf.js
│   │   │       ├── whatsapp/             # Evolution API
│   │   │       └── open-finance/         # Open Finance Brasil
│   │   ├── common/
│   │   │   ├── guards/                   # AuthGuard, ProjectAccessGuard, RolesGuard
│   │   │   ├── decorators/               # @RequiresRole, @RequiresProjectRole
│   │   │   ├── interceptors/             # AuditInterceptor, ResponseTransformInterceptor
│   │   │   └── pipes/                    # ValidationPipe customizado
│   │   ├── config/
│   │   └── main.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── package.json
│
├── frontend/                              # Next.js App
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   └── recuperar-senha/
│   │   │   └── (app)/
│   │   │       ├── dashboard/
│   │   │       ├── orcamento/
│   │   │       ├── lancamentos/
│   │   │       ├── conciliacao/
│   │   │       ├── clientes/
│   │   │       ├── fornecedores/
│   │   │       └── configuracoes/
│   │   │           ├── usuarios/          # Apenas Admin
│   │   │           ├── projetos/
│   │   │           ├── plano-de-contas/
│   │   │           ├── contas-bancarias/
│   │   │           ├── cartoes/
│   │   │           ├── centros-de-custo/
│   │   │           └── notificacoes/
│   │   ├── components/
│   │   │   ├── ui/                        # shadcn/ui components
│   │   │   ├── charts/
│   │   │   ├── forms/
│   │   │   └── layout/
│   │   ├── hooks/
│   │   │   ├── usePermissions.ts          # Hook para verificar permissões no frontend
│   │   │   └── useProject.ts
│   │   ├── lib/
│   │   └── types/
│   └── package.json
│
└── telegram-bot/                          # Bot Telegram (standalone)
    ├── src/
    │   ├── scenes/                        # Fluxos conversacionais (despesa, receita, consultas)
    │   ├── keyboards/                     # Teclados inline e reply
    │   ├── middleware/                    # Auth middleware (vinculação usuário)
    │   └── main.ts
    └── package.json
```

---

## MODELO DE DADOS — SCHEMA PRISMA (REFERÊNCIA COMPLETA)

```prisma
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
  INDIVIDUAL   // Pessoa Física - CPF
  COMPANY      // Pessoa Jurídica - CNPJ
}

enum CategoryType {
  REVENUE
  EXPENSE
}

enum CategoryLevel {
  PACKAGE       // Pacote (nível 1)
  CATEGORY      // Categoria (nível 2)
  SUBCATEGORY   // Subcategoria (nível 3)
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
  id                String    @id @default(cuid())
  name              String
  email             String    @unique
  passwordHash      String
  systemRole        SystemRole @default(USER)
  telegramId        String?   @unique
  telegramUsername  String?
  whatsappPhone     String?
  twoFactorSecret   String?
  twoFactorEnabled  Boolean   @default(false)
  isActive          Boolean   @default(true)
  lastLoginAt       DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime? // soft delete

  projectUsers      ProjectUser[]
  transactions      Transaction[]
  notifications     NotificationConfig[]
  auditLogs         AuditLog[]
  linkingTokens     TelegramLinkToken[]
}

model TelegramLinkToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  user      User     @relation(fields: [userId], references: [id])
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
  id          String      @id @default(cuid())
  projectId   String
  userId      String
  role        ProjectRole @default(ANALISTA)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  project     Project     @relation(fields: [projectId], references: [id])
  user        User        @relation(fields: [userId], references: [id])

  @@unique([projectId, userId])
}

// ─── CLIENTES ────────────────────────────────────────────────────────────────

model Client {
  id                  String     @id @default(cuid())
  personType          PersonType
  companyName         String?    // Razão social (PJ)
  tradeName           String?    // Nome fantasia (PJ)
  fullName            String?    // Nome completo (PF)
  taxId               String     @unique // CPF ou CNPJ
  stateRegistration   String?    // Inscrição estadual (PJ)
  email               String?
  emailSecondary      String?
  phone               String?
  mobile              String?
  website             String?
  // Endereço
  street              String?
  streetNumber        String?
  complement          String?
  neighborhood        String?
  city                String?
  state               String?
  zipCode             String?
  // Financeiro
  paymentTermDays     Int?       // Prazo padrão de pagamento
  creditLimit         Decimal?
  pixKey              String?
  bankName            String?
  bankAgency          String?
  bankAccount         String?
  bankAccountType     BankAccountType?
  // Relacionamento
  responsibleUserId   String?    // Usuário responsável pelo cliente
  notes               String?
  isActive            Boolean    @default(true)
  createdAt           DateTime   @default(now())
  updatedAt           DateTime   @updatedAt
  deletedAt           DateTime?

  projectClients      ProjectClient[]
  transactions        Transaction[]
  budgetLines         BudgetLine[]
}

model ProjectClient {
  id        String   @id @default(cuid())
  projectId String
  clientId  String
  createdAt DateTime @default(now())

  project   Project  @relation(fields: [projectId], references: [id])
  client    Client   @relation(fields: [clientId], references: [id])

  @@unique([projectId, clientId])
}

// ─── FORNECEDORES ────────────────────────────────────────────────────────────

model Supplier {
  id                String     @id @default(cuid())
  personType        PersonType
  companyName       String?
  tradeName         String?
  fullName          String?
  taxId             String     @unique
  email             String?
  phone             String?
  mobile            String?
  pixKey            String?
  bankName          String?
  bankAgency        String?
  bankAccount       String?
  bankAccountType   BankAccountType?
  paymentTermDays   Int?
  notes             String?
  isActive          Boolean    @default(true)
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
  deletedAt         DateTime?

  transactions      Transaction[]
  budgetLines       BudgetLine[]
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

  project     Project       @relation(fields: [projectId], references: [id])
  parent      AccountCategory?  @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children    AccountCategory[] @relation("CategoryHierarchy")
  budgetLines BudgetLine[]
  transactions Transaction[]

  @@unique([projectId, code])
}

// ─── CONTAS BANCÁRIAS E CARTÕES ──────────────────────────────────────────────

model BankAccount {
  id              String          @id @default(cuid())
  name            String
  bankName        String
  bankCode        String?
  agency          String?
  accountNumber   String?
  accountType     BankAccountType
  initialBalance  Decimal         @default(0)
  initialDate     DateTime
  openFinanceId   String?
  isActive        Boolean         @default(true)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  deletedAt       DateTime?

  projectAccounts ProjectBankAccount[]
  transactions    Transaction[]
  statements      BankStatement[]
}

model ProjectBankAccount {
  id            String      @id @default(cuid())
  projectId     String
  bankAccountId String
  createdAt     DateTime    @default(now())

  project       Project     @relation(fields: [projectId], references: [id])
  bankAccount   BankAccount @relation(fields: [bankAccountId], references: [id])

  @@unique([projectId, bankAccountId])
}

model CreditCard {
  id             String    @id @default(cuid())
  name           String
  brand          CardBrand
  lastFourDigits String
  creditLimit    Decimal
  billingDay     Int
  closingDay     Int
  paymentAccountId String?
  isActive       Boolean   @default(true)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?

  projectCards   ProjectCreditCard[]
  transactions   Transaction[]
}

model ProjectCreditCard {
  id           String     @id @default(cuid())
  projectId    String
  creditCardId String
  createdAt    DateTime   @default(now())

  project      Project    @relation(fields: [projectId], references: [id])
  creditCard   CreditCard @relation(fields: [creditCardId], references: [id])

  @@unique([projectId, creditCardId])
}

// ─── CENTROS DE CUSTO ────────────────────────────────────────────────────────

model CostCenter {
  id          String   @id @default(cuid())
  projectId   String
  code        String
  name        String
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  project     Project  @relation(fields: [projectId], references: [id])
  transactions Transaction[]
  budgetLines BudgetLine[]

  @@unique([projectId, code])
}

// ─── ORÇAMENTOS ──────────────────────────────────────────────────────────────

model Budget {
  id          String       @id @default(cuid())
  projectId   String
  name        String
  description String?
  version     Int          @default(1)
  status      BudgetStatus @default(DRAFT)
  startDate   DateTime
  endDate     DateTime
  isActive    Boolean      @default(false)
  approvedBy  String?
  approvedAt  DateTime?
  approvalNote String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  project     Project      @relation(fields: [projectId], references: [id])
  lines       BudgetLine[]
}

model BudgetLine {
  id               String           @id @default(cuid())
  budgetId         String
  categoryId       String
  costCenterId     String?
  clientId         String?          // Obrigatório para linhas de Receita
  supplierId       String?          // Opcional para linhas de Despesa
  totalAmount      Decimal
  distributionType DistributionType
  startDate        DateTime
  endDate          DateTime?
  recurrenceMonths Int?
  notes            String?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  budget           Budget           @relation(fields: [budgetId], references: [id])
  category         AccountCategory  @relation(fields: [categoryId], references: [id])
  costCenter       CostCenter?      @relation(fields: [costCenterId], references: [id])
  client           Client?          @relation(fields: [clientId], references: [id])
  supplier         Supplier?        @relation(fields: [supplierId], references: [id])
  monthlyValues    BudgetMonthlyValue[]
}

model BudgetMonthlyValue {
  id           String     @id @default(cuid())
  budgetLineId String
  month        Int        // 1-12
  year         Int
  amount       Decimal

  budgetLine   BudgetLine @relation(fields: [budgetLineId], references: [id])

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
  clientId         String?           // Obrigatório para Receita
  supplierId       String?           // Obrigatório para Despesa
  createdByUserId  String
  type             TransactionType
  amount           Decimal
  description      String?
  documentNumber   String?
  competenceDate   DateTime
  dueDate          DateTime
  paymentDate      DateTime?
  status           TransactionStatus @default(PLANNED)
  approvalStatus   ApprovalStatus    @default(APPROVED)
  approvedByUserId String?
  approvalNote     String?
  source           TransactionSource @default(WEB)
  isRecurring      Boolean           @default(false)
  recurringGroupId String?
  reconciledItemId String?           // ID do BankStatementItem conciliado
  notes            String?
  tags             String[]
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  deletedAt        DateTime?

  project          Project           @relation(fields: [projectId], references: [id])
  category         AccountCategory   @relation(fields: [categoryId], references: [id])
  costCenter       CostCenter?       @relation(fields: [costCenterId], references: [id])
  bankAccount      BankAccount?      @relation(fields: [bankAccountId], references: [id])
  client           Client?           @relation(fields: [clientId], references: [id])
  supplier         Supplier?         @relation(fields: [supplierId], references: [id])
  createdBy        User              @relation(fields: [createdByUserId], references: [id])
  attachments      TransactionAttachment[]
  splits           TransactionSplit[]
}

model TransactionAttachment {
  id            String      @id @default(cuid())
  transactionId String
  fileName      String
  fileUrl       String
  fileType      String      // image/jpeg, application/pdf etc.
  fileSize      Int         // bytes
  uploadedAt    DateTime    @default(now())

  transaction   Transaction @relation(fields: [transactionId], references: [id])
}

model TransactionSplit {
  id            String      @id @default(cuid())
  transactionId String
  projectId     String
  costCenterId  String?
  percentage    Decimal
  amount        Decimal

  transaction   Transaction @relation(fields: [transactionId], references: [id])
}

// ─── EXTRATOS E CONCILIAÇÃO ──────────────────────────────────────────────────

model BankStatement {
  id            String          @id @default(cuid())
  bankAccountId String
  importedBy    String
  importDate    DateTime        @default(now())
  startDate     DateTime
  endDate       DateTime
  format        StatementFormat
  totalItems    Int             @default(0)
  reconciledItems Int           @default(0)

  bankAccount   BankAccount     @relation(fields: [bankAccountId], references: [id])
  items         BankStatementItem[]
}

model BankStatementItem {
  id                  String               @id @default(cuid())
  statementId         String
  date                DateTime
  amount              Decimal
  description         String
  type                String               // CREDIT | DEBIT
  externalId          String?
  reconciliationStatus ReconciliationStatus @default(PENDING)
  transactionId       String?
  ignoredReason       String?
  reconciledAt        DateTime?
  reconciledBy        String?

  statement           BankStatement        @relation(fields: [statementId], references: [id])
}

// ─── NOTIFICAÇÕES ────────────────────────────────────────────────────────────

model NotificationConfig {
  id                     String              @id @default(cuid())
  userId                 String
  channel                NotificationChannel
  isActive               Boolean             @default(true)
  alertDueToday          Boolean             @default(true)
  alertDueTodayTime      String              @default("08:00")
  alertDueInDays         Int?                // null = desativado
  alertOverdue           Boolean             @default(true)
  alertLowBalance        Boolean             @default(false)
  alertLowBalanceAmount  Decimal?
  alertPendingApproval   Boolean             @default(true)
  alertDailySummary      Boolean             @default(false)
  alertDailySummaryTime  String              @default("08:00")
  alertWeeklySummary     Boolean             @default(false)
  alertWeeklyDay         Int?                // 0=Dom, 1=Seg ... 6=Sáb
  createdAt              DateTime            @default(now())
  updatedAt              DateTime            @updatedAt

  user                   User                @relation(fields: [userId], references: [id])

  @@unique([userId, channel])
}

// ─── AUDITORIA ───────────────────────────────────────────────────────────────

model AuditLog {
  id         String   @id @default(cuid())
  userId     String
  action     String   // CREATE | UPDATE | DELETE | APPROVE | REJECT | LOGIN etc.
  entity     String   // Transaction | Budget | User | Project etc.
  entityId   String
  oldValues  Json?
  newValues  Json?
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime @default(now())

  user       User     @relation(fields: [userId], references: [id])
}
```

---

## PLANO DE EXECUÇÃO EM FASES

### FASE 1 — Fundação e Autenticação (Semana 1–2)
**Objetivo:** Ambiente rodando com controle de acesso funcional

- [ ] Docker Compose: PostgreSQL, Redis, backend, frontend, telegram-bot
- [ ] Schema Prisma completo com todas as entidades e migrations
- [ ] Módulo de autenticação: registro, login, JWT (access + refresh), logout, recuperação de senha
- [ ] Sistema de perfis: SystemRole (ADMIN/USER) + ProjectRole (GESTOR/ANALISTA)
- [ ] Guards e decorators: `AuthGuard`, `ProjectAccessGuard`, `@RequiresRole`, `@RequiresProjectRole`
- [ ] CRUD de Usuários com controle por SystemRole
- [ ] CRUD de Projetos com associação de usuários e perfis por projeto
- [ ] Tela de login, tela de perfil do usuário, layout base do dashboard
- [ ] Testes: autenticação, guards de autorização, regras de perfil

**Entrega:** Sistema rodando com login, criação de projetos e controle de acesso por perfil

---

### FASE 2 — Cadastros Base (Semana 2–3)
**Objetivo:** Todos os cadastros funcionais via interface web

- [ ] **Clientes:** CRUD completo com dados cadastrais, financeiros, vinculação a projetos e visão consolidada
- [ ] **Fornecedores:** CRUD completo com dados cadastrais e bancários
- [ ] **Plano de contas:** CRUD hierárquico (Pacote → Categoria → Subcategoria) com tipos Receita/Despesa
- [ ] **Contas bancárias:** CRUD com saldo calculado
- [ ] **Cartões de crédito:** CRUD com limite disponível
- [ ] **Centros de custo:** CRUD por projeto
- [ ] **Configurações de notificação:** tela de perfil com vinculação Telegram (token de 6 dígitos)
- [ ] Telas de administração acessíveis conforme perfil (Admin vê tudo; Gestor edita o próprio projeto)
- [ ] APIs documentadas no Swagger

**Entrega:** Módulo de Configurações completo com controle de acesso por perfil

---

### FASE 3 — Orçamento (Semana 3–4)
**Objetivo:** Criação e gestão de orçamentos

- [ ] CRUD de orçamentos com versionamento
- [ ] Linhas orçamentárias com os 4 tipos de distribuição e vinculação a cliente (receita) / fornecedor (despesa)
- [ ] Geração automática de valores mensais
- [ ] Fluxo de aprovação: submeter → aprovar / rejeitar com comentário
- [ ] Interface de edição tipo planilha (grid editável)
- [ ] Comparativo entre versões (delta R$ e %)
- [ ] Importação via Excel/CSV com template para download

**Entrega:** Módulo de Orçamento funcional com aprovação por perfil

---

### FASE 4 — Lançamentos (Semana 4–5)
**Objetivo:** Registro completo de compromissos financeiros

- [ ] CRUD de lançamentos com todos os campos (cliente obrigatório em receita, fornecedor em despesa)
- [ ] Fluxo de aprovação por perfil: Analista cria como "Aguardando Aprovação"; Gestor/Admin aprova
- [ ] Lançamentos recorrentes com edição granular (este / este e futuros / todos)
- [ ] Upload múltiplo de comprovantes (imagem e PDF)
- [ ] Rateio entre projetos/centros de custo
- [ ] Filtros avançados: por projeto, tipo, status, cliente, fornecedor, período, categoria

**Entrega:** Módulo de Lançamentos com controle de aprovação funcional

---

### FASE 5 — Bot Telegram (Semana 5–6)
**Objetivo:** Input de dados e notificações via Telegram

- [ ] Configuração do bot com Telegraf.js
- [ ] Fluxo de vinculação de conta (token de 6 dígitos)
- [ ] Fluxo de criação de despesa (com seleção de fornecedor e categoria)
- [ ] Fluxo de criação de receita (com seleção de cliente e categoria)
- [ ] Recebimento e upload de comprovantes via bot
- [ ] Comandos de consulta: `/vencimentos`, `/saldo`, `/resumo`, `/pendentes`, `/aprovar`, `/clientes`
- [ ] Sistema de notificações agendadas com Bull + Redis (vencimentos, atrasos, aprovações, resumos)

**Entrega:** Bot Telegram funcional integrado

---

### FASE 6 — Conciliação Bancária (Semana 6–7)
**Objetivo:** Importação e conciliação de extratos

- [ ] Parser OFX nativo
- [ ] Parser CSV com mapeamento configurável de colunas
- [ ] Algoritmo de conciliação automática com tolerância configurável
- [ ] Interface de conciliação manual em duas colunas com drag-and-drop
- [ ] Fluxo de criação de lançamento a partir do extrato
- [ ] Relatório de conciliação exportável em PDF e Excel

**Entrega:** Módulo de Conciliação funcional

---

### FASE 7 — Dashboard e Relatórios (Semana 7–8)
**Objetivo:** Visualizações, análises e exportações

- [ ] Painel 1: Visão Geral (cards + alertas + mini-gráfico)
- [ ] Painel 2: Orçado × Planejado × Realizado (barras + área + tabela drill-down)
- [ ] Painel 3: Fluxo de Caixa com projeção futura
- [ ] Painel 4: Posição de Clientes e Receitas (inadimplência, receitas por cliente)
- [ ] Painel 5: Pendências e próximos vencimentos
- [ ] Painel 6: Status de conciliação
- [ ] Filtros globais persistentes por usuário
- [ ] Exportação de todos os relatórios (PDF + Excel)

**Entrega:** Dashboard completo — sistema pronto para uso em produção

---

### FASE 8 — Refinamentos e Expansões (Semana 8+)
- [ ] Open Finance Brasil (integração OAuth2 com bancos)
- [ ] WhatsApp via Evolution API self-hosted
- [ ] 2FA (autenticação de dois fatores) para todos os usuários
- [ ] PWA (Progressive Web App) para uso mobile via browser
- [ ] Log de auditoria completo com interface para Admin
- [ ] Backup automático agendado do banco de dados
- [ ] Testes de integração e carga

---

## INSTRUÇÕES PARA O CLAUDE CODE

Ao iniciar cada fase:
1. Leia este documento integralmente antes de escrever qualquer código
2. Verifique o que já foi implementado nas fases anteriores
3. Crie os arquivos conforme a estrutura de pastas definida
4. Implemente os guards de autorização desde a Fase 1 — nunca deixar endpoints sem proteção
5. Escreva testes para: autenticação, regras de perfil, cálculos financeiros, algoritmo de conciliação
6. Atualize o README.md com instruções de instalação e uso
7. Nunca quebre funcionalidades já implementadas em fases anteriores
8. Use variáveis de ambiente para todas as credenciais — jamais hardcode de chaves ou senhas
9. Documente todos os endpoints no Swagger (NestJS tem suporte nativo com `@ApiTags`, `@ApiOperation`)
10. Implemente soft delete em todos os cadastros (campo `deletedAt`) e filtrar registros deletados automaticamente

**Ao finalizar cada fase, apresente:**
- Lista completa do que foi implementado
- Comandos para testar localmente (curl ou link Swagger)
- Cobertura de testes executada
- O que ficou pendente para a próxima fase

---

## CONFIGURAÇÕES DE AMBIENTE (.env.example)

```env
# ── Banco de Dados ──────────────────────────────────
DATABASE_URL="postgresql://user:password@localhost:5432/financial_control"

# ── Redis ───────────────────────────────────────────
REDIS_URL="redis://localhost:6379"

# ── JWT ─────────────────────────────────────────────
JWT_SECRET="troque-por-uma-string-aleatoria-longa"
JWT_REFRESH_SECRET="troque-por-outra-string-aleatoria"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# ── E-mail (notificações e recuperação de senha) ────
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="seu-email@gmail.com"
SMTP_PASS="sua-senha-de-app-google"
SMTP_FROM="Sistema Financeiro <seu-email@gmail.com>"

# ── Telegram Bot ────────────────────────────────────
TELEGRAM_BOT_TOKEN="token-gerado-no-botfather"

# ── WhatsApp (Evolution API — fase futura) ──────────
EVOLUTION_API_URL="http://localhost:8080"
EVOLUTION_API_KEY="sua-api-key"
EVOLUTION_INSTANCE="nome-da-instancia"

# ── Upload de arquivos ──────────────────────────────
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE_MB=10

# ── Open Finance Brasil (fase futura) ───────────────
OPEN_FINANCE_CLIENT_ID=""
OPEN_FINANCE_CLIENT_SECRET=""
OPEN_FINANCE_REDIRECT_URI=""

# ── Frontend ─────────────────────────────────────────
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_WS_URL="ws://localhost:3001"

# ── Ambiente ─────────────────────────────────────────
NODE_ENV="development"
PORT=3001
```

---

## COMO INICIAR O PROJETO VIA POWERSHELL

```powershell
# 1. Criar a pasta raiz do projeto
New-Item -ItemType Directory -Name "financial-control"
Set-Location financial-control

# 2. Iniciar o Claude Code
claude

# 3. Dentro do Claude Code, cole este documento completo e diga:
#    "Leia o documento acima e apresente a arquitetura e o plano
#     de fases para minha aprovação antes de iniciar qualquer código."

# 4. Após aprovação, para iniciar a Fase 1 diga:
#    "Inicie a FASE 1: crie o Docker Compose, o schema Prisma completo,
#     o backend NestJS com autenticação JWT e o sistema de perfis
#     (Admin/Gestor/Analista). Ao final, mostre os comandos para
#     subir o ambiente e testar o login."
```

---

## OBSERVAÇÕES FINAIS

- **Telegram é 100% gratuito:** Bot API sem limite de mensagens, sem custo por notificação
- **WhatsApp via Evolution API:** open source e self-hosted; requer um número de WhatsApp dedicado ao bot; sem custo de mensagens
- **Open Finance Brasil:** API gratuita do Banco Central; para produção requer registro como TPP; para desenvolvimento usar sandbox oficial
- **OFX:** suportado por todos os grandes bancos brasileiros para exportação manual de extratos (BB, Bradesco, Itaú, Caixa, Santander, Nubank, Inter, C6 Bank)
- **Segurança em produção:** HTTPS obrigatório; considerar criptografia em repouso para dados sensíveis (taxId, dados bancários de clientes/fornecedores); rate limiting nos endpoints de autenticação
- **Perfis e projetos:** um usuário com SystemRole USER pode ser Gestor em um projeto e Analista em outro — o controle é sempre no nível do projeto, não global

---

*Prompt elaborado para uso com Claude Code — Versão 2.0*
*Inclui: perfis Admin / Gestor / Analista com matriz de permissões + cadastro completo de Clientes*
