// O histórico importado de planilha (vendas e gastos de eventos antigos): ler o CSV, adivinhar e conferir as colunas, somar por dia e canal, e conferir de novo o que chega ao servidor.
// Sem banco e sem imports de servidor: roda no navegador (a folha de importar) e nos testes (tests/ticketeria-historico.test.ts).
//
// O arquivo é lido e somado NO NAVEGADOR: só os totais por dia e canal vão ao servidor. Colunas de nome, e-mail, CPF etc. nunca saem do computador (só se usam as colunas apontadas).

import { emCentavos, lerValorEmReais } from "@/lib/producao/dinheiro";
import { canalPeloTexto } from "@/lib/ticketeria/divulgacao";
import { MAX_CANAL_DA_ORIGEM, rotuloDeCampanha } from "@/lib/ticketeria/origem";

export const MAX_LINHAS_DO_ARQUIVO = 20000;
export const MAX_BYTES_DO_ARQUIVO = 5 * 1024 * 1024;
export const MAX_LINHAS_CONSOLIDADAS = 20000;
export const CANAL_SEM_ORIGEM = "sem-origem";
export const CANAL_OUTRO = "outro";
const MAX_INGRESSOS_POR_LINHA = 100000;
const MAX_CENTAVOS_POR_LINHA = 100000000000;

export type TipoDeHistorico = "vendas" | "gasto";
export const ROTULO_DO_TIPO: Record<TipoDeHistorico, string> = { vendas: "Vendas", gasto: "Gastos" };

// ─── Ler o CSV ──────────────────────────────────────────────────────────────

export type CsvLido = { separador: ";" | "," | "\t"; cabecalho: string[]; linhas: string[][]; truncado: boolean };

/** O separador mais provável da primeira linha (o Excel em português usa ";"). */
function adivinharSeparador(primeiraLinha: string): ";" | "," | "\t" {
  const conta = (s: string) => primeiraLinha.split(s).length - 1;
  const [melhor] = ([[";", conta(";")], ["\t", conta("\t")], [",", conta(",")]] as [";" | "," | "\t", number][]).sort((a, b) => b[1] - a[1]);
  return melhor[1] > 0 ? melhor[0] : ";";
}

/** Lê o texto de um CSV (aspas, aspas duplas dentro de campo, quebra de linha dentro de campo, BOM, CRLF). A primeira linha é o cabeçalho; linhas totalmente vazias somem. */
export function lerCsv(texto: string, maxLinhas: number = MAX_LINHAS_DO_ARQUIVO): CsvLido {
  const limpo = texto.replace(/^﻿/, "");
  const separador = adivinharSeparador(limpo.split(/\r?\n/, 1)[0] ?? "");
  const registros: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let entreAspas = false;
  let truncado = false;
  const fecharLinha = () => {
    linha.push(campo);
    campo = "";
    if (linha.some(c => c.trim() !== "")) registros.push(linha);
    linha = [];
  };
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (entreAspas) {
      if (c === '"') { if (limpo[i + 1] === '"') { campo += '"'; i++; } else entreAspas = false; } else campo += c;
    } else if (c === '"') entreAspas = true;
    else if (c === separador) { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && limpo[i + 1] === "\n") i++; fecharLinha(); if (registros.length > maxLinhas + 1) { truncado = true; break; } }
    else campo += c;
  }
  if (!truncado && (campo !== "" || linha.length > 0)) fecharLinha();
  const [cabecalho = [], ...linhas] = registros;
  return { separador, cabecalho: cabecalho.map(c => c.trim()), linhas: linhas.slice(0, maxLinhas), truncado: truncado || linhas.length > maxLinhas };
}

// ─── Colunas ────────────────────────────────────────────────────────────────

