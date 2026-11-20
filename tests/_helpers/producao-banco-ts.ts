/**
 * Lê o tipo do banco (lib/producao/banco.ts) como texto de TypeScript, sem rodar o compilador de tipos: as tabelas
 * (Row, Insert, Update e Relationships), as funções (Args e Returns) e as uniões de textos que dão nome às listas
 * fechadas. Lê o formato de um `Database` do Supabase. Serve a tests/producao-banco-tipos.test.ts.
 */
import ts from "typescript";

export type MembroDoTipo = {
  nome: string;
  opcional: boolean;
  /** O tipo como está escrito, com os espaços reduzidos a um: `string | null`, `LadoDaTemporada`. */
  tipo: string;
};

export type ChaveDoTipo = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export type TabelaDoTipo = {
  Row: MembroDoTipo[];
  Insert: MembroDoTipo[];
  Update: MembroDoTipo[];
  Relationships: ChaveDoTipo[];
};

export type FuncaoDoTipo = { Args: MembroDoTipo[]; Returns: string };

export type BancoNoTipo = {
  tabelas: Map<string, TabelaDoTipo>;
  funcoes: Map<string, FuncaoDoTipo>;
  /** O texto de Views, Enums e CompositeTypes; vazios são `{ [_ in never]: never }`. */
  vazios: Record<"Views" | "Enums" | "CompositeTypes", string>;
  /** Cada nome importado (`import type { X } from "..."`) e o módulo de onde vem. */
  importacoes: Map<string, string>;
};

const compacto = (no: ts.Node, arquivo: ts.SourceFile) => no.getText(arquivo).replace(/\s+/g, " ").trim();

function nomeDe(membro: ts.PropertyName, arquivo: ts.SourceFile): string {
  return ts.isIdentifier(membro) || ts.isStringLiteral(membro) ? membro.text : membro.getText(arquivo);
}

function propriedades(tipo: ts.TypeNode | undefined, onde: string): ts.PropertySignature[] {
  if (!tipo || !ts.isTypeLiteralNode(tipo)) throw new Error(`${onde}: esperava um tipo de objeto`);
  return tipo.members.filter(ts.isPropertySignature);
}

function propriedade(tipo: ts.TypeNode | undefined, nome: string, arquivo: ts.SourceFile, onde: string): ts.TypeNode {
  const achada = propriedades(tipo, onde).find(p => nomeDe(p.name, arquivo) === nome);
  if (!achada?.type) throw new Error(`${onde}: falta ${nome}`);
  return achada.type;
}

function membrosDe(tipo: ts.TypeNode | undefined, arquivo: ts.SourceFile, onde: string): MembroDoTipo[] {
  // `Args: never` é a função sem argumentos no que o conector gera.
  if (tipo && tipo.kind === ts.SyntaxKind.NeverKeyword) return [];
  return propriedades(tipo, onde).map(p => ({
    nome: nomeDe(p.name, arquivo),
    opcional: p.questionToken !== undefined,
    tipo: p.type ? compacto(p.type, arquivo) : "(sem tipo)",
  }));
}

function textoDe(tipo: ts.TypeNode): string {
  if (!ts.isLiteralTypeNode(tipo) || !ts.isStringLiteral(tipo.literal)) throw new Error(`esperava um texto: ${tipo.getText()}`);
  return tipo.literal.text;
}

function textosDe(tipo: ts.TypeNode): string[] {
  if (!ts.isTupleTypeNode(tipo)) throw new Error(`esperava uma lista de textos: ${tipo.getText()}`);
  return tipo.elements.map(textoDe);
}

function chavesDe(tipo: ts.TypeNode, arquivo: ts.SourceFile, onde: string): ChaveDoTipo[] {
  if (!ts.isTupleTypeNode(tipo)) throw new Error(`${onde}: Relationships tem de ser uma lista`);
  return tipo.elements.map(elemento => {
    const campo = (nome: string) => propriedade(elemento, nome, arquivo, `${onde}.Relationships`);
    const umParaUm = campo("isOneToOne");
    return {
      foreignKeyName: textoDe(campo("foreignKeyName")),
      columns: textosDe(campo("columns")),
      isOneToOne: ts.isLiteralTypeNode(umParaUm) && umParaUm.literal.kind === ts.SyntaxKind.TrueKeyword,
      referencedRelation: textoDe(campo("referencedRelation")),
      referencedColumns: textosDe(campo("referencedColumns")),
    };
  });
}

