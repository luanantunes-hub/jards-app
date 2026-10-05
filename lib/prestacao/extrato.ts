// Leitura de extrato bancário (P2.1 e P2.2): OFX, CSV e a leitura do PDF pela
// IA viram uma lista única de lançamentos, com período, saldos, conferência de
// saldo e chave para não gravar o mesmo lançamento duas vezes. Sem React e sem
// Supabase.
//
// A origem fica registrada (formato da importação). Um agregador de Open
// Finance, quando entrar, entrega a mesma ExtratoLido.

import { adivinharColuna, lerTabela, lerValor, type TabelaLida } from "./orcamento";

export type NaturezaLancamento = "credito" | "debito";

export const CATEGORIAS_LANCAMENTO = [
  { id: "aporte", rotulo: "Aporte" },
  { id: "transferencia", rotulo: "Transferência entre contas" },
  { id: "pagamento", rotulo: "Pagamento" },
  { id: "tarifa", rotulo: "Tarifa ou IOF" },
  { id: "rendimento", rotulo: "Rendimento" },
  { id: "aplicacao", rotulo: "Aplicação" },
  { id: "resgate", rotulo: "Resgate" },
  { id: "devolucao", rotulo: "Devolução" },
  { id: "estorno", rotulo: "Estorno" },
  { id: "outro", rotulo: "Outro" },
] as const;
export type CategoriaLancamento = (typeof CATEGORIAS_LANCAMENTO)[number]["id"];

export const TIPOS_CONTA = [
  { id: "captacao", rotulo: "Captação" },
  { id: "movimento", rotulo: "Movimento" },
  { id: "unica", rotulo: "Conta única" },
  { id: "recolhimento", rotulo: "Recolhimento" },
  { id: "aplicacao", rotulo: "Aplicação" },
] as const;
export type TipoConta = (typeof TIPOS_CONTA)[number]["id"];

export type LancamentoLido = {
  /** AAAA-MM-DD */
  data: string;
  /** Sempre positivo; o sentido está em natureza. */
  valor: number;
  natureza: NaturezaLancamento;
  historico: string;
  documento: string | null;
  /** Número do documento só com letras e algarismos, como o Salic compara. */
  documentoNormalizado: string | null;
  /** Identificador do banco (FITID do OFX), quando houver. */
  idExterno: string | null;
  saldoApos: number | null;
  categoria: CategoriaLancamento;
};

export type ExtratoLido = {
  formato: "ofx" | "csv" | "pdf";
  conta: { banco: string | null; agencia: string | null; conta: string | null } | null;
  periodo: { inicio: string; fim: string } | null;
  saldoInicial: number | null;
  saldoFinal: number | null;
  lancamentos: LancamentoLido[];
  /** O que ficou de fora ou merece atenção, em frases curtas. */
  avisos: string[];
};

function semAcento(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const centavos = (valor: number) => Math.round(valor * 100);
const reais = (c: number) => c / 100;

/** Texto do arquivo: UTF-8 quando válido; senão Windows-1252, o padrão dos bancos brasileiros. */
export function decodificarArquivo(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function normalizarDocumento(documento: string | null | undefined): string | null {
  const limpo = String(documento ?? "").replace(/[^0-9A-Za-z]/g, "").replace(/^0+(?=\d)/, "");
  return limpo || null;
}

/** "02/09/2026", "02/09/26", "2026-09-02" ou "20260902…" (OFX) em AAAA-MM-DD; null quando não é data. */
export function lerData(texto: string | null | undefined): string | null {
  const t = String(texto ?? "").trim();
  let ano: number, mes: number, dia: number;
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d{4})(\d{2})(\d{2})/))) [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})/))) [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else if ((m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/))) {
    [dia, mes, ano] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (ano < 100) ano += 2000;
  } else return null;
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return null;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Valor com sinal: "-500,00", "(500,00)", "500,00 D", "500,00-" são débitos;
 * "500,00 C" e "500,00" são créditos.
 */
export function lerValorComSinal(texto: string | number | null | undefined): number {
  if (typeof texto === "number") return Number.isFinite(texto) ? texto : 0;
  const t = String(texto ?? "").trim();
  const negativo = /^-|^\(.*\)$|-\s*$|\bD$/i.test(t);
  const semMarcas = t.replace(/^\(|\)$/g, "").replace(/-\s*$/, "").replace(/\s*[CD]$/i, "");
  const valor = Math.abs(lerValor(semMarcas));
  return negativo ? -valor : valor;
}

