import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// PD0.11: a produção não nasce com `any`. O resto do app consulta o Supabase sem tipos do banco (há muitos
// `as any`), e é assim que coluna errada vira erro só em produção. O tipo do banco da produção
// (lib/producao/banco.ts) e o cliente tipado (lib/producao/cliente.ts) só valem se ninguém os contornar. Este teste
// lê, sem exceção, o que mora em lib/producao/ e todo arquivo do app que cita uma tabela ou uma função da produção
// (`producao_*`, `auth_producao_*`, `fn_producao_*`) num texto do código. Nesses arquivos não pode haver:
//   - o tipo `any` (`: any`, `as any`, `<any>`, `any[]`, `Record<string, any>`...);
//   - `eslint-disable` do no-explicit-any, nem `eslint-disable` sem regra (que a desliga junto);
//   - `@ts-ignore` nem `@ts-nocheck`, que apagam o erro do compilador do mesmo jeito.
// Um caso que pareça exigir `any` quer dizer que falta um tipo em lib/producao/banco.ts, ou o `unknown` e uma
// conferência. O cliente do app ganha os tipos da produção por uma conversão só, em lib/producao/cliente.ts (o
// último teste confere).
//
// Os testes (tests/), os documentos (docs/) e o SQL não entram: citam as tabelas sem consultá-las.

/** O que cita a produção num texto do código: a tabela, a função ou o começo de um nome montado (`producao_${x}`). */
const NOME_DA_PRODUCAO = /(?<![A-Za-z0-9_])(?:fn_|auth_)?producao_/;

/** Pastas da raiz que ficam de fora. Qualquer pasta escondida (.next, .git...) e node_modules, em qualquer nível, também. */
const RAIZES_IGNORADAS = new Set(["tests", "docs", "public", "supabase/migrations", "supabase/tests"]);

function fonteDe(caminho: string, texto: string): ts.SourceFile {
  return ts.createSourceFile(caminho, texto, ts.ScriptTarget.Latest, true);
}

/** Os comentários do arquivo, com o texto de cada um e a linha (1 a 1). */
function comentariosDe(fonte: ts.SourceFile): { texto: string; linha: number }[] {
  const texto = fonte.text;
  const vistos = new Map<number, { texto: string; linha: number }>();
  const juntar = (faixas: ts.CommentRange[] | undefined) => {
    for (const faixa of faixas ?? []) {
      vistos.set(faixa.pos, { texto: texto.slice(faixa.pos, faixa.end), linha: fonte.getLineAndCharacterOfPosition(faixa.pos).line + 1 });
    }
  };
  const ver = (no: ts.Node) => {
    juntar(ts.getLeadingCommentRanges(texto, no.getFullStart()));
    juntar(ts.getTrailingCommentRanges(texto, no.getEnd()));
    ts.forEachChild(no, ver);
  };
  ver(fonte);
  return [...vistos.values()];
}

/** O que o arquivo faz de proibido, uma frase por achado. */
function proibidoEm(fonte: ts.SourceFile): string[] {
  const achados: string[] = [];
  const linhaDe = (pos: number) => fonte.getLineAndCharacterOfPosition(pos).line + 1;
  const ver = (no: ts.Node) => {
    if (no.kind === ts.SyntaxKind.AnyKeyword) achados.push(`linha ${linhaDe(no.getStart(fonte))}: o tipo any`);
    ts.forEachChild(no, ver);
  };
  ver(fonte);
  // Só vale a diretiva que abre o comentário (`// eslint-disable-next-line ...`, `/* @ts-ignore */`); a palavra no meio de um texto não.
  for (const { texto, linha } of comentariosDe(fonte)) {
    const desliga = /^(?:\/\/+|\/\*+)\s*eslint-disable(?:-next-line|-line)?(?![\w-])([^\n]*)/.exec(texto);
    if (desliga) {
      const regras = desliga[1].replace(/\*\/.*$/, "").split("--")[0].trim();
      if (!regras) achados.push(`linha ${linha}: eslint-disable sem regra, que desliga o no-explicit-any junto`);
      else if (/no-explicit-any/.test(regras)) achados.push(`linha ${linha}: eslint-disable do no-explicit-any`);
    }
    const apaga = /^(?:\/\/+|\/\*+)\s*(@ts-ignore|@ts-nocheck)\b/.exec(texto);
    if (apaga) achados.push(`linha ${linha}: ${apaga[1]}`);
  }
  return achados;
}

