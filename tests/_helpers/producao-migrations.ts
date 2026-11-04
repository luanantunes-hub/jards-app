/**
 * Lê as migrations da produção (supabase/migrations/*.sql) e devolve o que elas dizem do banco: as tabelas
 * `producao_*` (colunas, chaves, listas fechadas) e as funções `auth_producao_*` e `fn_producao_*` (argumentos
 * e quem pode executá-las). Serve a tests/producao-banco-tipos.test.ts, que compara isto com lib/producao/banco.ts.
 *
 * Lê só o desenho das tabelas, na ordem das migrations: create table, add column, add constraint (chave,
 * única e lista fechada) e grant/revoke execute. Não é um interpretador de SQL: o que muda uma tabela da
 * produção de um jeito que não lê (apagar ou renomear coluna, mudar o tipo, apagar a tabela) FALHA em voz alta,
 * para quem mudou ensinar o teste e o tipo, em vez de o tipo envelhecer calado.
 */
import { dividirComandos } from "../../lib/supabase/sql-em-bloco";

export type ArquivoSql = { nome: string; sql: string };

export type ColunaDaMigration = {
  nome: string;
  /** O tipo SQL como está escrito: "uuid", "numeric(14, 2)", "text[]". */
  tipoSql: string;
  anulavel: boolean;
  /** Tem padrão, ou o banco a preenche sozinho (identity): na inserção é opcional. */
  comPadrao: boolean;
  /** `generated always as identity`: o banco não aceita valor nenhum. */
  sempreGerada: boolean;
};

export type ChaveDaMigration = {
  nome: string;
  colunas: string[];
  /** Só chaves para o schema public; as para auth.users não entram (o PostgREST não as expõe). */
  tabelaDestino: string;
  colunasDestino: string[];
  /** As colunas da chave são exatamente as de uma chave primária ou única da tabela. */
  umParaUm: boolean;
};

export type TabelaDaMigration = {
  nome: string;
  colunas: ColunaDaMigration[];
  chaves: ChaveDaMigration[];
  /** coluna → valores de `check (coluna in ('a', 'b'))`. */
  listas: Map<string, string[]>;
};

export type FuncaoDaMigration = {
  nome: string;
  argumentos: { nome: string; tipoSql: string }[];
  retornoSql: string;
  /** A última palavra das migrations é `grant execute ... to authenticated`: o navegador a chama. */
  doNavegador: boolean;
};

export type BancoNasMigrations = {
  tabelas: Map<string, TabelaDaMigration>;
  funcoes: Map<string, FuncaoDaMigration>;
};

const normalizar = (sql: string) => sql.replace(/\s+/g, " ").trim();
const semComentarios = (sql: string) => sql.replace(/--.*$/gm, "");
const nomesDe = (lista: string) => lista.split(",").map(n => n.trim()).filter(Boolean);

/** O texto entre o parêntese que abre em `ini` e o que o fecha. */
function dentroDosParenteses(texto: string, ini: number): string {
  let fundo = 0;
  for (let i = ini; i < texto.length; i++) {
    if (texto[i] === "(") fundo++;
    if (texto[i] === ")" && --fundo === 0) return texto.slice(ini + 1, i);
  }
  throw new Error("parêntese sem fechamento");
}

/** Divide nas vírgulas de nível zero, sem olhar o que está entre aspas. */
function itensDe(corpo: string): string[] {
  const itens: string[] = [];
  let atual = "", fundo = 0, aspas = false;
  for (const c of corpo) {
    if (c === "'") aspas = !aspas;
    if (!aspas && c === "(") fundo++;
    if (!aspas && c === ")") fundo--;
    if (c === "," && fundo === 0 && !aspas) { itens.push(atual.trim()); atual = ""; } else atual += c;
  }
  if (atual.trim()) itens.push(atual.trim());
  return itens;
}

/** Tipo SQL → tipo TypeScript, como o gerador do Supabase o faz. O que não está aqui o teste não conhece: ensine-o. */
export function tipoTsDe(tipoSql: string): string {
  const tipo = tipoSql.toLowerCase().replace(/\(.*?\)/, "");
  if (tipo.endsWith("[]")) return `${tipoTsDe(tipo.slice(0, -2))}[]`;
  if (["uuid", "text", "date", "timestamptz", "timestamp", "time", "varchar", "citext"].includes(tipo)) return "string";
  if (["jsonb", "json"].includes(tipo)) return "Json";
  if (["boolean", "bool"].includes(tipo)) return "boolean";
  if (["integer", "int", "int2", "int4", "int8", "smallint", "bigint", "numeric", "decimal", "real", "float4", "float8"].includes(tipo)) return "number";
  throw new Error(`tipo SQL sem correspondente no teste: ${tipoSql} (acrescente-o em tipoTsDe)`);
}

