// Devoluções e GRU (P4.4).
//
// O regime diz como se devolve (posEnvio.devolucao): a descrição, o índice de
// atualização (em texto) e os campos da guia. Saldo e rendimentos voltam como
// estão, no encerramento; o valor irregular (glosa, reprovação) volta pelo
// índice do regime. Na Rouanet e na saúde, o índice é a caderneta de
// poupança (IN 29/2026, art. 77: "desde a data do término do prazo de
// captação"); na ANCINE, a SELIC; na LIE, os índices do TCU.
//
// A poupança rende por aniversário: cada mês cheio desde a data-base soma a
// rentabilidade do período que começa naquele dia (série 195 do Banco
// Central); depósitos nos dias 29, 30 e 31 fazem aniversário no dia 1º do mês
// seguinte (Lei 8.177/1991, art. 12, § 3º). Mês incompleto não rende. Sem
// React e sem Supabase.

import { definida, type Fonte, type RegimeNormativo } from "./regimes";
import type { PrestacaoDevolucao } from "@/lib/supabase/types";

export type MotivoDevolucao = PrestacaoDevolucao["motivo"];
export type IndiceDevolucao = PrestacaoDevolucao["indice"];

export const MOTIVOS_DEVOLUCAO: readonly { id: MotivoDevolucao; rotulo: string }[] = [
  { id: "saldo", rotulo: "Saldo não utilizado" },
  { id: "rendimento", rotulo: "Rendimentos da aplicação" },
  { id: "glosa", rotulo: "Despesa glosada" },
  { id: "reprovacao", rotulo: "Reprovação das contas" },
  { id: "outro", rotulo: "Outro motivo" },
];
export const rotuloDoMotivo = (id: string) => MOTIVOS_DEVOLUCAO.find(m => m.id === id)?.rotulo ?? id;

export const ROTULO_DO_INDICE: Record<IndiceDevolucao, string> = {
  nenhum: "Sem atualização",
  poupanca: "Caderneta de poupança",
  selic: "SELIC",
  outro: "Índice do regime",
};

const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : null);
const centavos = (v: unknown) => Math.round((Number(v) || 0) * 100);
export const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** Centavos em "1234,56", como o PagTesouro aceita. */
export const valorParaAGuia = (c: number) => `${Math.floor(c / 100)},${String(c % 100).padStart(2, "0")}`;

/** A devolução do regime, quando ele a define. */
export function devolucaoDoRegime(regime: RegimeNormativo | null | undefined) {
  const pos = regime ? definida(regime.posEnvio) : null;
  return pos?.devolucao ?? null;
}

/** O índice que corrige o motivo: saldo e rendimentos voltam como estão; o irregular, pelo índice do regime. */
export function indiceDoMotivo(regime: RegimeNormativo | null | undefined, motivo: MotivoDevolucao): IndiceDevolucao {
  if (motivo === "saldo" || motivo === "rendimento") return "nenhum";
  const texto = devolucaoDoRegime(regime)?.atualizacao ?? "";
  if (/poupan/i.test(texto)) return "poupanca";
  if (/selic/i.test(texto)) return "selic";
  return texto.trim() ? "outro" : "nenhum";
}

export type GuiaDoRegime = { unidadeGestora: string; gestao: string | null; codigo: string; referencia: string; fonte: Fonte };

/** As guias do regime (a ANCINE tem uma por fonte de recurso). */
export function guiasDoRegime(regime: RegimeNormativo | null | undefined): GuiaDoRegime[] {
  return [...(devolucaoDoRegime(regime)?.gru ?? [])];
}

/** O número de referência da guia: o identificador oficial só com letras e algarismos (Pronac, SALIC, processo). */
export function referenciaDaGuia(identificador: string | null | undefined): string | null {
  const limpo = String(identificador ?? "").replace(/[^0-9A-Za-z]/g, "");
  return limpo || null;
}

/** O regime usa o número do processo como referência da GRU (a LIE: "número do processo, sem caracteres especiais"). */
export function regimeUsaProcesso(regime: RegimeNormativo | null | undefined): boolean {
  return guiasDoRegime(regime).some(g => /processo/i.test(g.referencia));
}

/** A referência da guia da prestação: o processo, quando o regime pede (P8.8); senão, o identificador oficial. */
export function referenciaDaPrestacao(
  regime: RegimeNormativo | null | undefined,
  p: { identificador_oficial?: string | null; numero_processo?: string | null } | null | undefined,
): string | null {
  return referenciaDaGuia(regimeUsaProcesso(regime) ? p?.numero_processo : p?.identificador_oficial);
}

// ─── Poupança ───────────────────────────────────────────────────────────────

