# Jards MCP Server

Servidor MCP (Model Context Protocol) para os dados do Jards no Supabase: projetos,
empresas (CRM), contatos, propostas, tarefas, captadores, proponentes, editais e a
base pública de patrocinadores.

## Autenticação — cada usuário só vê o que já vê no app

O servidor **nunca usa a service role key**. Ele se autentica no Supabase com a anon
key + e-mail/senha da própria conta Jards da pessoa (`JARDS_USER_EMAIL` /
`JARDS_USER_PASSWORD`), exatamente como o app web faz. A partir daí:

- Todo acesso passa pelo **Row Level Security (RLS)** do banco — as mesmas policies
  que restringem o app web. Dados de CRM (`projetos_crm`, `propostas`, `tarefas`,
  `contatos`, `empresas_crm`, `captadores`, `proponentes`) ficam automaticamente
  restritos às organizações das quais o usuário é membro.
- **Editais e a base pública de patrocinadores** (`editais`, `empresas`) não são
  escopados por organização — são compartilhados entre todos os clientes do Jards, de
  propósito, então qualquer usuário autenticado pode consultá-los.
- **Ver contatos de uma empresa consome crédito** da organização, na primeira vez —
  a ferramenta `listar_contatos` chama a função `fn_desbloquear_empresa`, a mesma
  RPC que o app usa no modal de desbloqueio. Se a empresa já estiver desbloqueada,
  não cobra de novo. Sem créditos disponíveis, a chamada falha com o mesmo erro do
  app ("Sem créditos disponíveis...").

Ou seja: não existe um "modo admin" escondido — quem configura o MCP com a própria
conta só consegue fazer, via Claude, o que já consegue fazer logado no Jards.

## Configuração

```bash
cd mcp-server
npm install
npm run build
```

Variáveis de ambiente necessárias:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `JARDS_USER_EMAIL` — e-mail da conta Jards da pessoa
- `JARDS_USER_PASSWORD` — senha dessa conta

> Se o login do Jards for só por magic link/SSO (sem senha), essa pessoa precisa
> primeiro definir uma senha na própria conta (ou avise que eu troco a autenticação
> do MCP para usar um refresh token de sessão em vez de senha).

## Uso no Claude Desktop / Claude Code

Cada pessoa configura com **as próprias credenciais** — nunca compartilhe uma config
com `JARDS_USER_EMAIL`/`JARDS_USER_PASSWORD` de outra pessoa.

```json
{
  "mcpServers": {
    "jards": {
      "command": "node",
      "args": ["/caminho/absoluto/para/jards-app/mcp-server/dist/index.js"],
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "https://SEU_PROJETO.supabase.co",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY": "...",
        "JARDS_USER_EMAIL": "voce@suaempresa.com",
        "JARDS_USER_PASSWORD": "..."
      }
    }
  }
}
```

Reinicie o Claude Desktop/Code. Ferramentas disponíveis:

**Identidade:** `listar_minhas_organizacoes`.

**CRM (escopado por organização, via RLS):** `listar_projetos`, `obter_projeto`,
`listar_empresas_crm`, `listar_contatos` (consome crédito), `listar_propostas`,
`listar_tarefas`, `listar_captadores`, `listar_proponentes`.

**Base pública compartilhada (sem escopo de organização):** `listar_editais`,
`listar_patrocinadores_publicos`.

**Análise:** `avaliar_carteira_empresa` (carteira de uma empresa a partir dos
projetos que ela já patrocinou — histórico, valor total, ticket médio, áreas
recorrentes, tempo desde o último patrocínio) e `resumo_organizacao` (projetos por
fase, propostas por status, tarefas por status, valor total captado).

**Criação:** `criar_contato` e `criar_tarefa`.

`organization_id` é opcional em todas as ferramentas de CRM: se o usuário pertence a
uma única organização, é resolvido automaticamente; se pertence a mais de uma, é
obrigatório informar (use `listar_minhas_organizacoes` para descobrir os IDs).

## Uso em um Custom GPT (ChatGPT)

ChatGPT não fala MCP — Custom GPTs usam "Actions" via OpenAPI/REST. Ainda não existe
esse wrapper neste repositório. Caminho recomendado: rotas REST em `app/api/mcp/*`
que reusem `src/tools.ts`, autenticadas com a sessão normal do usuário no Jards (não
com e-mail/senha soltos), e um `openapi.json` publicado para o Custom GPT. Avise se
quiser que eu implemente.

## Limitações conhecidas

- Login por senha fica guardado em texto puro na config do Claude Desktop — é
  aceitável para uso individual local, mas não deveria ser distribuído em massa
  sem trocar para um esquema de token de longa duração.
- Não há revogação por ferramenta: quem tem a config ativa tem todo o acesso que a
  própria conta Jards já tem (igual ao app web).