const PISTAS_DE_CATEGORIA: [CategoriaLancamento, RegExp, NaturezaLancamento | null][] = [
  ["estorno", /\bestorno|\bestorn|\bdevolucao de (ted|pix|doc)|\bcancelamento/, null],
  ["tarifa", /\btarifa|\btar\b|\bpacote de servicos|\bcesta\b|\biof\b|\bmanutencao de conta/, "debito"],
  ["rendimento", /\brendimento|\brend\b|\bjuros|\bremuneracao/, "credito"],
  ["resgate", /\bresgate|\bresg\b/, "credito"],
  ["aplicacao", /\baplicacao|\bapl\b|\bbb rf\b|\bcdb\b|\bfundo de invest|\brende facil/, "debito"],
  ["devolucao", /\bdevolucao|\bgru\b|\brecolhimento/, null],
  ["transferencia", /\btransf\w* entre contas|\btransf\w* (de|para) conta|\bmesma titularidade/, null],
  ["pagamento", /\bpix\b|\bted\b|\bdoc\b|\bboleto|\bpagamento|\bpagto|\bpgto|\bcheque|\bcompra/, "debito"],
];

/** Categoria sugerida pelo histórico; "outro" quando não há pista clara. A pessoa pode trocar. */
export function classificarLancamento(historico: string, natureza: NaturezaLancamento): CategoriaLancamento {
  const alvo = semAcento(historico);
  for (const [categoria, pista, so] of PISTAS_DE_CATEGORIA) {
    if ((so === null || so === natureza) && pista.test(alvo)) return categoria;
  }
  return "outro";
}

function lancamento(campos: {
  data: string;
  valorComSinal: number;
  historico: string;
  documento?: string | null;
  idExterno?: string | null;
  saldoApos?: number | null;
}): LancamentoLido {
  const natureza: NaturezaLancamento = campos.valorComSinal < 0 ? "debito" : "credito";
  const historico = campos.historico.replace(/\s+/g, " ").trim();
  const documento = campos.documento?.trim() || null;
  return {
    data: campos.data,
    valor: reais(Math.abs(centavos(campos.valorComSinal))),
    natureza,
    historico,
    documento,
    documentoNormalizado: normalizarDocumento(documento),
    idExterno: campos.idExterno?.trim() || null,
    saldoApos: campos.saldoApos ?? null,
    categoria: classificarLancamento(historico, natureza),
  };
}

function periodoDos(lancamentos: readonly LancamentoLido[]): ExtratoLido["periodo"] {
  if (lancamentos.length === 0) return null;
  const datas = lancamentos.map(l => l.data).sort();
  return { inicio: datas[0], fim: datas[datas.length - 1] };
}

// ─── OFX ────────────────────────────────────────────────────────────────────

/** Valor de uma tag no OFX 1.x (sem fechamento) ou 2.x (XML). */
function tag(bloco: string, nome: string): string | null {
  const m = bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, "i"));
  const valor = m?.[1].trim();
  return valor ? valor.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") : null;
}

export function ehOfx(texto: string): boolean {
  return /OFXHEADER|<OFX>/i.test(texto.slice(0, 2000));
}

export function lerOfx(texto: string): ExtratoLido {
  const avisos: string[] = [];
  const blocos = texto.split(/<STMTTRN>/i).slice(1).map(b => b.split(/<\/STMTTRN>|<\/BANKTRANLIST>/i)[0]);
  const lancamentos: LancamentoLido[] = [];
  let semData = 0;
  for (const bloco of blocos) {
    const data = lerData(tag(bloco, "DTPOSTED"));
    const valor = lerValorComSinal(tag(bloco, "TRNAMT"));
    if (!data) { semData++; continue; }
    if (valor === 0) continue;
    const historico = [tag(bloco, "NAME"), tag(bloco, "MEMO")].filter(Boolean).join(" · ") || tag(bloco, "TRNTYPE") || "";
    lancamentos.push(lancamento({
      data,
      valorComSinal: valor,
      historico,
      documento: tag(bloco, "CHECKNUM") ?? tag(bloco, "REFNUM"),
      idExterno: tag(bloco, "FITID"),
    }));
  }
  if (semData > 0) avisos.push(`${semData} lançamento(s) sem data válida ficaram de fora.`);

  const inicio = lerData(tag(texto, "DTSTART"));
  const fim = lerData(tag(texto, "DTEND"));
  const saldoFinalTexto = tag(texto.split(/<LEDGERBAL>/i)[1] ?? "", "BALAMT");
  const saldoFinal = saldoFinalTexto === null ? null : lerValorComSinal(saldoFinalTexto);
  return {
    formato: "ofx",
    conta: {
      banco: tag(texto, "BANKID"),
      agencia: tag(texto, "BRANCHID"),
      conta: tag(texto, "ACCTID"),
    },
    periodo: inicio && fim ? { inicio, fim } : periodoDos(lancamentos),
    // O OFX traz só o saldo final. Calcular o inicial a partir dele faria a
    // conferência bater sempre; fica em branco.
    saldoInicial: null,
    saldoFinal,
    lancamentos,
    avisos,
  };
}

