// Carimbo e atesto das notas (P8.8).
//
// Na Lei de Incentivo ao Esporte, cada nota original leva na frente o carimbo
// com o número do projeto no SLI e, no verso, o atesto de recebimento com a
// data e a assinatura (modelo de carimbos da DPPIE; Portaria MESP 10/2026,
// art. 41, § 1º, e art. 49, III). O texto sai exatamente como o modelo
// publicado; só a lei é escolhida na prestação, porque o modelo ainda cita a
// Lei 11.438/2006, revogada pela LC 222/2025. Sem React e sem Supabase.

import { regraDoRegime, type RegimeNormativo } from "./regimes";
import type { PrestacaoComprovante } from "@/lib/supabase/types";

/** A lei como está no modelo publicado. */
export const LEI_DO_MODELO = "LEI 11.438/2006";
/** A lei em vigor desde a LC 222/2025. */
export const LEI_EM_VIGOR = "LEI COMPLEMENTAR 222/2025";

export const OPCOES_DE_LEI: readonly { valor: string; rotulo: string; descricao: string }[] = [
  { valor: LEI_DO_MODELO, rotulo: "Lei 11.438/2006", descricao: "como no modelo publicado pela DPPIE" },
  { valor: LEI_EM_VIGOR, rotulo: "Lei Complementar 222/2025", descricao: "a lei em vigor" },
];

/** A lei do carimbo da prestação; sem escolha, a do modelo publicado. */
export const leiDoCarimbo = (escolhida: string | null | undefined) => escolhida?.trim() || LEI_DO_MODELO;

/** A frente da nota: "Nº SLIE/SLI ...", o ministério, a secretaria e a lei. */
export function frenteDoCarimbo(sli: string | null | undefined, lei: string | null | undefined): string[] {
  return [`Nº SLIE/SLI ${sli?.trim() || "______________"}`, "MINISTÉRIO DO ESPORTE", "SECRETARIA EXECUTIVA", leiDoCarimbo(lei)];
}

const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** O verso da nota: o atesto de recebimento, com a data quando já se sabe, e a assinatura. */
export function versoDoCarimbo(atestadoEm: string | null | undefined): string[] {
  return [`ATESTO QUE O SERVIÇO FOI RECEBIDO EM: ${atestadoEm ? dataBr(atestadoEm) : "_____/____/____"}`, "______________________________", "ASSINATURA"];
}

/** Documentos que levam o carimbo: notas, faturas, cupons e recibos; folha e guias, não. */
export const TIPOS_COM_CARIMBO = new Set(["nfe", "nfse", "cupom", "recibo", "rpa", "rpci", "invoice", "fatura", "nota_debito"]);

export type NotaDoCarimbo = Pick<PrestacaoComprovante, "id" | "tipo" | "status" | "data_doc"> & Partial<Pick<PrestacaoComprovante, "atestado_em">>;

/** As notas que pedem carimbo e atesto: as recusadas ficam de fora. */
export function notasDoCarimbo<T extends NotaDoCarimbo>(despesas: readonly T[]): T[] {
  return despesas.filter(d => d.status !== "rejeitado" && TIPOS_COM_CARIMBO.has(d.tipo));
}

/** O regime pede o carimbo e o atesto nas notas (a LIE, regra carimbo_e_atesto). */
export const regimePedeCarimbo = (regime: RegimeNormativo | null | undefined) => Boolean(regraDoRegime(regime, "carimbo_e_atesto"));

export type ProblemaDoAtesto = "antes_da_emissao" | "antes_da_vigencia" | "depois_da_vigencia";

/** O atesto vem depois da emissão e dentro da vigência (do Termo ao fim da execução). */
export function problemaDoAtesto(
  nota: Pick<NotaDoCarimbo, "data_doc" | "atestado_em">,
  vigencia: { inicio: string | null | undefined; fim: string | null | undefined },
): ProblemaDoAtesto | null {
  const atesto = nota.atestado_em?.slice(0, 10);
  if (!atesto) return null;
  if (nota.data_doc && atesto < nota.data_doc.slice(0, 10)) return "antes_da_emissao";
  if (vigencia.inicio && atesto < vigencia.inicio.slice(0, 10)) return "antes_da_vigencia";
  if (vigencia.fim && atesto > vigencia.fim.slice(0, 10)) return "depois_da_vigencia";
  return null;
}

export const TEXTO_DO_PROBLEMA: Record<ProblemaDoAtesto, string> = {
  antes_da_emissao: "atestada antes da emissão",
  antes_da_vigencia: "atestada antes da vigência",
  depois_da_vigencia: "atestada depois do fim da execução",
};

/** "Carimbos_SLI_2600123.pdf". */
export const nomeDosCarimbos = (sli: string | null | undefined) => `Carimbos_SLI_${(sli ?? "").replace(/\D/g, "") || "LIE"}.pdf`;
