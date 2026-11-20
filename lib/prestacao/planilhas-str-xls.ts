// Grava as planilhas do STR (P7.3) sobre os modelos oficiais da ANCINE, em
// Excel 97-2003 (.xls), o único formato que o STR carrega.
//
// Cada planilha parte do modelo (mesma aba, mesmos textos, mesclagens,
// larguras e formatos de número) e recebe os valores nas células do mapa do
// Manual STR – Planilhas v2.2. Quando há mais lançamentos que linhas no
// modelo, entram linhas novas dentro da faixa de dados, como o manual manda.
// A biblioteca de planilhas (SheetJS, versão livre) não grava fórmulas,
// bordas nem a proteção do modelo em .xls: as células de fórmula (totais,
// saldo, subtotais) saem com o valor já calculado. A biblioteca entra como
// parâmetro, para a tela carregá-la só quando gera os arquivos.

import type * as XLSXTipos from "xlsx";
import {
  LINHA_INICIAL,
  MECANISMOS,
  type CabecalhoDoStr,
  type DemonstrativoDoExtrato,
  type DemonstrativoOrcamentario,
  type RelacaoDePagamentos,
} from "./planilhas-str";

type Xlsx = typeof XLSXTipos;
type Aba = XLSXTipos.WorkSheet;

/** Linhas de dados de cada modelo, antes do total. */
const LINHAS_DO_MODELO = { rp: 18, de: 6, doOrcamento: 394 } as const;

const serial = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000 + 25569;

function abrir(X: Xlsx, modelo: ArrayBuffer | Uint8Array): { livro: XLSXTipos.WorkBook; aba: Aba } {
  const livro = X.read(modelo, { cellNF: true, cellFormula: false, cellStyles: true });
  return { livro, aba: livro.Sheets[livro.SheetNames[0]] };
}

function gravar(X: Xlsx, livro: XLSXTipos.WorkBook): Uint8Array {
  return new Uint8Array(X.write(livro, { bookType: "biff8", type: "array", cellStyles: true }) as ArrayBuffer);
}

function texto(aba: Aba, endereco: string, valor: string | null | undefined) {
  if (valor === null || valor === undefined || valor === "") { delete aba[endereco]; return; }
  aba[endereco] = { t: "s", v: valor };
}

function numero(aba: Aba, endereco: string, valor: number | null, formato?: string) {
  if (valor === null) { delete aba[endereco]; return; }
  const z = formato ?? (aba[endereco]?.z as string | undefined);
  aba[endereco] = { t: "n", v: valor, ...(z ? { z } : {}) };
}

const emReais = (c: number) => Math.round(c) / 100;

function data(aba: Aba, endereco: string, iso: string | null, formato: string) {
  if (!iso) { delete aba[endereco]; return; }
  aba[endereco] = { t: "n", v: serial(iso), z: formato };
}

/** Formato de número da célula do modelo, para repetir nas linhas novas. */
const formatoDe = (aba: Aba, endereco: string, padrao: string) => (aba[endereco]?.z as string | undefined) ?? padrao;

/**
 * Insere `n` linhas antes da linha `antes` (numeração do Excel): o que está
 * dali para baixo desce, com as mesclagens, a altura e o "oculta" das linhas.
 */
export function inserirLinhas(X: Xlsx, aba: Aba, antes: number, n: number) {
  if (n <= 0) return;
  const limite = antes - 1;
  const movidas: [string, XLSXTipos.CellObject][] = [];
  for (const chave of Object.keys(aba)) {
    if (chave.startsWith("!")) continue;
    const { r, c } = X.utils.decode_cell(chave);
    if (r < limite) continue;
    movidas.push([X.utils.encode_cell({ r: r + n, c }), aba[chave] as XLSXTipos.CellObject]);
    delete aba[chave];
  }
  for (const [chave, celula] of movidas) aba[chave] = celula;
  aba["!merges"] = (aba["!merges"] ?? []).map(m => (
    m.s.r >= limite ? { s: { ...m.s, r: m.s.r + n }, e: { ...m.e, r: m.e.r + n } }
      : m.e.r >= limite ? { s: m.s, e: { ...m.e, r: m.e.r + n } }
      : m
  ));
  const linhas = aba["!rows"];
  if (linhas) {
    const modelo = linhas[limite - 1] ? { ...linhas[limite - 1], hidden: false } : {};
    linhas.splice(limite, 0, ...Array.from({ length: n }, () => ({ ...modelo })));
  }
  if (aba["!ref"]) {
    const faixa = X.utils.decode_range(aba["!ref"]);
    faixa.e.r += n;
    aba["!ref"] = X.utils.encode_range(faixa);
  }
}

function limparFaixa(aba: Aba, colunas: string, de: number, ate: number) {
  for (let linha = de; linha <= ate; linha++) for (const col of colunas) delete aba[`${col}${linha}`];
}

// ─── RP ─────────────────────────────────────────────────────────────────────