// ─── CSV ────────────────────────────────────────────────────────────────────

/** Índices (como texto, "" = não usar) das colunas do CSV. */
export type MapaExtrato = {
  data: string;
  historico: string;
  detalhe: string;
  documento: string;
  valor: string;
  credito: string;
  debito: string;
  natureza: string;
  saldo: string;
};

export function adivinharMapaExtrato(cabecalho: readonly string[]): MapaExtrato {
  const usados: string[] = [];
  const pegar = (pistas: string[]) => {
    const coluna = adivinharColuna(cabecalho, pistas, usados);
    if (coluna !== "") usados.push(coluna);
    return coluna;
  };
  // A ordem importa: colunas mais específicas primeiro, para "valor" não pegar "saldo".
  const data = pegar(["data_mov", "data lanc", "data mov", "data"]);
  const saldo = pegar(["saldo"]);
  const credito = pegar(["credito", "entrada"]);
  const debito = pegar(["debito", "saida"]);
  const natureza = pegar(["deb_cred", "d/c", "c/d", "tipo lanc", "natureza", "tipo"]);
  const documento = pegar(["n documento", "nº documento", "n° documento", "nr_doc", "numero do documento", "documento", "doc"]);
  const valor = pegar(["valor", "montante", "quantia"]);
  const historico = pegar(["historico", "lancamento", "descricao", "memo"]);
  const detalhe = pegar(["detalhe", "complemento", "informac"]);
  return { data, historico, detalhe, documento, valor, credito, debito, natureza, saldo };
}

const LINHA_DE_SALDO = /^\s*(saldo|s a l d o)\b/;

/** Natureza escrita na coluna própria ("D", "Saída", "Débito"); null quando não diz. */
function naturezaDaColuna(texto: string | undefined): NaturezaLancamento | null {
  const t = semAcento(String(texto ?? "").trim());
  if (/^(d|deb|debito|saida|s)$/.test(t)) return "debito";
  if (/^(c|cred|credito|entrada|e)$/.test(t)) return "credito";
  return null;
}

export type CsvExtratoLido = { extrato: ExtratoLido; tabela: TabelaLida; mapa: MapaExtrato };

/**
 * Alguns bancos põem dados da conta antes do cabeçalho. A tabela começa na
 * primeira linha que tem uma coluna de data e pelo menos três colunas.
 */
function semPreambulo(texto: string): string {
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/);
  const inicio = linhas.findIndex(linha => /\bdata/.test(semAcento(linha)) && (linha.match(/[;,\t|]/g)?.length ?? 0) >= 2);
  return inicio > 0 ? linhas.slice(inicio).join("\n") : texto;
}

