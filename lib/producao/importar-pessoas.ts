// Importar pessoas da equipe de uma planilha (plano do módulo, PD1.9): lê o texto colado ou o CSV salvo do Excel ou
// do Google Planilhas, reconhece as colunas pelo título, confere cada linha como o cadastro e separa as novas das
// repetidas e das com erro. Sem tela e sem banco.

import { chaveDoNome } from "@/lib/dominio";
import { lerPessoa, TIPOS_DE_PESSOA, ROTULO_DO_TIPO_DE_PESSOA, type TipoDePessoa } from "@/lib/producao/equipe";

export const LIMITE_DE_LINHAS = 500;

/** Divide o texto em linhas e colunas. O separador (tabulação, ponto e vírgula ou vírgula) vem da primeira linha; aspas valem. */
export function lerTabela(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  if (limpo === "") return [];
  const primeira = limpo.split("\n", 1)[0];
  const separador = ["\t", ";", ","].map(s => ({ s, n: primeira.split(s).length - 1 })).sort((a, b) => b.n - a.n)[0];
  const sep = separador.n > 0 ? separador.s : ",";
  const linhas: string[][] = [];
  let linha: string[] = [], campo = "", aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"' && limpo[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo.trim()); campo = ""; }
    else if (c === "\n") { linha.push(campo.trim()); linhas.push(linha); linha = []; campo = ""; }
    else campo += c;
  }
  linha.push(campo.trim());
  linhas.push(linha);
  return linhas.filter(l => l.some(celula => celula !== ""));
}

type Coluna = "nome" | "nomeArtistico" | "email" | "telefone" | "tipo";

const SINONIMOS: Record<Coluna, string[]> = {
  nome: ["nome", "nome completo", "pessoa"],
  nomeArtistico: ["nome artistico", "artistico", "apelido", "nome de palco"],
  email: ["email", "e mail", "correio"],
  telefone: ["telefone", "celular", "fone", "whatsapp", "contato"],
  tipo: ["tipo", "categoria", "grupo"],
};

const normal = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function colunaDe(titulo: string): Coluna | null {
  const alvo = normal(titulo);
  return (Object.keys(SINONIMOS) as Coluna[]).find(coluna => SINONIMOS[coluna].includes(alvo)) ?? null;
}

/** "elenco", "Elenco", "técnica", "tecnica": o tipo do catálogo, ou nulo se não for nenhum. Vazio vale "equipe". */
export function lerTipoDePessoa(texto: string): TipoDePessoa | null {
  const alvo = normal(texto);
  if (alvo === "") return "equipe";
  return TIPOS_DE_PESSOA.find(tipo => tipo === alvo || normal(ROTULO_DO_TIPO_DE_PESSOA[tipo]) === alvo) ?? null;
}

export type PessoaParaImportar = { nome: string; nome_artistico: string | null; email: string | null; telefone: string | null; tipo: string };
export type LinhaImportada =
  | { linha: number; situacao: "nova"; pessoa: PessoaParaImportar }
  | { linha: number; situacao: "repetida"; nome: string; motivo: string }
  | { linha: number; situacao: "erro"; nome: string; erro: string };

export type PreparoDaImportacao =
  | { ok: true; linhas: LinhaImportada[]; novas: PessoaParaImportar[] }
  | { ok: false; erro: string };

/**
 * Prepara a importação. `existentes` são as pessoas já cadastradas (para não duplicar por nome ou e-mail). A primeira
 * linha tem os títulos das colunas (a coluna de nome é obrigatória). Repetidas dentro do próprio arquivo também são
 * ignoradas, ficando a primeira.
 */
export function prepararImportacao(tabela: string[][], existentes: readonly { nome: string; email: string | null }[]): PreparoDaImportacao {
  if (tabela.length === 0) return { ok: false, erro: "Cole as linhas ou escolha um arquivo CSV." };
  const colunas = tabela[0].map(colunaDe);
  if (!colunas.includes("nome")) return { ok: false, erro: "A primeira linha precisa ter os títulos das colunas, com pelo menos “Nome”. Colunas aceitas: Nome, Nome artístico, E-mail, Telefone e Tipo." };
  const dados = tabela.slice(1);
  if (dados.length === 0) return { ok: false, erro: "Só há a linha dos títulos: falta preencher as pessoas." };
  if (dados.length > LIMITE_DE_LINHAS) return { ok: false, erro: `São ${dados.length} linhas; importe até ${LIMITE_DE_LINHAS} por vez.` };

  const nomes = new Set(existentes.map(pessoa => chaveDoNome(pessoa.nome)));
  const emails = new Set(existentes.flatMap(pessoa => (pessoa.email ? [pessoa.email.toLowerCase()] : [])));
  const linhas: LinhaImportada[] = [];
  const novas: PessoaParaImportar[] = [];

  dados.forEach((celulas, indice) => {
    const linha = indice + 2; // a linha da planilha: a 1 são os títulos
    const campo = (coluna: Coluna) => celulas[colunas.indexOf(coluna)] ?? "";
    const nomeBruto = campo("nome").trim();
    const tipo = lerTipoDePessoa(campo("tipo"));
    if (tipo === null) { linhas.push({ linha, situacao: "erro", nome: nomeBruto, erro: `Tipo “${campo("tipo")}” não reconhecido (use equipe, elenco, técnica ou apoio).` }); return; }
    const leitura = lerPessoa({ nome: nomeBruto, nomeArtistico: campo("nomeArtistico"), email: campo("email"), telefone: campo("telefone"), tipo });
    if (!leitura.ok) { linhas.push({ linha, situacao: "erro", nome: nomeBruto, erro: leitura.erro }); return; }
    const { pessoa } = leitura;
    const chave = chaveDoNome(pessoa.nome);
    const email = pessoa.email?.toLowerCase() ?? null;
    if (nomes.has(chave)) { linhas.push({ linha, situacao: "repetida", nome: pessoa.nome, motivo: "já existe uma pessoa com esse nome" }); return; }
    if (email && emails.has(email)) { linhas.push({ linha, situacao: "repetida", nome: pessoa.nome, motivo: "já existe uma pessoa com esse e-mail" }); return; }
    nomes.add(chave);
    if (email) emails.add(email);
    linhas.push({ linha, situacao: "nova", pessoa });
    novas.push(pessoa);
  });
  return { ok: true, linhas, novas };
}
