# Jards

CRM e inteligência comercial para captação de patrocínios e gestão de projetos incentivados no Brasil.

O MVP conecta pesquisa de patrocinadores, editais, projetos, negociações, relacionamento, propostas, clientes e execução em uma única operação multiusuário. O produto atende Lei Rouanet, Lei do Esporte, Audiovisual, FIA, ICMS, ISS e categorias personalizadas.

## Estado do produto

**MVP concluído — setembro de 2026.**

O núcleo de captação está disponível no produto. O módulo de prestação de contas está implementado e protegido por acesso modular; sua liberação pública depende da configuração da organização e do usuário.

## O que está incluído

- base pesquisável de patrocinadores e editais;
- CRM de empresas, contatos e memória relacional;
- projetos com orçamento, documentos, textos, pitch e cotas;
- negociações e inscrições em lista, kanban e páginas de detalhe;
- atividades, prioridades, follow-ups e sincronização de calendário;
- propostas comerciais adaptadas a cotas e registro de vendas;
- conversão de negócios aprovados em clientes, contratos e entregas;
- saúde da parceria, ativação e planejamento de renovação;
- proponentes e captadores com scorecards e visão de relacionamento;
- notificações, equipes, papéis, assentos, créditos e billing;
- prestação de contas com orçamento, comprovantes, atividades, divulgação e relatório;
- blog público e painel administrativo com auditoria e impersonação controlada.

## Stack

| Camada | Tecnologia |
|---|---|
| Aplicação | Next.js 16, React 19 e TypeScript |
| Interface | Tailwind CSS 4, Lucide e Phosphor Icons |
| Dados | Supabase/PostgreSQL com RLS |
| Autenticação e arquivos | Supabase Auth e Storage |
| Pagamentos | Stripe Checkout, Billing Portal e webhooks |
| E-mail | Resend e integração Gmail |
| Agenda | Google Calendar e Microsoft Outlook |
| Processamento | Supabase Edge Functions |

## Desenvolvimento local

### Requisitos

- Node.js 20 ou superior;
- npm;
- um projeto Supabase ou Supabase CLI para ambiente local;
- credenciais dos serviços que serão exercitados.

### Instalação

```bash
npm install
cp .env.example .env.local
npm run dev
```

A aplicação fica disponível em [http://localhost:3000](http://localhost:3000).

Para um banco local:

```bash
supabase start
supabase db reset
```

O script `supabase/setup.sh` conecta e atualiza o projeto Supabase configurado, além de importar a base legada. Revise o `PROJECT_REF` antes de executá-lo em outro ambiente.

## Verificações

```bash
npm run typecheck
npm test
npm run build -- --webpack
```

O comando completo de pré-deploy é:

```bash
npm run predeploy
```

## Configuração

Use [.env.example](./.env.example) como inventário das variáveis da aplicação. Segredos nunca devem usar o prefixo `NEXT_PUBLIC_`.

As Edge Functions possuem variáveis próprias no Supabase. Em especial:

- Stripe: chaves, preços e webhook;
- calendário: credenciais Google/Microsoft e segredo de criptografia;
- extração de orçamento/comprovantes: `GOOGLE_AI_API_KEY`;
- e-mail transacional: Resend e domínio verificado.

## Documentação

- [Documentação completa do MVP](../DOCUMENTACAO.md)
- [Sistema visual e componentes](./DESIGN.md)
- [E-mail transacional](./docs/email-transacional.md)
- [Roadmap pós-MVP do dashboard](./docs/roadmap-modulos-dashboard-captacao.md)
- [Padrão de listas](./docs/LISTAS_PADRAO_OURO.md)

## Estrutura principal

```text
app/                    páginas e rotas de API
components/             componentes de domínio e interface
contexts/               organização, créditos, etiquetas e taxonomias
lib/                    integrações e regras de negócio puras
supabase/migrations/    histórico versionado do banco
supabase/functions/     Edge Functions
supabase/templates/     templates de autenticação
tests/                  testes de regras críticas e pré-deploy
```

## Segurança

- isolamento multi-tenant por organização e RLS;
- rotas privadas protegidas no servidor;
- service role restrita ao backend;
- limites de requisição por usuário/IP;
- CSP e cabeçalhos de segurança;
- tokens de calendário e e-mail armazenados de forma criptografada;
- logs administrativos e operações de billing idempotentes.

Antes de produção, execute o `predeploy`, valide as URLs permitidas no Supabase Auth e confirme a entrega dos templates transacionais.
