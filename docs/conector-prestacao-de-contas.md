# Conector da prestação de contas (Claude e ChatGPT)

O mesmo servidor MCP (`/api/mcp/server`) e a mesma spec OpenAPI (`/api/mcp/openapi.json`) que atendem a captação passaram a atender a prestação de contas, por **módulo**. Este arquivo diz como o conector é montado, o que ele nunca faz, como ligar e como provar com contas reais.

## Como é montado

- **Um servidor, módulos separados.** Cada operação pertence a um módulo (`captacao` ou `prestacao`); cada módulo tem a spec própria (`lib/mcp/openapi.ts`, `lib/mcp/openapi-prestacao.ts`), as instruções próprias e o teto de 30 operações. `/api/mcp/openapi.json?modulo=prestacao` é o que a segunda GPT importa; sem `modulo`, a GPT de sempre não muda.
- **A chave só enxerga o que foi consentido.** `mcp_api_keys.modulos` (e as tabelas de OAuth) guardam os módulos autorizados; o padrão é `{captacao}`, então nenhuma conexão antiga ganha a prestação sem nova autorização. A tela de consentimento (`/oauth/authorize`) tem uma caixa por módulo; na GPT, o `scope` leva o módulo (`write prestacao`).
- **Quem usa.** Só a equipe da organização: membro com `prestacao` em `modulos_acesso` e papel admin, colaborador, visualizador ou leitor. Módulo em vigor grava; só em `modulos_leitura` (sem assinatura) só consulta. Quem só usa a prestação não precisa da assinatura da captação.
- **Trava de lançamento.** `MCP_PRESTACAO_LIBERADA` (variável de ambiente): sem ela ninguém autoriza a prestação; `todos` libera quem tem acesso ao módulo; ou uma lista de e-mails/ids separada por vírgula. Só vale para novas autorizações.
- **Escrita com a chave de serviço, com as travas refeitas no código.** O conector ignora o RLS, então cada gravação pergunta ao banco se a pessoa edita a prestação (`fn_mcp_prestacao_pode`, testada contra `auth_prestacao_pode`), confere a trava do envio, valida que meta, local, atividade e item são da prestação, e deixa trilha em `assistente_acoes` com o que havia antes.

## O que o assistente nunca faz

Mudar status, registrar ou reabrir envio, avaliar, aceitar, rejeitar ou dispensar, diligências, decisões, glosas, recursos, excluir (só **retira** o que ele mesmo criou, enquanto está pendente), descarte de dados pessoais, convites, links de patrocinador, e-mail de captura, cobrança. Nunca sai: token da captura por e-mail, conta bancária, dados de beneficiários, caminho de arquivo no Storage; CPF volta mascarado.

## Ferramentas

| Grupo | Operações |
|---|---|
| Consulta | `listar_organizacoes_da_prestacao`, `listar_prestacoes`, `obter_prestacao`, `listar_pendencias_da_prestacao`, `listar_despesas_da_prestacao`, `obter_orcamento_da_prestacao`, `explicar_verificacao`, `obter_objeto_da_prestacao`, `obter_relatorio_da_prestacao` |
| Arquivos pelo chat | `enviar_arquivos`, `preparar_envio_de_arquivos`, `conferir_envio_de_arquivos`, `listar_arquivos_recebidos` |
| Gravação | `registrar_despesas` (pendentes), `registrar_evidencia`, `registrar_atividades`, `atualizar_atividade`, `atualizar_meta`, `salvar_secao_do_relatorio`, `rodar_verificacoes` |
| Trilha | `listar_acoes_do_assistente`, `retirar_registro_do_assistente` |
| Diagnóstico (sai depois da prova) | `diagnosticar_arquivos`, `preparar_upload_de_diagnostico`, `conferir_upload_de_diagnostico` |

Regras de gravação que valem para todas: o que o assistente cria entra **pendente** (despesa e evidência levam `canal = 'assistente'` e o selo "Enviada pelo assistente"); `null` e texto vazio num campo opcional **não mudam nada** (para esvaziar, a lista `limpar`); texto que a equipe já escreveu no relatório só troca com `substituir: true`, e o de antes fica na trilha; a equipe é avisada (`fn_prestacao_avisar_assistente`) e vê tudo no card **Ações do assistente** da visão geral, onde também retira o que o assistente criou.