export function gravarRp(X: Xlsx, modelo: ArrayBuffer | Uint8Array, cabecalho: CabecalhoDoStr, rp: RelacaoDePagamentos): Uint8Array {
  const { livro, aba } = abrir(X, modelo);
  const inicio = LINHA_INICIAL.rp;
  const fData = formatoDe(aba, `E${inicio}`, "dd/mm/yyyy");
  const fValor = formatoDe(aba, `I${inicio}`, "#,##0.00");
  const extras = Math.max(rp.linhas.length - LINHAS_DO_MODELO.rp, 0);
  inserirLinhas(X, aba, inicio + LINHAS_DO_MODELO.rp, extras);
  const ultima = inicio + LINHAS_DO_MODELO.rp + extras - 1;

  texto(aba, "C5", cabecalho.titulo);
  texto(aba, "C6", cabecalho.salic);
  texto(aba, "C7", cabecalho.proponente);
  texto(aba, "B8", rp.banco);
  texto(aba, "D8", rp.agencia);
  texto(aba, "H8", rp.conta);

  limparFaixa(aba, "ABCDEFGHI", inicio, ultima);
  rp.linhas.forEach((l, i) => {
    const linha = inicio + i;
    texto(aba, `A${linha}`, l.item);
    texto(aba, `B${linha}`, l.credor);
    texto(aba, `C${linha}`, l.documento);
    texto(aba, `D${linha}`, l.historico);
    data(aba, `E${linha}`, l.dataPagamento, fData);
    texto(aba, `F${linha}`, l.tipoDocumento);
    const numeroDoc = l.numeroDocumento.replace(/[\s./-]/g, "");
    if (/^\d{1,15}$/.test(numeroDoc)) numero(aba, `G${linha}`, Number(numeroDoc), "0");
    else texto(aba, `G${linha}`, l.numeroDocumento);
    data(aba, `H${linha}`, l.dataEmissao, fData);
    numero(aba, `I${linha}`, emReais(l.valor), fValor);
  });
  numero(aba, `I${ultima + 1}`, emReais(rp.total), fValor);
  return gravar(X, livro);
}

// ─── DE ─────────────────────────────────────────────────────────────────────

export function gravarDe(X: Xlsx, modelo: ArrayBuffer | Uint8Array, cabecalho: CabecalhoDoStr, de: DemonstrativoDoExtrato): Uint8Array {
  const { livro, aba } = abrir(X, modelo);
  const inicio = LINHA_INICIAL.de;
  const fData = formatoDe(aba, `A${inicio}`, "dd/mm/yy;@");
  const fValor = formatoDe(aba, `C${inicio}`, "#,##0.00");
  const extras = Math.max(de.linhas.length - LINHAS_DO_MODELO.de, 0);
  inserirLinhas(X, aba, inicio + LINHAS_DO_MODELO.de, extras);
  const ultima = inicio + LINHAS_DO_MODELO.de + extras - 1;
  const total = ultima + 1;
  const conc = total + 5; // primeira linha do quadro de conciliação (25 no modelo)

  texto(aba, "C7", cabecalho.titulo);
  texto(aba, "C8", cabecalho.salic);
  texto(aba, "C9", cabecalho.proponente);
  texto(aba, "B10", de.contaDe);
  texto(aba, "D10", de.banco);
  texto(aba, "F10", de.agencia);
  texto(aba, "H10", de.conta);

  limparFaixa(aba, "ABCDEFGHI", inicio, ultima);
  const valor = (endereco: string, c: number) => numero(aba, endereco, c ? emReais(c) : null, fValor);
  de.linhas.forEach((l, i) => {
    const linha = inicio + i;
    data(aba, `A${linha}`, l.data, fData);
    texto(aba, `B${linha}`, l.historico);
    valor(`C${linha}`, l.fomento);
    valor(`D${linha}`, l.outros);
    valor(`E${linha}`, l.transferencias);
    valor(`F${linha}`, l.aplicacoes);
    valor(`G${linha}`, l.pagamentos);
    valor(`H${linha}`, l.despesasBancarias);
    numero(aba, `I${linha}`, emReais(l.saldo), fValor);
  });
  const t = de.totais;
  const colunas: [string, number][] = [["C", t.fomento], ["D", t.outros], ["E", t.transferencias], ["F", t.aplicacoes], ["G", t.pagamentos], ["H", t.despesasBancarias]];
  for (const [col, v] of colunas) numero(aba, `${col}${total}`, emReais(v), fValor);
  numero(aba, `I${total}`, emReais(t.saldo), fValor);
  numero(aba, `C${conc}`, emReais(t.fomento), fValor);
  numero(aba, `C${conc + 1}`, emReais(t.outros), fValor);
  numero(aba, `C${conc + 2}`, emReais(t.transferencias), fValor);
  numero(aba, `C${conc + 3}`, emReais(t.aplicacoes), fValor);
  numero(aba, `C${conc + 4}`, emReais(t.fomento + t.outros + t.transferencias + t.aplicacoes), fValor);
  numero(aba, `H${conc}`, emReais(t.pagamentos), fValor);
  numero(aba, `H${conc + 1}`, emReais(t.despesasBancarias), fValor);
  numero(aba, `H${conc + 2}`, emReais(t.pagamentos + t.despesasBancarias), fValor);
  numero(aba, `H${conc + 4}`, emReais(t.saldo), fValor);
  return gravar(X, livro);
}