/** O tipo `nomeDoTipo` (um `Database` do Supabase) de um arquivo, lido como texto. */
export function lerBancoTs(texto: string, nomeDoTipo: string): BancoNoTipo {
  const arquivo = ts.createSourceFile("banco.ts", texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declaracao = arquivo.statements.find((s): s is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(s) && s.name.text === nomeDoTipo);
  if (!declaracao) throw new Error(`tipo ${nomeDoTipo} não encontrado`);
  const publico = propriedade(declaracao.type, "public", arquivo, nomeDoTipo);

  const tabelas = new Map<string, TabelaDoTipo>();
  for (const tabela of propriedades(propriedade(publico, "Tables", arquivo, "public"), "Tables")) {
    const nome = nomeDe(tabela.name, arquivo);
    const onde = `Tables.${nome}`;
    const corpo = tabela.type;
    tabelas.set(nome, {
      Row: membrosDe(propriedade(corpo, "Row", arquivo, onde), arquivo, `${onde}.Row`),
      Insert: membrosDe(propriedade(corpo, "Insert", arquivo, onde), arquivo, `${onde}.Insert`),
      Update: membrosDe(propriedade(corpo, "Update", arquivo, onde), arquivo, `${onde}.Update`),
      Relationships: chavesDe(propriedade(corpo, "Relationships", arquivo, onde), arquivo, onde),
    });
  }

  const funcoes = new Map<string, FuncaoDoTipo>();
  for (const funcao of propriedades(propriedade(publico, "Functions", arquivo, "public"), "Functions")) {
    const nome = nomeDe(funcao.name, arquivo);
    funcoes.set(nome, {
      Args: membrosDe(propriedade(funcao.type, "Args", arquivo, `Functions.${nome}`), arquivo, `Functions.${nome}.Args`),
      Returns: compacto(propriedade(funcao.type, "Returns", arquivo, `Functions.${nome}`), arquivo),
    });
  }

  const vazio = (nome: "Views" | "Enums" | "CompositeTypes") => compacto(propriedade(publico, nome, arquivo, "public"), arquivo);

  const importacoes = new Map<string, string>();
  for (const s of arquivo.statements) {
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier)) continue;
    const nomes = s.importClause?.namedBindings;
    if (nomes && ts.isNamedImports(nomes)) for (const nome of nomes.elements) importacoes.set(nome.name.text, s.moduleSpecifier.text);
  }

  return { tabelas, funcoes, vazios: { Views: vazio("Views"), Enums: vazio("Enums"), CompositeTypes: vazio("CompositeTypes") }, importacoes };
}

/**
 * Os tipos de um arquivo que são uma união de textos (`export type X = "a" | "b"`): nome → valores. É assim que se
 * lê o que um tipo de lista fechada aceita, de estados.ts, de vocabulario.ts ou do próprio banco.ts.
 */
export function unioesDeTextos(texto: string): Map<string, string[]> {
  const arquivo = ts.createSourceFile("uniao.ts", texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const unioes = new Map<string, string[]>();
  const valoresDe = (tipo: ts.TypeNode): string[] | null => {
    if (ts.isLiteralTypeNode(tipo) && ts.isStringLiteral(tipo.literal)) return [tipo.literal.text];
    if (ts.isParenthesizedTypeNode(tipo)) return valoresDe(tipo.type);
    if (ts.isUnionTypeNode(tipo)) {
      const partes = tipo.types.map(valoresDe);
      return partes.every((p): p is string[] => p !== null) ? partes.flat() : null;
    }
    return null;
  };
  for (const s of arquivo.statements) {
    if (!ts.isTypeAliasDeclaration(s)) continue;
    const valores = valoresDe(s.type);
    if (valores) unioes.set(s.name.text, valores);
  }
  return unioes;
}