function partes(iso: string): [number, number, number] {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return [a, m, d];
}
const iso = (a: number, m: number, d: number) => `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Mais n meses, no mesmo dia (o aniversário nunca passa do dia 28). */
export function somarMeses(data: string, n: number): string {
  const [a, m, d] = partes(data);
  const total = a * 12 + (m - 1) + n;
  return iso(Math.floor(total / 12), (total % 12) + 1, d);
}

/** O primeiro aniversário: o próprio dia, ou o dia 1º seguinte para os dias 29, 30 e 31. */
export function aniversarioDaPoupanca(data: string): string {
  const [a, m, d] = partes(data);
  return d > 28 ? somarMeses(iso(a, m, 1), 1) : iso(a, m, d);
}

/** Inícios dos meses cheios entre a data-base e `ate` (o último mês termina até `ate`). */
export function aniversarios(dataBase: string, ate: string): string[] {
  const saida: string[] = [];
  for (let inicio = aniversarioDaPoupanca(dataBase); somarMeses(inicio, 1) <= ate; inicio = somarMeses(inicio, 1)) {
    saida.push(inicio);
    if (saida.length > 1200) break;
  }
  return saida;
}

/** Rentabilidade (%) do período que começa em `data`, como a série 195 do Banco Central publica. */
export type TaxaDaPoupanca = { data: string; valor: number };

/** A série 195 ("dd/mm/aaaa", valor em texto) em taxas com data ISO; linhas ilegíveis ficam de fora. */
export function taxasDaSerie(linhas: unknown): TaxaDaPoupanca[] {
  if (!Array.isArray(linhas)) return [];
  return linhas.flatMap(l => {
    const data = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String((l as { data?: unknown })?.data ?? ""));
    const valor = Number(String((l as { valor?: unknown })?.valor ?? "").replace(",", "."));
    return data && Number.isFinite(valor) ? [{ data: `${data[3]}-${data[2]}-${data[1]}`, valor }] : [];
  });
}

/** Janelas de até `anos` anos entre `de` e `ate` ("AAAA-MM-DD"): a API do Banco Central limita a consulta de séries diárias. */
export function janelasDaConsulta(de: string, ate: string, anos = 5): { de: string; ate: string }[] {
  const janelas: { de: string; ate: string }[] = [];
  const dia = (a: number, m: number, d: number) => new Date(Date.UTC(a, m - 1, d)).toISOString().slice(0, 10);
  for (let inicio = de; inicio <= ate && janelas.length < 40;) {
    const [a, m, d] = partes(inicio);
    const fim = dia(a + anos, m, d - 1);
    janelas.push({ de: inicio, ate: fim < ate ? fim : ate });
    inicio = dia(a + anos, m, d);
  }
  return janelas;
}

export type AtualizacaoPelaPoupanca = {
  /** Produto de (1 + taxa) dos meses cheios; 1 sem mês cheio. */
  fator: number;
  /** Centavos. */
  valor: number;
  meses: number;
  /** Primeiro aniversário e o fim do último mês contado. */
  de: string;
  ate: string;
  /** Aniversários sem taxa na série: com algum, o valor não é calculado. */
  faltando: string[];
};

export function atualizarPelaPoupanca(principalCentavos: number, dataBase: string, ate: string, taxas: readonly TaxaDaPoupanca[]): AtualizacaoPelaPoupanca {
  const porData = new Map(taxas.map(t => [t.data, t.valor]));
  const inicios = aniversarios(dataBase, ate);
  const faltando = inicios.filter(d => !porData.has(d));
  const fator = inicios.reduce((f, d) => f * (1 + (porData.get(d) ?? 0) / 100), 1);
  const de = aniversarioDaPoupanca(dataBase);
  return {
    fator,
    valor: Math.round(principalCentavos * fator),
    meses: inicios.length,
    de,
    ate: inicios.length ? somarMeses(inicios[inicios.length - 1], 1) : de,
    faltando,
  };
}

// ─── Guia e situação ────────────────────────────────────────────────────────

export type DevolucaoParaGuia = Pick<PrestacaoDevolucao,
  "valor_principal" | "valor_atualizado" | "gru_unidade_gestora" | "gru_gestao" | "gru_codigo" | "gru_referencia" | "competencia" | "vencimento">;

export type CampoDaGuia = { rotulo: string; valor: string | null };

/** Os campos para preencher a guia no PagTesouro, na ordem da tela. */
export function camposDaGuia(d: DevolucaoParaGuia, contribuinte: { nome: string; documento: string | null } | null): CampoDaGuia[] {
  const total = centavos(d.valor_atualizado ?? d.valor_principal);
  return [
    { rotulo: "Unidade gestora (UG)", valor: d.gru_unidade_gestora },
    ...(d.gru_gestao ? [{ rotulo: "Gestão", valor: d.gru_gestao }] : []),
    { rotulo: "Código de recolhimento", valor: d.gru_codigo },
    { rotulo: "Número de referência", valor: d.gru_referencia },
    { rotulo: "Competência", valor: d.competencia },
    { rotulo: "Vencimento", valor: dataBr(d.vencimento) },
    { rotulo: "CNPJ ou CPF do contribuinte", valor: contribuinte?.documento ? contribuinte.documento.replace(/[^0-9A-Za-z]/g, "") : null },
    { rotulo: "Nome do contribuinte", valor: contribuinte?.nome ?? null },
    { rotulo: "Valor principal", valor: valorParaAGuia(centavos(d.valor_principal)) },
    { rotulo: "Valor total", valor: valorParaAGuia(total) },
  ];
}

export type SituacaoDaDevolucao = { estado: "a_pagar" | "vencida" | "paga"; texto: string };

export function situacaoDaDevolucao(d: Pick<PrestacaoDevolucao, "situacao" | "pago_em" | "vencimento" | "valor_pago">, hoje: string): SituacaoDaDevolucao {
  if (d.situacao === "paga") return { estado: "paga", texto: `Paga em ${dataBr(d.pago_em)}${d.valor_pago !== null ? `, ${reais(centavos(d.valor_pago))}` : ""}` };
  if (d.vencimento && d.vencimento < hoje) return { estado: "vencida", texto: `Venceu em ${dataBr(d.vencimento)}` };
  return { estado: "a_pagar", texto: d.vencimento ? `A pagar até ${dataBr(d.vencimento)}` : "A pagar" };
}

/** A atualização gravada vale enquanto o principal, o índice e a data-base não mudam. */
export function atualizacaoContinuaValida(
  antes: Pick<PrestacaoDevolucao, "valor_principal" | "indice" | "data_base">,
  depois: Pick<PrestacaoDevolucao, "valor_principal" | "indice" | "data_base">,
): boolean {
  return centavos(antes.valor_principal) === centavos(depois.valor_principal) && antes.indice === depois.indice && antes.data_base === depois.data_base;
}

/** Competência do mês de `hoje` ("AAAA-MM-DD"), em "MM/AAAA". */
export const competenciaDe = (hoje: string) => `${hoje.slice(5, 7)}/${hoje.slice(0, 4)}`;

export type CamposDaDevolucao = Pick<PrestacaoDevolucao,
  "motivo" | "descricao" | "valor_principal" | "indice" | "data_base" | "competencia" | "vencimento" | "situacao" | "pago_em" | "valor_pago" | "observacoes">;

/** O mesmo que o banco confere, para a tela avisar antes de salvar. */
export function erroDaDevolucao(d: CamposDaDevolucao): string | null {
  if (!(Number(d.valor_principal) > 0)) return "Informe o valor a devolver.";
  if (d.indice !== "nenhum" && !d.data_base) return "Informe a data-base da atualização.";
  if (d.competencia && !/^(0[1-9]|1[0-2])\/\d{4}$/.test(d.competencia)) return "A competência é mês e ano: MM/AAAA.";
  if (d.situacao === "paga" && (!d.pago_em || !(Number(d.valor_pago) > 0))) return "Informe a data e o valor pagos.";
  if ((d.descricao?.length ?? 0) > 500) return "A descrição tem até 500 caracteres.";
  if ((d.observacoes?.length ?? 0) > 1000) return "As observações têm até 1.000 caracteres.";
  return null;
}

/** Recolhimento do encerramento (saldo e rendimentos), para o checklist de envio. */
export function recolhimentoDoEncerramento(devolucoes: readonly Pick<PrestacaoDevolucao, "motivo" | "situacao" | "valor_principal" | "valor_atualizado" | "valor_pago" | "pago_em" | "storage_path">[]) {
  const doEncerramento = devolucoes.filter(d => d.motivo === "saldo" || d.motivo === "rendimento");
  const aPagar = doEncerramento.filter(d => d.situacao !== "paga");
  return {
    guias: doEncerramento.length,
    aPagar: aPagar.length,
    valorAPagar: aPagar.reduce((s, d) => s + centavos(d.valor_atualizado ?? d.valor_principal), 0),
    semComprovante: doEncerramento.filter(d => d.situacao === "paga" && !d.storage_path).length,
    valorPago: doEncerramento.filter(d => d.situacao === "paga").reduce((s, d) => s + centavos(d.valor_pago), 0),
    pagasEm: [...new Set(doEncerramento.map(d => d.pago_em).filter((x): x is string => Boolean(x)))].sort(),
  };
}