type Entrada = { tabelas: Map<string, TabelaDaMigration>; unicas: Map<string, string[][]> };

const REFERENCIA = /references (?:(\w+)\.)?(\w+) \(([\w, ]+)\)(?: on delete (set null|cascade|no action|restrict)(?: \([\w, ]+\))?)?(?: (?:not )?deferrable(?: initially (?:deferred|immediate))?)?$/;

/** Um item de create table que não é restrição: a coluna, com o que ela diz de si. */
function colunaDe(item: string, tabela: string, e: Entrada): ColunaDaMigration {
  const m = /^(\w+) ([a-z0-9_]+(?:\([^)]*\))?(?:\[\])*)(.*)$/.exec(item);
  if (!m) throw new Error(`coluna que o teste não entende: ${tabela}: ${item}`);
  const [, nome, tipoSql, resto] = m;
  if (/\bcheck\b/.test(resto)) throw new Error(`${tabela}.${nome}: check na própria coluna; escreva-o como constraint`);
  const sempreGerada = /\bgenerated always as identity\b/.test(resto);
  const chavePrimaria = /\bprimary key\b/.test(resto);
  const anulavel = !/\bnot null\b/.test(resto) && !chavePrimaria && !sempreGerada;
  const referencia = /\breferences\b/.test(resto) ? REFERENCIA.exec(resto.slice(resto.indexOf("references"))) : null;
  if (/\breferences\b/.test(resto) && !referencia) throw new Error(`chave que o teste não entende: ${tabela}.${nome}: ${resto}`);
  if (chavePrimaria || /\bunique\b/.test(resto)) e.unicas.get(tabela)!.push([nome]);
  if (referencia) acrescentarChave(e, tabela, `${tabela}_${nome}_fkey`, [nome], referencia);
  return { nome, tipoSql, anulavel, comPadrao: /\bdefault\b/.test(resto) || /\bgenerated (?:always|by default) as identity\b/.test(resto), sempreGerada };
}

function acrescentarChave(e: Entrada, tabela: string, nome: string, colunas: string[], referencia: RegExpExecArray): void {
  const [, esquema = "public", destino, colunasDestino] = referencia;
  // O PostgREST só expõe o schema public, e o gerador do Supabase também deixa de fora as chaves para auth.users.
  if (esquema === "auth") return;
  if (esquema !== "public") throw new Error(`${tabela}: chave para o schema ${esquema}, que o teste não conhece`);
  e.tabelas.get(tabela)!.chaves.push({ nome, colunas, tabelaDestino: destino, colunasDestino: nomesDe(colunasDestino), umParaUm: false });
}

