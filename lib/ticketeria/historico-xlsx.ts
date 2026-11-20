// Ler uma planilha do Excel (.xlsx ou .xls) para a importação do histórico: cada aba vira um cabeçalho e linhas de texto, no mesmo formato que o CSV já usa (lerCsv), e o resto da importação
// (adivinhar colunas, somar por dia e canal) segue igual. A biblioteca de planilhas (SheetJS) entra como parâmetro, para a folha carregá-la só quando o arquivo é do Excel.
// Sem banco e sem imports de servidor: roda no navegador e nos testes (tests/ticketeria-historico-xlsx.test.ts). O arquivo nunca sai do computador.
//
// Datas: o Excel guarda a data como número e o formato da célula diz que é data; aqui o número vira AAAA-MM-DD sem passar por fuso (o dia que está na célula é o dia que sai).
// Números: viram texto com vírgula decimal e no máximo 2 casas ("240,5"), que é o que lerValorEmReais lê.

import type * as XLSXTipos from "xlsx";
import { MAX_LINHAS_DO_ARQUIVO, adivinharColunas, type TipoDeHistorico } from "@/lib/ticketeria/historico";

type Xlsx = typeof XLSXTipos;

export const MAX_ABAS = 20;
export type AbaLida = { nome: string; cabecalho: string[]; linhas: string[][]; truncado: boolean };

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** O texto de uma célula, no formato que a importação lê. */
export function celulaEmTexto(X: Xlsx, c: XLSXTipos.CellObject | undefined): string {
  if (!c || c.v === undefined || c.v === null) return "";
  if (c.t === "d" && c.v instanceof Date) return c.v.toISOString().slice(0, 10);
  if (c.t === "n" && typeof c.v === "number") {
    if (typeof c.z === "string" && X.SSF.is_date(c.z)) {
      const d = X.SSF.parse_date_code(c.v);
      return d && c.v >= 1 && d.y >= 1900 ? `${String(d.y).padStart(4, "0")}-${doisDigitos(d.m)}-${doisDigitos(d.d)}` : "";
    }
    return (Number.isInteger(c.v) ? String(c.v) : String(Number(c.v.toFixed(2)))).replace(".", ",");
  }
  if (c.t === "s") return String(c.v);
  return "";
}

/** As abas de uma planilha do Excel: a primeira linha com algo é o cabeçalho; linhas totalmente vazias somem; abas sem cabeçalho ou sem linhas são deixadas de fora. */
export function lerPlanilhaDoExcel(X: Xlsx, bytes: ArrayBuffer | Uint8Array): AbaLida[] {
  const livro = X.read(bytes, { type: "array", sheetRows: MAX_LINHAS_DO_ARQUIVO + 2, cellDates: false, cellNF: true });
  const abas: AbaLida[] = [];
  for (const nome of livro.SheetNames.slice(0, MAX_ABAS)) {
    const ws = livro.Sheets[nome];
    if (!ws || !ws["!ref"]) continue;
    const faixa = X.utils.decode_range(ws["!ref"]);
    const registros: string[][] = [];
    for (let r = faixa.s.r; r <= faixa.e.r; r++) {
      const linha: string[] = [];
      for (let c = faixa.s.c; c <= faixa.e.c; c++) linha.push(celulaEmTexto(X, ws[X.utils.encode_cell({ r, c })]));
      if (linha.some(t => t.trim() !== "")) registros.push(linha);
    }
    const [cabecalho = [], ...linhas] = registros;
    if (cabecalho.length < 2 || linhas.length === 0) continue;
    abas.push({ nome: nome.slice(0, 80), cabecalho: cabecalho.map(c => c.trim()), linhas: linhas.slice(0, MAX_LINHAS_DO_ARQUIVO), truncado: linhas.length > MAX_LINHAS_DO_ARQUIVO });
  }
  return abas;
}

/** A aba que mais parece a certa: a que tem coluna de data e, para vendas, de quantidade e valor (para gastos, de valor); em empate, a primeira. -1 se não há aba. */
export function escolherAba(abas: AbaLida[], tipo: TipoDeHistorico): number {
  let melhor = -1;
  let pontos = -1;
  abas.forEach((a, i) => {
    const m = adivinharColunas(a.cabecalho);
    const p = (m.dia !== null ? 1000 : 0) + (tipo === "vendas" ? (m.ingressos !== null ? 100 : 0) + (m.valor !== null ? 50 : 0) : (m.valor !== null ? 100 : 0)) + Math.min(a.linhas.length, 49);
    if (p > pontos) { pontos = p; melhor = i; }
  });
  return melhor;
}
