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

Reinicie o Claude Desktop/Code. As ferramentas `listar_projetos`, `obter_projeto`,
`listar_empresas`, `listar_propostas`, `listar_tarefas`, `listar_captadores` e
`listar_proponentes` ficam disponíveis na conversa.

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
- Todas as ferramentas são **somente leitura**. Ferramentas de escrita (criar tarefa,
  registrar atividade etc.) podem ser adicionadas depois, mas exigem mais cuidado com
  permissões por usuário.
