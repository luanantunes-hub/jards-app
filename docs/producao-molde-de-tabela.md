# Molde de tabela nova da produção

Toda tabela nova da produção repete o mesmo miolo: a migration (colunas, regras, gatilhos, segurança por linha, permissões), o bloco de tipos em `lib/producao/banco.ts`, a linha do teste de histórico e o teste de banco (quem lê, quem grava). Dois comandos fazem esse miolo; **o que é da tabela** (as colunas, as regras de forma e os casos de forma do teste) continua sendo escrito por quem faz a entrega.

## 1. Gerar

```bash
npx tsx scripts/molde-de-tabela.ts --molde org --tabela producao_marcas \
  --cabecalho "PD12.3: marcas que apresentam as sessões da programação pública" \
  --colunas "nome text not null; site_url text; arquivada boolean not null default false" \
  --regras "nome_check: char_length(btrim(nome)) between 1 and 120" \
  --unico "organization_id, lower(btrim(nome))" \
  --exemplo "nome|'Marca {n}'" --motivo-sem-historico "é só texto que a produção escolhe mostrar" --aplicar
```

| Opção | O que é |
|---|---|
| `--molde org` | tabela da organização (acesso como `producao_veiculos`). `--molde filha` é a tabela que pende de outra: pede também `--pai <tabela>` e `--coluna-do-pai <coluna>` |
| `--tabela` | nome, começando com `producao_` |
| `--colunas` | `nome tipo [not null] [default ...]`, separadas por `;`. Tipos que o gerador converte: text, uuid, date, time, timestamptz, boolean, integer, bigint, numeric, varchar |
| `--regras` | `nome_check: expressão`, separadas por `;` (viram `constraint <tabela>_<nome> check (...)`) |
| `--unico` | colunas (ou expressão) de um índice único |
| `--exemplo` | `colunas|valores` de uma linha de exemplo para o teste; `{n}` vira um rótulo único por linha |
| `--aplicar` | põe o bloco de tipos em `lib/producao/banco.ts` e a linha em `tests/producao-historico-sql.test.ts`; sem ele, os dois saem na tela |

Sai: `supabase/migrations/<versão>_<tabela>.sql` (a versão é a maior que existe mais 100000), e para `--molde org` também `supabase/tests/<tabela>.test.sql`. Para `--molde filha` o teste de banco não é gerado: copie `supabase/tests/producao_temporada_links.test.sql` e adapte.

**Depois de gerar, complete à mão:** o comentário da migration (o que a tabela guarda e o que nunca guarda), o `comment on table`, o motivo de não ter histórico (ou, se terá, ligue o gatilho `fn_producao_historico` e os testes de histórico), os **casos de forma** no fim do teste (um por regra) e, se houver, o que é específico (funções, links, colunas extras).

## 2. Rodar o teste de banco (desfeito no fim)

```bash
npx tsx scripts/rodar-teste-banco.ts supabase/tests/producao_marcas.test.sql
# com a migration na frente, na mesma transação, sem aplicá-la:
npx tsx scripts/rodar-teste-banco.ts supabase/tests/producao_marcas.test.sql --migration supabase/migrations/<arquivo>.sql
```

Diz "N de N verificações rodaram; nenhuma falha" (ou lista as que falharam) e **desfaz tudo**. Usa o Supabase CLI ligado ao projeto (`supabase login` e `supabase link`). Depois, confira que nada ficou no banco (esquema, organizações e usuários de teste).

## 3. O que continua sendo obrigatório

`npx tsc --noEmit`, `npm test` (o teste de tipos confere a tabela e as colunas contra as migrations, e o de histórico exige que a tabela esteja na lista de "com histórico" ou "sem histórico, com motivo") e o teste automático do PR. O gerador economiza digitação, não verificação.
