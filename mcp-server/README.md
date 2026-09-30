# Jards MCP Server

Servidor MCP (Model Context Protocol) somente leitura para os dados do Jards no Supabase:
projetos, empresas (patrocinadores), propostas, tarefas, captadores e proponentes.

## Por que fica fora do app Next.js

É um processo separado (stdio), não uma rota do Next — roda localmente no computador de
quem está usando o Claude, não no servidor web do Jards.

## Configuração

```bash
cd mcp-server
npm install
npm run build
```

Variáveis de ambiente necessárias (mesmas do projeto principal):

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

A service role key ignora RLS, então **toda ferramenta exige `organization_id`** e filtra
explicitamente por ele — nunca adicione uma ferramenta nova sem esse filtro.

## Uso no Claude Desktop / Claude Code

Adicione ao `claude_desktop_config.json` (ou via `claude mcp add`):

```json
{
  "mcpServers": {
    "jards": {
      "command": "node",
      "args": ["/caminho/absoluto/para/jards-app/mcp-server/dist/index.js"],
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "https://SEU_PROJETO.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "..."
      }
    }
  }
}
```

Reinicie o Claude Desktop/Code. As ferramentas ficam disponíveis na conversa:

**Leitura:** `listar_projetos`, `obter_projeto`, `listar_empresas`, `listar_contatos`,
`listar_propostas`, `listar_tarefas`, `listar_captadores`, `listar_proponentes`.

**Análise:** `avaliar_carteira_empresa` (monta a carteira de uma empresa a partir dos
projetos que ela já patrocinou — histórico, valor total, ticket médio, áreas
recorrentes, tempo desde o último patrocínio) e `resumo_organizacao` (visão geral:
projetos por fase, propostas por status, tarefas pendentes, valor total captado).

**Criação:** `criar_contato` e `criar_tarefa`.

Todas exigem `organization_id`. As ferramentas de criação resolvem automaticamente o
`account_id` legado a partir da organização — não precisa ser informado.

## Uso em um Custom GPT (ChatGPT)

ChatGPT não fala MCP nativamente — Custom GPTs usam "Actions" via OpenAPI/REST. As
opções são:

1. **Reaproveitar a mesma lógica** criando rotas REST em `app/api/mcp/*` no Next.js que
   chamem as mesmas funções de `src/tools.ts` (extraídas para um pacote compartilhado),
   protegidas por uma API key própria (não a service role), e publicar um `openapi.json`
   com esses endpoints para o Custom GPT.
2. Ou usar um gateway MCP→REST (ex. um proxy que expõe cada tool MCP como endpoint HTTP)
   na frente deste mesmo servidor.

Esse wrapper REST ainda não existe neste repositório — avise se quiser que eu implemente
a opção 1 (rotas em `app/api/mcp/*` + `openapi.json`), que é a mais simples de manter em
sincronia com este servidor MCP.

## Segurança

- A service role key nunca deve sair da máquina local / do ambiente do Claude.
- Ferramentas de criação (`criar_contato`, `criar_tarefa`) escrevem no banco real —
  quem tiver esse MCP configurado consegue criar registros na organização informada.
  Não há checagem de "este usuário pertence a esta organização": o controle de acesso
  hoje é "quem tem a service role key e o `organization_id`", então trate as
  credenciais com o mesmo cuidado de um acesso admin.