export function lerCsvExtrato(texto: string, mapaInformado?: MapaExtrato): CsvExtratoLido | null {
  const tabela = lerTabela(semPreambulo(texto));
  if (!tabela) return null;
  const mapa = mapaInformado ?? adivinharMapaExtrato(tabela.cabecalho);
  const coluna = (indice: string, linha: string[]) => (indice === "" ? undefined : linha[Number(indice)]);
  const avisos: string[] = [];
  const lancamentos: LancamentoLido[] = [];
  let saldoInicial: number | null = null;
  let saldoFinal: number | null = null;
  let ignoradas = 0;

  for (const linha of tabela.linhas) {
    const historicoBase = (coluna(mapa.historico, linha) ?? "").trim();
    const detalhe = (coluna(mapa.detalhe, linha) ?? "").trim();
    const data = lerData(coluna(mapa.data, linha));
    const saldoTexto = coluna(mapa.saldo, linha);

    // Linhas de saldo ("Saldo anterior", "Saldo do dia", "S A L D O") marcam os saldos e não são lançamentos.
    if (LINHA_DE_SALDO.test(semAcento(historicoBase))) {
      const valorDoSaldo = lerValorComSinal(saldoTexto?.trim() ? saldoTexto : coluna(mapa.valor, linha));
      if (/anterior|inicial/.test(semAcento(historicoBase)) && saldoInicial === null && lancamentos.length === 0) saldoInicial = valorDoSaldo;
      else saldoFinal = valorDoSaldo;
      continue;
    }
    if (!data) { if (linha.some(c => c.trim())) ignoradas++; continue; }

    let valorComSinal: number;
    if (mapa.credito !== "" || mapa.debito !== "") {
      valorComSinal = Math.abs(lerValor(coluna(mapa.credito, linha))) - Math.abs(lerValor(coluna(mapa.debito, linha)));
    } else {
      valorComSinal = lerValorComSinal(coluna(mapa.valor, linha));
      const natureza = naturezaDaColuna(coluna(mapa.natureza, linha));
      if (natureza) valorComSinal = (natureza === "debito" ? -1 : 1) * Math.abs(valorComSinal);
    }
    if (valorComSinal === 0) { ignoradas++; continue; }

    const saldoApos = saldoTexto?.trim() ? lerValorComSinal(saldoTexto) : null;
    lancamentos.push(lancamento({
      data,
      valorComSinal,
      historico: [historicoBase, detalhe].filter(Boolean).join(" · "),
      documento: coluna(mapa.documento, linha) ?? null,
      saldoApos,
    }));
  }

  if (ignoradas > 0) avisos.push(`${ignoradas} linha(s) sem data ou sem valor ficaram de fora.`);
  return {
    tabela,
    mapa,
    extrato: { formato: "csv", conta: null, periodo: periodoDos(lancamentos), ...completarSaldos(lancamentos, saldoInicial, saldoFinal), lancamentos, avisos },
  };
}

/** Sem linhas de saldo, o saldo da primeira e da última linha dá os dois saldos. */
function completarSaldos(
  lancamentos: readonly LancamentoLido[],
  saldoInicial: number | null,
  saldoFinal: number | null,
): Pick<ExtratoLido, "saldoInicial" | "saldoFinal"> {
  const primeiro = lancamentos[0];
  const ultimo = lancamentos[lancamentos.length - 1];
  if (saldoInicial === null && primeiro?.saldoApos != null) {
    saldoInicial = reais(centavos(primeiro.saldoApos) - (primeiro.natureza === "credito" ? 1 : -1) * centavos(primeiro.valor));
  }
  if (saldoFinal === null && ultimo?.saldoApos != null) saldoFinal = ultimo.saldoApos;
  return { saldoInicial, saldoFinal };
}

// ─── PDF (leitura pela IA) ──────────────────────────────────────────────────

const textoOuNulo = (valor: unknown) => (typeof valor === "string" && valor.trim() ? valor.trim() : null);

/** Número da leitura: a IA devolve número, mas às vezes manda o texto do PDF ("1.200,50 D"). */
function numeroOuNulo(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "string" && /\d/.test(valor)) return lerValorComSinal(valor);
  return null;
}

/**
 * O que a função ler-extrato-pdf devolve (o JSON da IA) na mesma forma do OFX
 * e do CSV. A IA transcreve; a prévia e a conferência de saldo mostram à
 * pessoa o que foi lido antes de gravar. Linhas sem data ou sem valor saem.
 */