export type MapaDeColunas = { dia: number | null; ingressos: number | null; valor: number | null; canal: number | null };

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const PALAVRAS: Record<keyof MapaDeColunas, RegExp> = {
  dia: /\b(data|dia|date|pedido|compra|venda|pagamento)\b/,
  ingressos: /\b(qtd|qte|quant|quantidade|ingressos?|tickets?|qty)\b/,
  valor: /\b(valor|total|preco|price|gasto|custo|investimento|amount|cost|spend)\b/,
  canal: /\b(canal|origem|fonte|source|utm|midia|divulgacao|plataforma)\b/,
};

/** Chuta quais colunas são quais pelo nome do cabeçalho (o produtor confere e muda). Cada coluna só serve a um campo. */
export function adivinharColunas(cabecalho: string[]): MapaDeColunas {
  const mapa: MapaDeColunas = { dia: null, ingressos: null, valor: null, canal: null };
  const usadas = new Set<number>();
  for (const campo of ["dia", "ingressos", "valor", "canal"] as const) {
    const i = cabecalho.findIndex((h, idx) => !usadas.has(idx) && PALAVRAS[campo].test(sem(h)));
    if (i >= 0) { mapa[campo] = i; usadas.add(i); }
  }
  return mapa;
}

// ─── Valores ────────────────────────────────────────────────────────────────