// ─── DO ─────────────────────────────────────────────────────────────────────

const percentual = (aprovado: number, executado: number): number | string =>
  aprovado === 0 && executado === 0 ? " " : aprovado > 0 ? executado / aprovado : "NÃO ORÇADO";

export function gravarDo(X: Xlsx, modelo: ArrayBuffer | Uint8Array, cabecalho: CabecalhoDoStr, doc: DemonstrativoOrcamentario): Uint8Array {
  const { livro, aba } = abrir(X, modelo);
  const fValor = formatoDe(aba, "C53", formatoDe(aba, "C21", "#,##0.00"));
  const fPercentual = formatoDe(aba, "E53", "0.00%");

  texto(aba, "C6", cabecalho.titulo);
  texto(aba, "C7", cabecalho.salic);
  texto(aba, "C8", cabecalho.proponente);
  texto(aba, "C9", doc.mecanismo ? MECANISMOS[doc.mecanismo] : null);

  // III. Resumo de captações: só a fonte da prestação, a contrapartida e os rendimentos.
  const entradas = [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 33, 34, 35, 36, 37, 40, 41, 44];
  const porLinha = new Map(doc.captacoes.map(c => [c.linha, c]));
  for (const linha of entradas) {
    const c = porLinha.get(linha);
    numero(aba, `C${linha}`, c && c.aprovado ? emReais(c.aprovado) : null, fValor);
    numero(aba, `D${linha}`, c && c.captado ? emReais(c.captado) : null, fValor);
    numero(aba, `E${linha}`, c ? emReais(c.captado - c.aprovado) : 0, fValor);
  }
  const somaBloco = (linhas: number[]) => linhas.map(l => porLinha.get(l)).reduce((s, c) => ({ aprovado: s.aprovado + (c?.aprovado ?? 0), captado: s.captado + (c?.captado ?? 0) }), { aprovado: 0, captado: 0 });
  const blocos: [number, number[]][] = [[31, [21, 22, 23, 24, 25, 26, 27, 28, 29, 30]], [38, [33, 34, 35, 36, 37]], [42, [40, 41]], [45, [44]]];
  let geral = { aprovado: 0, captado: 0 };
  for (const [subtotal, linhas] of blocos) {
    const s = somaBloco(linhas);
    numero(aba, `C${subtotal}`, emReais(s.aprovado), fValor);
    numero(aba, `D${subtotal}`, emReais(s.captado), fValor);
    numero(aba, `E${subtotal}`, emReais(s.captado - s.aprovado), fValor);
    geral = { aprovado: geral.aprovado + s.aprovado, captado: geral.captado + s.captado };
  }
  numero(aba, "C47", emReais(geral.aprovado), fValor);
  numero(aba, "D47", emReais(geral.captado), fValor);
  numero(aba, "E47", emReais(geral.captado - geral.aprovado), fValor);

  // IV. Orçamento: a árvore no lugar do exemplo do modelo.
  const inicio = LINHA_INICIAL.doOrcamento;
  const extras = Math.max(doc.linhas.length - LINHAS_DO_MODELO.doOrcamento, 0);
  inserirLinhas(X, aba, inicio + LINHAS_DO_MODELO.doOrcamento + 1, extras);
  const ultima = inicio + LINHAS_DO_MODELO.doOrcamento + extras; // inclui a linha em branco antes do total
  limparFaixa(aba, "ABCDE", inicio, ultima);
  doc.linhas.forEach((l, i) => {
    const linha = inicio + i;
    if (l.tipo === "vazia") return;
    texto(aba, `A${linha}`, l.codigo);
    texto(aba, `B${linha}`, l.descricao);
    numero(aba, `C${linha}`, emReais(l.aprovado), fValor);
    numero(aba, `D${linha}`, l.tipo === "item" && !l.executado ? null : emReais(l.executado), fValor);
    const p = percentual(l.aprovado, l.executado);
    if (typeof p === "number") numero(aba, `E${linha}`, p, fPercentual); else texto(aba, `E${linha}`, p);
  });
  const total = ultima + 1;
  numero(aba, `C${total}`, emReais(doc.totalAprovado), fValor);
  numero(aba, `D${total}`, emReais(doc.totalExecutado), fValor);
  const p = percentual(doc.totalAprovado, doc.totalExecutado);
  if (typeof p === "number") numero(aba, `E${total}`, p, fPercentual); else texto(aba, `E${total}`, p);

  // II. Resumo financeiro.
  const disponibilizado = doc.mecanismo ? doc.disponibilizado : 0;
  const diferenca = doc.totalExecutado - disponibilizado;
  numero(aba, "C12", emReais(disponibilizado), fValor);
  numero(aba, "C13", emReais(doc.totalExecutado), fValor);
  numero(aba, "C14", emReais(diferenca), fValor);
  numero(aba, "C16", emReais(Math.min(diferenca, 0)), fValor);
  return gravar(X, livro);
}