export function lerLeituraDoPdf(bruto: unknown): ExtratoLido {
  const leitura = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const linhas = Array.isArray(leitura.lancamentos) ? leitura.lancamentos : [];
  const lancamentos: LancamentoLido[] = [];
  let ignoradas = 0;
  for (const item of linhas) {
    const linha = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const data = lerData(textoOuNulo(linha.data));
    const valorComSinal = numeroOuNulo(linha.valor);
    if (!data || !valorComSinal) { ignoradas++; continue; }
    lancamentos.push(lancamento({
      data,
      valorComSinal,
      historico: textoOuNulo(linha.historico) ?? "",
      documento: textoOuNulo(linha.documento),
      saldoApos: numeroOuNulo(linha.saldo),
    }));
  }

  const avisos = ["Lido pela IA a partir do PDF: confira os valores com o arquivo antes de importar."];
  if (ignoradas > 0) avisos.push(`${ignoradas} linha(s) sem data ou sem valor ficaram de fora.`);
  const inicio = lerData(textoOuNulo(leitura.periodo_inicio));
  const fim = lerData(textoOuNulo(leitura.periodo_fim));
  const conta = { banco: textoOuNulo(leitura.banco), agencia: textoOuNulo(leitura.agencia), conta: textoOuNulo(leitura.conta) };
  return {
    formato: "pdf",
    conta: conta.banco || conta.agencia || conta.conta ? conta : null,
    periodo: inicio && fim && inicio <= fim ? { inicio, fim } : periodoDos(lancamentos),
    ...completarSaldos(lancamentos, numeroOuNulo(leitura.saldo_inicial), numeroOuNulo(leitura.saldo_final)),
    lancamentos,
    avisos,
  };
}

// ─── Comum ──────────────────────────────────────────────────────────────────

/** OFX ou CSV, pelo conteúdo; null quando não dá para ler. */
export function lerExtrato(texto: string): ExtratoLido | null {
  if (ehOfx(texto)) return lerOfx(texto);
  return lerCsvExtrato(texto)?.extrato ?? null;
}

export type Totais = { creditos: number; debitos: number; quantidade: number };

export function totaisDoExtrato(lancamentos: readonly LancamentoLido[]): Totais {
  let creditos = 0;
  let debitos = 0;
  for (const l of lancamentos) {
    if (l.natureza === "credito") creditos += centavos(l.valor);
    else debitos += centavos(l.valor);
  }
  return { creditos: reais(creditos), debitos: reais(debitos), quantidade: lancamentos.length };
}

export type ConferenciaDeSaldo =
  | { situacao: "confere" }
  | { situacao: "diverge"; esperado: number; informado: number; diferenca: number }
  | { situacao: "sem_saldos" };

/** Saldo inicial + créditos − débitos tem de dar o saldo final do arquivo. */
export function conferirSaldo(extrato: Pick<ExtratoLido, "saldoInicial" | "saldoFinal" | "lancamentos">): ConferenciaDeSaldo {
  if (extrato.saldoInicial === null || extrato.saldoFinal === null) return { situacao: "sem_saldos" };
  const { creditos, debitos } = totaisDoExtrato(extrato.lancamentos);
  const esperado = centavos(extrato.saldoInicial) + centavos(creditos) - centavos(debitos);
  const informado = centavos(extrato.saldoFinal);
  return esperado === informado
    ? { situacao: "confere" }
    : { situacao: "diverge", esperado: reais(esperado), informado: reais(informado), diferenca: reais(informado - esperado) };
}

/**
 * Chave de cada lançamento dentro da conta, para importar de novo um período
 * que se sobrepõe sem duplicar. Com FITID, ele manda; sem, data, sentido,
 * valor, documento e histórico, numerados quando se repetem no mesmo arquivo
 * (duas tarifas iguais no mesmo dia continuam sendo duas). Na leitura do PDF
 * o histórico fica de fora: a IA pode escrevê-lo de outro jeito em outra
 * leitura do mesmo período.
 */
export function chavesDosLancamentos(lancamentos: readonly LancamentoLido[], formato?: ExtratoLido["formato"]): string[] {
  const vistas = new Map<string, number>();
  return lancamentos.map(l => {
    if (l.idExterno) return `fitid:${l.idExterno}`;
    const historico = formato === "pdf" ? "" : semAcento(l.historico).replace(/[^a-z0-9]/g, "");
    const base = [l.data, l.natureza, centavos(l.valor), l.documentoNormalizado ?? "", historico].join("|");
    const ordem = (vistas.get(base) ?? 0) + 1;
    vistas.set(base, ordem);
    return `${base}|${ordem}`;
  });
}

/** Resumo do arquivo para gravar a importação (hash do conteúdo evita importar o mesmo arquivo duas vezes). */
export async function hashDoArquivo(bytes: Uint8Array): Promise<string> {
  const copia = new Uint8Array(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", copia.buffer);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