/** "03/03/2025", "3/3/25", "2025-03-03", "03-03-2025 14:20", "03/03/2025 14:20:05" em AAAA-MM-DD (o dia tem de existir de verdade); senão, null. */
export function lerDia(texto: string): string | null {
  const t = texto.trim();
  let a: string; let m: string; let d: string;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(t);
  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:[T\s,].*)?$/.exec(t);
  if (iso) { [, a, m, d] = iso; } else if (br) { [, d, m, a] = br; if (a.length === 2) a = `20${a}`; } else return null;
  const dia = `${a.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const ok = new Date(`${dia}T12:00:00Z`);
  if (Number.isNaN(ok.getTime()) || ok.toISOString().slice(0, 10) !== dia) return null;
  return Number(a) >= 2000 && Number(a) <= 2100 ? dia : null;
}

const lerInteiro = (texto: string): number | null => { const t = texto.trim().replace(/\./g, ""); return /^\d{1,7}$/.test(t) ? Number(t) : null; };

/** O canal da planilha no formato do Jards: reconhece os conhecidos (ig, wa.me…), recorta o resto; vazio vira o padrão. */
export function canalDaPlanilha(texto: string, padrao: string): string {
  const t = texto.trim();
  if (t === "") return padrao;
  return canalPeloTexto(t) ?? rotuloDeCampanha(t, MAX_CANAL_DA_ORIGEM) ?? padrao;
}

// ─── Somar por dia e canal ──────────────────────────────────────────────────

export type LinhaDeVendas = { dia: string; canal: string; ingressos: number; valor_centavos: number };
export type LinhaDeGasto = { dia: string; canal: string; gasto_centavos: number };
export type ProblemaDaLinha = { linha: number; motivo: string };

export type ResumoDaImportacao<L> = { linhas: L[]; problemas: ProblemaDaLinha[]; lidas: number; inicio: string | null; fim: string | null; totalIngressos: number; totalCentavos: number };

const MAX_PROBLEMAS = 50;

function celula(linha: string[], i: number | null): string { return i === null ? "" : (linha[i] ?? ""); }

/** Vendas: o dia é obrigatório; a quantidade é opcional (sem coluna, cada linha vale 1 ingresso); o valor é opcional; o canal é opcional ("sem origem"). */
export function consolidarVendas(linhas: string[][], mapa: MapaDeColunas): ResumoDaImportacao<LinhaDeVendas> {
  const somas = new Map<string, LinhaDeVendas>();
  const problemas: ProblemaDaLinha[] = [];
  let lidas = 0;
  linhas.forEach((l, idx) => {
    const numero = idx + 2; // 1 é o cabeçalho
    const dia = lerDia(celula(l, mapa.dia));
    if (!dia) { if (problemas.length < MAX_PROBLEMAS) problemas.push({ linha: numero, motivo: "dia que não dá para ler" }); return; }
    let ingressos = 1;
    if (mapa.ingressos !== null) {
      const q = lerInteiro(celula(l, mapa.ingressos));
      if (q === null || q > MAX_INGRESSOS_POR_LINHA) { if (problemas.length < MAX_PROBLEMAS) problemas.push({ linha: numero, motivo: "quantidade que não dá para ler" }); return; }
      ingressos = q;
    }
    let valor = 0;
    if (mapa.valor !== null && celula(l, mapa.valor).trim() !== "") {
      const v = lerValorEmReais(celula(l, mapa.valor));
      if (v === null || emCentavos(v) > MAX_CENTAVOS_POR_LINHA) { if (problemas.length < MAX_PROBLEMAS) problemas.push({ linha: numero, motivo: "valor que não dá para ler" }); return; }
      valor = emCentavos(v);
    }
    const canal = canalDaPlanilha(celula(l, mapa.canal), CANAL_SEM_ORIGEM);
    const chave = `${dia}|${canal}`;
    const s = somas.get(chave) ?? { dia, canal, ingressos: 0, valor_centavos: 0 };
    s.ingressos += ingressos;
    s.valor_centavos += valor;
    somas.set(chave, s);
    lidas++;
  });
  return resumir([...somas.values()], problemas, lidas, l => l.ingressos, l => l.valor_centavos);
}

/** Gastos: o dia e o valor são obrigatórios; o canal é opcional ("outro"). */
export function consolidarGastos(linhas: string[][], mapa: MapaDeColunas): ResumoDaImportacao<LinhaDeGasto> {
  const somas = new Map<string, LinhaDeGasto>();
  const problemas: ProblemaDaLinha[] = [];
  let lidas = 0;
  linhas.forEach((l, idx) => {
    const numero = idx + 2;
    const dia = lerDia(celula(l, mapa.dia));
    if (!dia) { if (problemas.length < MAX_PROBLEMAS) problemas.push({ linha: numero, motivo: "dia que não dá para ler" }); return; }
    const v = lerValorEmReais(celula(l, mapa.valor));
    if (v === null || emCentavos(v) > MAX_CENTAVOS_POR_LINHA) { if (problemas.length < MAX_PROBLEMAS) problemas.push({ linha: numero, motivo: "valor que não dá para ler" }); return; }
    const canal = canalDaPlanilha(celula(l, mapa.canal), CANAL_OUTRO);
    const chave = `${dia}|${canal}`;
    const s = somas.get(chave) ?? { dia, canal, gasto_centavos: 0 };
    s.gasto_centavos += emCentavos(v);
    somas.set(chave, s);
    lidas++;
  });
  return resumir([...somas.values()], problemas, lidas, () => 0, l => l.gasto_centavos);
}

function resumir<L extends { dia: string }>(linhas: L[], problemas: ProblemaDaLinha[], lidas: number, ingressos: (l: L) => number, centavos: (l: L) => number): ResumoDaImportacao<L> {
  const ordenadas = linhas.sort((a, b) => a.dia.localeCompare(b.dia));
  return {
    linhas: ordenadas, problemas, lidas, inicio: ordenadas[0]?.dia ?? null, fim: ordenadas.at(-1)?.dia ?? null,
    totalIngressos: ordenadas.reduce((s, l) => s + ingressos(l), 0), totalCentavos: ordenadas.reduce((s, l) => s + centavos(l), 0),
  };
}

// ─── Semanas e sobreposição ─────────────────────────────────────────────────

const dias = (de: string, ate_: string) => Math.round((Date.parse(`${ate_}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86400000);

/** Quantas semanas o histórico cobre: do primeiro ao último dia, arredondado para cima. Sem dados, zero. */
export function semanasDeHistorico(inicio: string | null, fim: string | null): number {
  return inicio && fim && fim >= inicio ? Math.ceil((dias(inicio, fim) + 1) / 7) : 0;
}

