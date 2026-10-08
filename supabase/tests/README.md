# Testes de banco

`prestacao_rls.test.sql` confere, com pgTAP, quem lê, cria, altera e apaga cada parte da prestação de contas e os arquivos dela no bucket `documentos`. O arquivo monta o próprio cenário (três organizações, oito pessoas e um visitante, todos com id `f0000000-0000-4000-8000-…`), roda as verificações e termina em `rollback`: nada fica gravado, nem o pgTAP, que é instalado dentro da transação.

`normas_rls.test.sql` confere o vigia normativo (P1.10, P6.1 e P6.2): só o super admin lê os atos, as versões de página, as cópias, as coletas e as propostas da IA, cadastra fontes e confere pelas funções, dizendo os regimes afetados; os avisos saem e as rotinas estão agendadas. Roda do mesmo jeito.

`regimes_publicacao.test.sql` confere a publicação dos regimes (P6.3): ninguém escreve direto na tabela, o rascunho é a versão seguinte e um por regime, a pessoa comum não vê o rascunho, regra de bloqueio pede duas pessoas diferentes e a outra é avisada, publicar deixa a anterior obsoleta, descartar e rejeitar funcionam. Roda do mesmo jeito.

O `npm test` não fala com o banco, mas `tests/prestacao-rls.test.ts` falha se uma tabela nova da prestação ficar sem sonda ou se o número de verificações não bater com o `plan`.

## Rodar

**Com psql** (banco de produção, branch do Supabase ou local):

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/prestacao_rls.test.sql
```

A saída é TAP: `ok`/`not ok` por verificação e, no fim, `# Looks like you failed N tests` quando algo quebra.

**Pelo editor SQL do Supabase ou por um conector** que devolve só o último resultado:

```bash
npx tsx scripts/testes-banco-em-bloco.ts supabase/tests/prestacao_rls.test.sql > bloco.sql
```

Cole o conteúdo de `bloco.sql` e rode. O bloco termina com o erro `BLOCO DESFEITO`, que traz a saída TAP e desfaz tudo. O editor avisa que há comandos destrutivos (as sondas de exclusão): pode confirmar, porque também são desfeitas. O conector do Supabase usado pelo Claude pede a mesma confirmação para comandos `DELETE FROM` e, numa sessão sem como mostrá-la, para depois de 60 segundos; por ele, rode o arquivo sem as sondas de exclusão e confira quem pode apagar avaliando as regras de `pg_policies` como cada pessoa (foi o que se fez em 05/10/2026).

**Uma migration antes de aplicar:** ponha o arquivo dela na frente.

```bash
npx tsx scripts/testes-banco-em-bloco.ts supabase/migrations/<nova>.sql supabase/tests/prestacao_rls.test.sql > bloco.sql
```

Os testes rodam sobre a migration, e as duas coisas são desfeitas no fim.

**`supabase test db`** roda os arquivos desta pasta num banco local criado pelas migrations. Ainda não foi conferido se a cadeia sobe do zero (não há `seed.sql`; veja a P0.8 no plano); até lá, use as formas acima.
