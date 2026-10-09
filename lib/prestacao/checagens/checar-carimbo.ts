// Checagens do carimbo e do atesto das notas (P8.8), pela regra
// carimbo_e_atesto do regime (na LIE, o modelo de carimbos da DPPIE e a
// Portaria MESP 10/2026, art. 49, III):
//  * notas sem a data do atesto de recebimento, numa só pendência (aviso até
//    o fim da execução, a severidade da regra depois);
//  * nota atestada antes da emissão ou fora da vigência, uma por nota.
// O carimbo da frente não deixa rastro nos dados: o texto sai na aba Envio.

import { notasDoCarimbo, problemaDoAtesto, TEXTO_DO_PROBLEMA } from "../carimbo";
import { execucaoTerminou } from "../objeto";
import { regraDoRegime } from "../regimes";
import { novoAchado, type Achado, type EstadoDaPrestacao } from "./catalogo";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

export function checarCarimbo(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const regra = regraDoRegime(regime, "carimbo_e_atesto");
  if (!regra) return [];
  const notas = notasDoCarimbo(estado.despesas);
  if (!notas.length) return [];
  const achados: Achado[] = [];

  const semAtesto = notas.filter(n => !n.atestado_em);
  if (semAtesto.length) {
    const terminou = execucaoTerminou(estado.prestacao?.data_fim_execucao, estado.hoje ?? new Date());
    achados.push(novoAchado(regime, {
      codigo: "ATESTO_AUSENTE",
      severidade: terminou ? regra.severidade : "info",
      entidade: { tipo: "prestacao", id: null },
      mensagem: `${plural(semAtesto.length, "nota está", "notas estão")} sem a data do atesto de recebimento: carimbe a frente com o número do SLI, ateste o verso com a data e a assinatura e registre a data em Envio, Carimbo e atesto.`,
      dados: { sem_atesto: semAtesto.length, notas: notas.length },
    }));
  }

  const vigencia = {
    inicio: estado.prestacao?.data_termo ?? estado.prestacao?.data_inicio_execucao ?? null,
    fim: estado.prestacao?.data_fim_execucao ?? null,
  };
  for (const n of notas) {
    const problema = problemaDoAtesto(n, vigencia);
    if (!problema) continue;
    achados.push(novoAchado(regime, {
      codigo: "ATESTO_FORA_DA_DATA",
      severidade: regra.severidade,
      entidade: { tipo: "despesa", id: n.id },
      mensagem: `${n.nome_arquivo || "A nota"} foi ${TEXTO_DO_PROBLEMA[problema]}: o atesto é de ${dataBr(n.atestado_em!)}${n.data_doc ? `, a emissão de ${dataBr(n.data_doc)}` : ""}${problema !== "antes_da_emissao" && vigencia.inicio && vigencia.fim ? ` e a vigência vai de ${dataBr(vigencia.inicio)} a ${dataBr(vigencia.fim)}` : ""}.`,
      dados: { atestado_em: n.atestado_em ?? null, data_doc: n.data_doc ?? null, problema },
    }));
  }
  return achados;
}