/** O código cita a produção num texto: `.from("producao_datas")`, `.rpc("fn_producao_...")`, `select("*, producao_obras(titulo)")`. */
function citaAProducao(fonte: ts.SourceFile): boolean {
  let cita = false;
  const ver = (no: ts.Node) => {
    if (cita) return;
    if ((ts.isStringLiteralLike(no) || ts.isTemplateHead(no) || ts.isTemplateMiddle(no) || ts.isTemplateTail(no)) && NOME_DA_PRODUCAO.test(no.text)) cita = true;
    ts.forEachChild(no, ver);
  };
  ver(fonte);
  return cita;
}

/** O que reprova entre os arquivos (caminho → texto): os de lib/producao/ e os que citam a produção no código. */
function reprovados(arquivos: ReadonlyMap<string, string>): { lidos: string[]; achados: string[] } {
  const lidos: string[] = [];
  const achados: string[] = [];
  for (const [caminho, texto] of arquivos) {
    const doModulo = caminho.startsWith("lib/producao/");
    // O texto sem "producao_" não cita nada: só se abre a árvore do que pode citar.
    if (!doModulo && !NOME_DA_PRODUCAO.test(texto)) continue;
    const fonte = fonteDe(caminho, texto);
    if (!doModulo && !citaAProducao(fonte)) continue;
    lidos.push(caminho);
    for (const achado of proibidoEm(fonte)) achados.push(`${caminho}, ${achado}`);
  }
  return { lidos, achados };
}

/** Todo .ts, .tsx e .mts do repositório fora das pastas ignoradas. */
async function arquivosDoCodigo(): Promise<Map<string, string>> {
  const arquivos = new Map<string, string>();
  async function percorrer(pasta: string): Promise<void> {
    for (const entrada of await readdir(pasta || ".", { withFileTypes: true })) {
      const caminho = pasta ? `${pasta}/${entrada.name}` : entrada.name;
      if (entrada.isDirectory()) {
        if (entrada.name === "node_modules" || entrada.name.startsWith(".") || RAIZES_IGNORADAS.has(caminho)) continue;
        await percorrer(caminho);
      } else if (entrada.isFile() && /\.(?:ts|tsx|mts)$/.test(entrada.name)) {
        arquivos.set(caminho, await readFile(caminho, "utf8"));
      }
    }
  }
  await percorrer("");
  return arquivos;
}

test("o leitor acha o any em todas as formas, o que desliga o aviso dele e o que apaga o erro do compilador", () => {
  const proibidos: [string, string][] = [
    ["const x: any = 1;", "o tipo any"],
    ["const y = z as any;", "o tipo any"],
    ["const w = <any>z;", "o tipo any"],
    ["function f(a: Array<any>) { return a; }", "o tipo any"],
    ["type R = Record<string, any>;", "o tipo any"],
    ["const lista: any[] = [];", "o tipo any"],
    ["// eslint-disable-next-line @typescript-eslint/no-explicit-any\nconst x = 1;", "eslint-disable do no-explicit-any"],
    ["const x = 1; // eslint-disable-line @typescript-eslint/no-explicit-any -- por quê", "eslint-disable do no-explicit-any"],
    ["/* eslint-disable @typescript-eslint/no-explicit-any */\nconst x = 1;", "eslint-disable do no-explicit-any"],
    ["/* eslint-disable */\nconst x = 1;", "eslint-disable sem regra"],
    ["// eslint-disable-next-line\nconst x = 1;", "eslint-disable sem regra"],
    ["// @ts-ignore\nconst x: number = 'a';", "@ts-ignore"],
    ["// @ts-nocheck\nconst x = 1;", "@ts-nocheck"],
  ];
  for (const [codigo, achado] of proibidos) {
    const achados = proibidoEm(fonteDe("amostra.ts", codigo));
    assert.ok(achados.some(a => a.includes(achado)), `${JSON.stringify(codigo)}: esperava "${achado}" em ${JSON.stringify(achados)}`);
  }
  const permitidos = [
    "const x: unknown = 1; const y = x as unknown as string;",
    "// eslint-disable-next-line react-hooks/exhaustive-deps\nconst x = 1;",
    "const texto = 'many any things'; // any company, any time",
    "/** Qualquer coisa: any, mas só no comentário. */\nexport const nome = 'company';",
    "const tipos: never[] = []; type U = string | null;",
    "// @ts-expect-error o tipo da diretiva que se cumpre\nconst x: number = 'a';",
    "// Não use eslint-disable do no-explicit-any aqui, nem @ts-ignore.\nconst x = 1;",
  ];
  for (const codigo of permitidos) assert.deepEqual(proibidoEm(fonteDe("amostra.ts", codigo)), [], codigo);
});

