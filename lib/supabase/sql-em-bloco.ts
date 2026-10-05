// Transforma arquivos SQL (migration e testes pgTAP) num único bloco `do`
// que roda tudo e termina em erro, para o banco desfazer cada mudança.
//
// Serve para rodar os testes de `supabase/tests/` em produção por um editor
// ou conector que manda uma consulta só e devolve só o último resultado: a
// saída TAP volta na mensagem do erro final. Com psql, pg_prove ou
// `supabase test db`, rode o arquivo de testes direto.

/** Comandos que o arquivo de teste usa para abrir e fechar a transação; dentro do bloco não cabem. */
const CONTROLE_DE_TRANSACAO = /^(begin|start\s+transaction|commit|end|rollback)\b/i;

/** Comandos cujo resultado vira saída (as linhas TAP do pgTAP). */
const DEVOLVE_LINHAS = /^(select|with|values|table)\b/i;

/**
 * Divide o texto em comandos no `;` de nível superior, sem os comentários de
 * fora dos comandos. Respeita aspas simples, identificadores entre aspas,
 * blocos com cifrão (`$$`, `$tag$`) e comentários `--` e `/* *\/`.
 */
export function dividirComandos(sql: string): string[] {
  const comandos: string[] = [];
  let atual = "";
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    const proximo = sql[i + 1];
    if (c === "-" && proximo === "-") {
      const fim = sql.indexOf("\n", i);
      i = fim === -1 ? sql.length : fim;
      continue;
    }
    if (c === "/" && proximo === "*") {
      const fim = sql.indexOf("*/", i + 2);
      if (fim === -1) throw new Error("Comentário /* sem fechamento");
      i = fim + 2;
      atual += " ";
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === c && sql[j + 1] === c) { j += 2; continue; }
        if (sql[j] === c) break;
        j++;
      }
      if (j >= sql.length) throw new Error(`Texto entre ${c} sem fechamento`);
      atual += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === "$") {
      const tag = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (tag) {
        const fim = sql.indexOf(tag[0], i + tag[0].length);
        if (fim === -1) throw new Error(`Bloco ${tag[0]} sem fechamento`);
        atual += sql.slice(i, fim + tag[0].length);
        i = fim + tag[0].length;
        continue;
      }
    }
    if (c === ";") {
      if (atual.trim()) comandos.push(atual.trim());
      atual = "";
      i++;
      continue;
    }
    atual += c;
    i++;
  }
  if (atual.trim()) comandos.push(atual.trim());
  return comandos;
}

/** Cifrão que não aparece em nenhum dos textos, para citar cada comando. */
function tagLivre(textos: string[], base: string): string {
  for (let n = 0; ; n++) {
    const tag = `$${base}${n || ""}$`;
    if (!textos.some(t => t.includes(tag))) return tag;
  }
}

/**
 * Bloco `do` que executa os comandos de todos os arquivos, na ordem, e
 * termina com `raise exception` levando a saída: nada fica gravado.
 */
export function emBlocoDesfeito(arquivos: string[]): string {
  const comandos = arquivos.flatMap(dividirComandos).filter(c => !CONTROLE_DE_TRANSACAO.test(c));
  const citacao = tagLivre(comandos, "cmd");
  const bloco = tagLivre(comandos, "bloco");
  const lista = comandos
    .map(c => `    '${DEVOLVE_LINHAS.test(c) ? "t" : "f"}', ${citacao}${c}${citacao}`)
    .join(",\n");
  return `do ${bloco}
declare
  comandos text[] := array[
${lista}
  ]::text[];
  i integer;
  linha record;
  saida text := '';
begin
  -- Pares (devolve linhas, comando): o par ímpar diz se o comando é uma consulta.
  for i in 1 .. array_length(comandos, 1) by 2 loop
    if comandos[i]::boolean then
      for linha in execute comandos[i + 1] loop
        saida := saida || coalesce((select string_agg(valor, ' ') from jsonb_each_text(to_jsonb(linha)) as par(chave, valor)), '') || E'\\n';
      end loop;
    else
      execute comandos[i + 1];
    end if;
  end loop;
  raise exception using message = E'BLOCO DESFEITO\\n' || saida;
end
${bloco};
`;
}