## Arquivos pelo chat

Tudo cai numa caixa de entrada (`assistente_arquivos`): tipo conferido pelos bytes, até 15 MB, mesmo conteúdo (SHA-256) uma vez só por prestação, expira em 7 dias se ninguém registrar. Três entradas:

1. **ChatGPT (GPT personalizada):** `enviar_arquivos` recebe os anexos pela Action (`openaiFileIdRefs`, até 10, link válido por 5 minutos, só hosts da OpenAI).
2. **Claude e qualquer outro:** `preparar_envio_de_arquivos` devolve ou (a) endereços assinados de upload direto ao Storage (PUT, para o ambiente de código do assistente; precisa liberar `*.supabase.co`), ou (b) um **link de envio** `/enviar/{código}` (sem login, 15 minutos, até 10 arquivos, só o hash do código fica no banco): a pessoa abre no computador ou no celular, escolhe os arquivos ou tira a foto, e a página já confere o que chegou.
3. **Texto colado:** `enviar_arquivos` com `conteudo_texto` (XML de nota, até 200 mil caracteres).

## Como ligar (nesta ordem)

1. Aplicar `supabase/migrations/*_mcp_modulos.sql` e depois `*_assistente_prestacao.sql` (aditivas; renomear o arquivo para a versão que o banco gravar). **Antes** de publicar o código: `lib/mcp/auth.ts` lê `modulos`.
2. Publicar o código (PR, CI Pre-deploy, merge).
3. Definir `MCP_PRESTACAO_LIBERADA` na Vercel (primeiro só o e-mail de quem testa).
4. Quem já tinha o Jards conectado desconecta e conecta de novo, marcando **Prestação de contas** (o cliente guarda a lista de ferramentas).

Para desligar: tirar a variável (some a opção para novas autorizações; o que já foi autorizado segue até revogar em `/configuracoes/mcp`).

## Roteiro da prova com contas reais

Ainda não rodou. O que precisa ser visto numa conta real, em cada plataforma:

- **Claude:** reconectar com a prestação marcada; `listar_prestacoes`; colar o XML de uma nota (`enviar_arquivos` → `registrar_despesas`); pedir um PDF pelo link (`preparar_envio_de_arquivos` modo link → abrir → enviar → "enviei" → `listar_arquivos_recebidos` → `registrar_despesas`); no ambiente de código, `preparar_envio_de_arquivos` modo endereço e `curl -X PUT` (confere se o Claude alcança `*.supabase.co`). Depois, em `/prestacoes/{id}/comprovantes`, a despesa pendente com o selo, e o card **Ações do assistente**.
- **ChatGPT:** criar a GPT da prestação (instruções, schema `?modulo=prestacao` e OAuth `write prestacao`, todos na tela `/configuracoes/mcp`); anexar um PDF e pedir para registrar. Conferir se `openaiFileIdRefs` chega preenchido (`diagnosticar_arquivos` mostra o que chegou sem gravar nada). Se não chegar, o plano B é o link de envio.
- **Casos negativos:** chave revogada, organização só para consulta (402 ao gravar), papel leitor (403), módulo não consentido (403), prestação de outra organização (404).

Depois da prova, **remover as três operações de diagnóstico**: `diagnosticarArquivos`, `prepararUploadDeDiagnostico` e `conferirUploadDeDiagnostico` em `lib/mcp/openapi-prestacao.ts`, os handlers em `lib/mcp/execucao.ts`, as rotas `app/api/mcp/prestacoes/diagnostico/**`, `lib/mcp/prestacao/diagnostico.ts` e os testes que as citam.

## Testes

`npm test` roda tudo; os do conector são `tests/mcp-*.test.ts`. As duas migrations têm teste de banco (`supabase/tests/mcp_modulos.test.sql`, `assistente_prestacao.test.sql`) e teste de texto (`tests/mcp-modulos-sql.test.ts`, `tests/mcp-assistente-sql.test.ts`); como rodá-los está em `supabase/tests/README.md`. `tests/mcp-prestacao-seguranca.test.ts` lê o código-fonte e trava as regras acima (nunca `select("*")`, colunas protegidas, organização conferida antes de qualquer leitura por id, gravação só com quem edita, página de envio aberta só com o link).