/** Uma restrição, escrita no create table ou depois, em `add constraint`: chave, única, primária ou lista fechada. */
function restricaoDe(texto: string, tabela: string, e: Entrada): void {
  const m = /^(?:constraint (\w+) )?(foreign key|unique|primary key|check) (.*)$/.exec(texto);
  if (!m) return; // exclude e afins não mudam o tipo
  const [, nomeDado, tipo, resto] = m;
  if (tipo === "foreign key") {
    const f = /^\(([\w, ]+)\) (references .*)$/.exec(resto);
    const referencia = f ? REFERENCIA.exec(f[2]) : null;
    if (!f || !referencia) throw new Error(`chave que o teste não entende: ${tabela}: ${texto}`);
    const colunas = nomesDe(f[1]);
    acrescentarChave(e, tabela, nomeDado ?? `${tabela}_${colunas.join("_")}_fkey`, colunas, referencia);
  } else if (tipo === "unique" || tipo === "primary key") {
    const u = /^\(([\w, ]+)\)/.exec(resto);
    if (!u) throw new Error(`restrição que o teste não entende: ${tabela}: ${texto}`);
    e.unicas.get(tabela)!.push(nomesDe(u[1]));
  } else {
    const lista = /^\((\w+) in \(((?:'[^']*'(?:, )?)+)\)\)$/.exec(resto);
    if (lista) e.tabelas.get(tabela)!.listas.set(lista[1], [...lista[2].matchAll(/'([^']*)'/g)].map(x => x[1]));
  }
}

/** `alter table public.producao_x <ações>`: só as ações que não mudam o desenho das colunas passam sem ser lidas. */
function alteracaoDe(tabela: string, acoes: string, e: Entrada): void {
  if (!e.tabelas.has(tabela)) throw new Error(`alter table de ${tabela}, que nenhuma migration anterior criou`);
  // Um alter table pode juntar ações separadas por vírgula (`add column a text, add column b text`).
  for (const acao of itensDe(acoes)) {
    if (/^(?:enable|disable|force|no force) row level security$/.test(acao)) continue;
    if (/^alter constraint \w+ (?:not )?deferrable/.test(acao)) continue;
    const restricao = /^add (constraint .*)$/.exec(acao);
    if (restricao) { restricaoDe(restricao[1], tabela, e); continue; }
    const coluna = /^add column (?:if not exists )?(.*)$/.exec(acao);
    if (coluna) {
      const nova = colunaDe(coluna[1], tabela, e);
      const colunas = e.tabelas.get(tabela)!.colunas;
      // Reaplicar a migration (`if not exists`) não repete a coluna.
      if (!colunas.some(c => c.nome === nova.nome)) colunas.push(nova);
      continue;
    }
    throw new Error(`alter table ${tabela} ${acao}: o teste não lê este tipo de alteração; ensine-o (tests/_helpers/producao-migrations.ts) e atualize lib/producao/banco.ts`);
  }
}

/** As migrations, na ordem do nome (a ordem da versão), reduzidas ao que a produção tem no banco. */
export function lerMigrations(arquivos: readonly ArquivoSql[]): BancoNasMigrations {
  const e: Entrada = { tabelas: new Map(), unicas: new Map() };
  const funcoes = new Map<string, FuncaoDaMigration>();
  const executaveis = new Set<string>();

  for (const arquivo of [...arquivos].sort((a, b) => a.nome.localeCompare(b.nome))) {
    for (const bruto of dividirComandos(arquivo.sql)) {
      const comando = normalizar(bruto.startsWith("do ") ? semComentarios(bruto) : bruto);

      const cria = /^create table (?:if not exists )?public\.(producao_\w+) \(/.exec(comando);
      if (cria) {
        const tabela = cria[1];
        e.tabelas.set(tabela, { nome: tabela, colunas: [], chaves: [], listas: new Map() });
        e.unicas.set(tabela, []);
        for (const item of itensDe(dentroDosParenteses(comando, cria[0].length - 1))) {
          if (/^(?:constraint |foreign key \(|unique \(|primary key \(|check \(|exclude )/.test(item)) restricaoDe(item, tabela, e);
          else e.tabelas.get(tabela)!.colunas.push(colunaDe(item, tabela, e));
        }
        continue;
      }

      if (/^drop (?:table|function) (?:if exists )?public\.(?:producao_|auth_producao_|fn_producao_)/.test(comando)) {
        throw new Error(`a migration ${arquivo.nome} apaga um objeto da produção: tire-o de lib/producao/banco.ts e ensine o teste`);
      }
      if (/^create (?:or replace )?(?:materialized )?view public\.producao_|^create type public\.producao_/.test(comando)) {
        throw new Error(`a migration ${arquivo.nome} cria uma view ou um tipo da produção: escreva-o em lib/producao/banco.ts (Views, Enums) e ensine o teste`);
      }
      // Dentro de um bloco `do` (as chaves que a PD0.9 liga) o alter table é o mesmo; termina no `;`.
      for (const alter of comando.matchAll(/alter table (?:only )?public\.(producao_\w+) ([^;]+?)(?=;|$)/g)) {
        alteracaoDe(alter[1], alter[2], e);
      }

      const funcao = /^create (?:or replace )?function public\.((?:auth|fn)_producao_\w+)\(([^)]*)\) returns (.+?) language /.exec(comando);
      if (funcao) {
        const argumentos = itensDe(funcao[2]).map(a => {
          const arg = /^(\w+) (.+)$/.exec(a);
          if (!arg || /\bdefault\b/i.test(a)) throw new Error(`argumento que o teste não entende: ${funcao[1]}(${a})`);
          return { nome: arg[1], tipoSql: arg[2] };
        });
        funcoes.set(funcao[1], { nome: funcao[1], argumentos, retornoSql: funcao[3], doNavegador: false });
        continue;
      }

      const permissao = /^(grant|revoke) execute on function public\.((?:auth|fn)_producao_\w+)\([^)]*\) (?:to|from) (.+)$/.exec(comando);
      if (permissao && nomesDe(permissao[3]).includes("authenticated")) {
        if (permissao[1] === "grant") executaveis.add(permissao[2]);
        else executaveis.delete(permissao[2]);
      }
    }
  }

  for (const [nome, funcao] of funcoes) funcao.doNavegador = executaveis.has(nome);
  for (const nome of executaveis) {
    if (!funcoes.has(nome)) throw new Error(`grant execute de ${nome}, que nenhuma migration criou`);
  }
  // Uma chave é um-para-um quando as colunas dela são exatamente as de uma chave primária ou única da tabela.
  for (const [nome, tabela] of e.tabelas) {
    for (const chave of tabela.chaves) {
      chave.umParaUm = e.unicas.get(nome)!.some(u => u.length === chave.colunas.length && u.every(c => chave.colunas.includes(c)));
    }
  }
  return { tabelas: e.tabelas, funcoes };
}