export type ImportacaoDaLista = { id: string; tipo: TipoDeHistorico; arquivo: string; periodo_inicio: string; periodo_fim: string; linhas: number; total_ingressos: number; total_valor_centavos: number; created_at: string };

/** As importações do mesmo tipo cujo período cruza o da nova (risco de contar duas vezes). */
export function importacoesQueSeSobrepoem(existentes: ImportacaoDaLista[], tipo: TipoDeHistorico, inicio: string | null, fim: string | null): ImportacaoDaLista[] {
  if (!inicio || !fim) return [];
  return existentes.filter(i => i.tipo === tipo && i.periodo_inicio <= fim && i.periodo_fim >= inicio);
}

// ─── O que chega ao servidor ────────────────────────────────────────────────

export type CorpoDaImportacao = { tipo: TipoDeHistorico; arquivo: string; linhas: (LinhaDeVendas | LinhaDeGasto)[] };

const CANAL = /^[a-z0-9_-]{1,30}$/;
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const inteiroSeguro = (v: unknown, max: number): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : null);

/** O corpo do pedido de importar, conferido de novo (nada que chega é confiável): tipo, nome do arquivo e cada linha (dia de verdade, canal no formato, números dentro do limite). */
export function lerCorpoDaImportacao(entrada: unknown): { ok: true; corpo: CorpoDaImportacao } | { ok: false; problema: string } {
  const e = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;
  if (e.tipo !== "vendas" && e.tipo !== "gasto") return { ok: false, problema: "tipo" };
  const arquivo = typeof e.arquivo === "string" ? e.arquivo.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120) : "";
  if (arquivo === "") return { ok: false, problema: "arquivo" };
  if (!Array.isArray(e.linhas) || e.linhas.length === 0 || e.linhas.length > MAX_LINHAS_CONSOLIDADAS) return { ok: false, problema: "linhas" };
  const vistos = new Set<string>();
  const linhas: (LinhaDeVendas | LinhaDeGasto)[] = [];
  for (const bruta of e.linhas) {
    const l = (bruta && typeof bruta === "object" ? bruta : {}) as Record<string, unknown>;
    const dia = typeof l.dia === "string" && DIA.test(l.dia) && lerDia(l.dia) === l.dia ? l.dia : null;
    const canal = typeof l.canal === "string" && CANAL.test(l.canal) ? l.canal : null;
    if (!dia || !canal || vistos.has(`${dia}|${canal}`)) return { ok: false, problema: "linha" };
    vistos.add(`${dia}|${canal}`);
    if (e.tipo === "vendas") {
      const ingressos = inteiroSeguro(l.ingressos, 100000000);
      const valor = inteiroSeguro(l.valor_centavos, MAX_CENTAVOS_POR_LINHA * 100);
      if (ingressos === null || valor === null) return { ok: false, problema: "linha" };
      linhas.push({ dia, canal, ingressos, valor_centavos: valor });
    } else {
      const gasto = inteiroSeguro(l.gasto_centavos, MAX_CENTAVOS_POR_LINHA * 100);
      if (gasto === null) return { ok: false, problema: "linha" };
      linhas.push({ dia, canal, gasto_centavos: gasto });
    }
  }
  return { ok: true, corpo: { tipo: e.tipo, arquivo, linhas } };
}

// ─── Modelo para baixar ─────────────────────────────────────────────────────

/** Um CSV de exemplo (separador ";", como o Excel em português) para o produtor preencher. */
export function modeloDeCsv(tipo: TipoDeHistorico): string {
  return tipo === "vendas"
    ? "Data;Quantidade;Valor;Canal\r\n03/03/2025;4;240,00;instagram\r\n03/03/2025;2;120,00;\r\n04/03/2025;7;420,00;whatsapp\r\n"
    : "Data;Valor;Canal\r\n01/05/2025;120,00;meta\r\n02/05/2025;95,50;google\r\n03/05/2025;40,00;instagram\r\n";
}

