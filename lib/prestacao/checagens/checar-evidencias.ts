// Checagens das evidências (P3.2): a evidência comprova o objeto (IN 29/2026,
// art. 69, I e III) quando se liga a uma meta, atividade ou local e quando a
// data e a posição lidas da foto batem com a execução, a atividade e o local.
//
//  * sem vínculo, a evidência não comprova nada no relatório;
//  * foto tirada antes do início ou depois do fim da execução;
//  * foto em outra data que a da atividade (com um dia de tolerância);
//  * foto a mais de DISTANCIA_MAXIMA_KM da sede do município do local (o da
//    evidência ou, sem ele, o da atividade).
// São alertas, não bloqueios, mesmo quando a regra "evidencias" do regime é
// bloqueio: a regra pede que haja evidência; uma foto fora do esperado pede
// revisão, e quem segue escreve a justificativa na própria evidência.

import {
  DISTANCIA_MAXIMA_KM,
  nomeDaEvidencia,
  periodoDaAtividade,
  quandoFoiTirada,
  somarDias,
  TOLERANCIA_DIAS_ATIVIDADE,
} from "../evidencias";
import { distanciaKm } from "../municipios";
import { rotuloDoLocal } from "../objeto";
import { dataBr, novoAchado, type Achado, type EstadoDaPrestacao } from "./catalogo";

export function checarEvidencias(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const evidencias = estado.evidencias ?? [];
  if (evidencias.length === 0) return [];
  const atividades = new Map((estado.atividades ?? []).map(a => [a.id, a]));
  const locais = new Map((estado.locais ?? []).map(l => [l.id, l]));
  const inicioExecucao = estado.prestacao?.data_inicio_execucao ?? null;
  const fimExecucao = estado.prestacao?.data_fim_execucao ?? null;
  const achados: Achado[] = [];

  for (const e of evidencias) {
    const entidade = { tipo: "evidencia" as const, id: e.id };
    const nome = nomeDaEvidencia(e);
    const justificativa = e.justificativa?.trim() || null;

    if (!e.atividade_id && !e.meta_id && !e.local_id) {
      achados.push(novoAchado(regime, {
        codigo: "EVIDENCIA_SEM_VINCULO",
        severidade: "alerta",
        entidade,
        mensagem: `"${nome}" não está ligada a meta, atividade nem local; ligue para que ela comprove o objeto.`,
      }));
    }

    const dia = e.capturada_em?.slice(0, 10) ?? null;
    if (dia) {
      const fora = inicioExecucao && dia < inicioExecucao ? `antes do início da execução (${dataBr(inicioExecucao)})`
        : fimExecucao && dia > fimExecucao ? `depois do fim da execução (${dataBr(fimExecucao)})`
        : null;
      if (fora) {
        achados.push(novoAchado(regime, {
          codigo: "EVIDENCIA_FORA_DO_PERIODO",
          severidade: "alerta",
          entidade,
          mensagem: `"${nome}" foi tirada em ${quandoFoiTirada(e.capturada_em)}, ${fora}.`,
          dados: { capturada_em: e.capturada_em },
          justificativa,
        }));
      }
      const atividade = e.atividade_id ? atividades.get(e.atividade_id) : undefined;
      if (atividade) {
        const { inicio, fim } = periodoDaAtividade(atividade);
        if (dia < somarDias(inicio, -TOLERANCIA_DIAS_ATIVIDADE) || dia > somarDias(fim, TOLERANCIA_DIAS_ATIVIDADE)) {
          achados.push(novoAchado(regime, {
            codigo: "EVIDENCIA_FORA_DA_ATIVIDADE",
            severidade: "alerta",
            entidade,
            mensagem: `"${nome}" foi tirada em ${dataBr(dia)}, e a atividade "${atividade.titulo}" é de ${inicio === fim ? dataBr(inicio) : `${dataBr(inicio)} a ${dataBr(fim)}`}.`,
            dados: { capturada_em: e.capturada_em, atividade: atividade.id },
            justificativa,
          }));
        }
      }
    }

    if (e.latitude !== null && e.latitude !== undefined && e.longitude !== null && e.longitude !== undefined) {
      const localId = e.local_id ?? (e.atividade_id ? atividades.get(e.atividade_id)?.local_id : null) ?? null;
      const local = localId ? locais.get(localId) : undefined;
      if (local && local.latitude !== null && local.latitude !== undefined && local.longitude !== null && local.longitude !== undefined) {
        const km = distanciaKm(
          { latitude: Number(e.latitude), longitude: Number(e.longitude) },
          { latitude: Number(local.latitude), longitude: Number(local.longitude) },
        );
        if (km > DISTANCIA_MAXIMA_KM) {
          achados.push(novoAchado(regime, {
            codigo: "EVIDENCIA_LONGE_DO_LOCAL",
            severidade: "alerta",
            entidade,
            mensagem: `"${nome}" foi tirada a ${Math.round(km).toLocaleString("pt-BR")} km de ${rotuloDoLocal(local)}.`,
            dados: { distancia_km: Math.round(km), local: local.id },
            justificativa,
          }));
        }
      }
    }
  }
  return achados;
}
