# Jards MCP Server

> **Para o dia a dia, use o conector remoto do Jards** (Configurações → Claude e ChatGPT (MCP)): não instala
> nada nem pede senha, cada pessoa só autoriza com a própria conta. Este servidor local serve para
> desenvolvimento e para quem não pode usar o conector.

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

ChatGPT não fala MCP — Custom GPTs usam "Actions" via OpenAPI/REST. Isso já existe no
app Next.js (não aqui): rotas REST em `app/api/mcp/*` e o schema publicado em
`/api/mcp/openapi.json`. Duas formas de autenticar, veja `/configuracoes/mcp` no app
para o passo a passo de cada uma:

1. **OAuth (recomendado para GPT compartilhada com o time)** — cada pessoa autoriza
   com a própria conta Jards na tela `/oauth/authorize` na primeira vez que usa a GPT;
   ninguém herda o acesso de outra pessoa. Requer configurar no ambiente:
   - `OAUTH_CHATGPT_CLIENT_ID` / `OAUTH_CHATGPT_CLIENT_SECRET` — gere com
     `openssl rand -hex 24` cada; esses mesmos valores vão no campo Client ID/Secret
     da aba OAuth da Action no GPT builder.
   - Authorization URL: `{domínio}/oauth/authorize` · Token URL:
     `{domínio}/api/mcp/oauth/token`.
   - Fluxo: código de autorização de uso único (10 min) → access token de 1h
     (armazenado como mais uma linha em `mcp_api_keys`, `source = 'oauth'`) + refresh
     token de 90 dias com rotação a cada uso.

2. **Chave manual (API Key/Bearer)** — para uso individual, numa GPT que a própria
   pessoa criou e não compartilha. Cada chave tem escopo (`somente leitura` ou
   `leitura + criação`) e prazo de validade, gerados em `/configuracoes/mcp`.

**Se for usar chave manual**: uma Custom GPT com Action em modo API Key guarda UMA
chave, usada por qualquer pessoa que utilizar aquela GPT. Nunca publique/compartilhe
uma GPT configurada dessa forma — é exatamente o problema que o modo OAuth resolve.

## Privacidade

Toda pergunta feita ao Claude que acione uma ferramenta deste servidor envia os
dados pedidos (incluindo, quando a pergunta envolver contatos, dados pessoais de
terceiros — nome, e-mail, telefone, cargo) para os servidores da Anthropic, para
gerar a resposta. A Jards não controla a política de retenção/treinamento da
Anthropic sobre esses dados — veja a [política de privacidade da
Anthropic](https://www.anthropic.com/legal/privacy) e o §3.3 da [política de
privacidade do Jards](/privacidade#s3).

## Limitações conhecidas

- Login por senha (deste servidor MCP, para Claude) fica guardado em texto puro na
  config do Claude Desktop — aceitável para uso individual local, mas não deveria
  ser distribuído em massa sem trocar para um esquema de token de longa duração.
- Não há revogação por ferramenta neste servidor: quem tem a config ativa tem todo
  o acesso que a própria conta Jards já tem (igual ao app web). No wrapper REST
  (`app/api/mcp/*`) já existe escopo (leitura/escrita) e expiração por chave.
- Os limitadores de taxa do wrapper REST são em memória, por instância do servidor
  — não são um teto exato sob múltiplas instâncias, mas contêm abuso e scripts.