test("o leitor sabe quem cita a produção: o texto do código sim, o comentário e a prestação não", () => {
  const cita: string[] = [
    'const r = await db.from("producao_datas").select("*");',
    "const r = await db.rpc('fn_producao_definir_funcao', {});",
    "const ok = await db.rpc(`auth_producao_pode`, {});",
    'db.from("producao_obras").select("id, producao_temporadas(titulo)");',
    "db.from(`producao_${nome}`);",
    'const TABELA = "producao_blocos";',
  ];
  for (const codigo of cita) assert.ok(citaAProducao(fonteDe("amostra.ts", codigo)), codigo);
  const naoCita: string[] = [
    'db.from("prestacao_producao_cmd").select("*");',
    "// a tabela producao_datas é lida em outro lugar\nconst x = 1;",
    '/** Veja `producao_funcoes`. */ export const y = "producoes";',
    'const rota = "/producoes";',
  ];
  for (const codigo of naoCita) assert.ok(!citaAProducao(fonteDe("amostra.ts", codigo)), codigo);
});

test("o guarda reprova o any de um arquivo que consulta a produção, esteja onde estiver, e de qualquer arquivo de lib/producao", () => {
  const amostra = new Map([
    ["app/api/exemplo/route.ts", 'const db = cliente as any;\nawait db.from("producao_datas").select("*");'],
    ["lib/producao/novo.ts", "export const lixo: any = null;"],
    ["lib/outra-coisa.ts", "export const solto: any = null;"],
    ["components/prestacao/objeto/ProducaoNoCmd.tsx", '(supabase as any).from("prestacao_producao_cmd");'],
    ["lib/producao/limpo.ts", "export const ok: unknown = null;"],
  ]);
  const { lidos, achados } = reprovados(amostra);
  assert.deepEqual(lidos, ["app/api/exemplo/route.ts", "lib/producao/novo.ts", "lib/producao/limpo.ts"]);
  assert.deepEqual(achados, ["app/api/exemplo/route.ts, linha 1: o tipo any", "lib/producao/novo.ts, linha 1: o tipo any"]);
});

test("nada em lib/producao/ e nenhum arquivo que consulta a produção usa any, eslint-disable do no-explicit-any, @ts-ignore ou @ts-nocheck", async () => {
  const arquivos = await arquivosDoCodigo();
  const { lidos, achados } = reprovados(arquivos);
  // Não passa em branco: o módulo existe e foi lido (banco.ts e cliente.ts são o centro dele).
  for (const esperado of ["lib/producao/banco.ts", "lib/producao/cliente.ts", "lib/producao/estados.ts", "lib/producao/vocabulario.ts"]) {
    assert.ok(lidos.includes(esperado), `${esperado} não foi lido`);
  }
  assert.ok(arquivos.size > 300, "o leitor não achou o código do app");
  assert.deepEqual(achados, []);
});

test("cliente.ts converte o cliente do app uma vez só, com um comentário que diz por quê", async () => {
  const caminho = "lib/producao/cliente.ts";
  const texto = await readFile(caminho, "utf8");
  const fonte = fonteDe(caminho, texto);
  // `x as unknown as T` são duas asserções, uma dentro da outra: a conversão é a de fora.
  const conversoes: ts.Node[] = [];
  const ver = (no: ts.Node) => {
    const asercao = ts.isAsExpression(no) || ts.isTypeAssertionExpression(no);
    if (asercao && !ts.isAsExpression(no.parent) && !ts.isTypeAssertionExpression(no.parent)) conversoes.push(no);
    ts.forEachChild(no, ver);
  };
  ver(fonte);
  assert.equal(conversoes.length, 1, "cliente.ts tem de ter uma conversão de tipo, e só uma");
  const instrucao = conversoes[0].parent;
  const comentario = ts.getLeadingCommentRanges(texto, instrucao.getFullStart()) ?? [];
  assert.ok(comentario.length > 0, "a conversão precisa de um comentário logo acima dizendo por que ela é segura");
});
