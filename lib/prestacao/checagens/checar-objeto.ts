// Checagens do objeto (P3.1): metas propostas × resultados e a situação de
// cada local de realização, com a severidade e a fonte do regime (Rouanet:
// IN 29/2026, art. 69, II).
//
//  * sem metas, o relatório não tem o que comparar;
//  * depois do fim da execução, meta sem realizado e local ainda "previsto"
//    são dados que faltam;
//  * meta abaixo do previsto pede justificativa, escrita na própria meta.

import { periodoDaAtividade } from "../evidencias";
import { coberturaDaMeta, execucaoTerminou, quantidade, rotuloDoLocal } from "../objeto";
import { dataBr, novoAchado, severidadeDaChecagem, type Achado, type EstadoDaPrestacao } from "./catalogo";

export function checarObjeto(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const metas = estado.metas ?? [];
  const locais = estado.locais ?? [];
  const fim = estado.prestacao?.data_fim_execucao ?? null;
  const terminou = execucaoTerminou(fim, estado.hoje ?? new Date());
  const achados: Achado[] = [];

  if (metas.length === 0) {
    achados.push(novoAchado(regime, {
      codigo: "OBJETO_SEM_METAS",
      severidade: severidadeDaChecagem(regime, "OBJETO_SEM_METAS", "alerta"),
      entidade: { tipo: "prestacao", id: null },
      mensagem: "Cadastre as metas do projeto com o previsto: o relatório do objeto compara cada meta com o resultado.",
    }));
  }

  for (const meta of metas) {
    const entidade = { tipo: "meta" as const, id: meta.id };
    if (meta.realizado === null || meta.realizado === undefined) {
      if (!terminou) continue;
      achados.push(novoAchado(regime, {
        codigo: "META_SEM_RESULTADO",
        severidade: severidadeDaChecagem(regime, "META_SEM_RESULTADO", "alerta"),
        entidade,
        mensagem: `A execução terminou em ${dataBr(fim!)} e a meta "${meta.descricao}" ainda não tem o realizado.`,
        dados: { previsto: Number(meta.previsto) },
      }));
      continue;
    }
    const previsto = Number(meta.previsto), realizado = Number(meta.realizado);
    if (realizado < previsto) {
      // Abaixo do previsto se explica: a justificativa escrita na meta vale para o achado.
      achados.push(novoAchado(regime, {
        codigo: "META_ABAIXO_DO_PREVISTO",
        severidade: "justificativa",
        entidade,
        mensagem: `"${meta.descricao}": ${quantidade(realizado, meta.unidade)} de ${quantidade(previsto, meta.unidade)} previstos. Explique a diferença na meta.`,
        dados: { previsto, realizado },
        justificativa: meta.justificativa?.trim() || null,
      }));
    }
  }

  if (terminou) {
    for (const local of locais) {
      if (local.status !== "previsto") continue;
      achados.push(novoAchado(regime, {
        codigo: "LOCAL_SEM_SITUACAO",
        severidade: severidadeDaChecagem(regime, "LOCAL_SEM_SITUACAO", "alerta"),
        entidade: { tipo: "local", id: local.id },
        mensagem: `Diga se ${rotuloDoLocal(local)} foi realizado, não realizado ou realizado com outras fontes.`,
      }));
    }
  }

  return achados;
}

// ─── Cobertura por meta (P3.3) ──────────────────────────────────────────────
//
// A meta com resultado (realizado ou atividade realizada) precisa de
// evidência, ligada a ela ou às atividades dela; a severidade é a da regra
// "evidencias" do regime (bloqueio na Rouanet). Cada atividade realizada que
// já terminou e não tem evidência é um alerta, para achar o que falta.

export function checarCobertura(estado: EstadoDaPrestacao): Achado[] {
  const { regime } = estado;
  const metas = estado.metas ?? [];
  const atividades = estado.atividades ?? [];
  const evidencias = estado.evidencias ?? [];
  const hoje = estado.hoje ?? new Date();
  const achados: Achado[] = [];

  const doEstado = atividades.map(a => ({ id: a.id, meta_id: a.meta_id ?? null, status_realizacao: a.status_realizacao ?? "realizado" }));
  for (const meta of metas) {
    const cobertura = coberturaDaMeta(meta, doEstado, evidencias);
    const temResultado = (meta.realizado !== null && meta.realizado !== undefined && Number(meta.realizado) > 0) || cobertura.atividadesRealizadas > 0;
    if (!temResultado || cobertura.evidencias > 0) continue;
    achados.push(novoAchado(regime, {
      codigo: "META_SEM_EVIDENCIA",
      severidade: severidadeDaChecagem(regime, "META_SEM_EVIDENCIA", "alerta"),
      entidade: { tipo: "meta", id: meta.id },
      mensagem: `"${meta.descricao}" tem resultado e nenhuma evidência: envie fotos, listas de presença ou outros registros ligados à meta ou às atividades dela.`,
      dados: { atividades_realizadas: cobertura.atividadesRealizadas },
    }));
  }

  for (const a of atividades) {
    if ((a.status_realizacao ?? "realizado") !== "realizado") continue;
    if (!execucaoTerminou(periodoDaAtividade(a).fim, hoje)) continue;
    if (evidencias.some(e => e.atividade_id === a.id)) continue;
    achados.push(novoAchado(regime, {
      codigo: "ATIVIDADE_SEM_EVIDENCIA",
      severidade: "alerta",
      entidade: { tipo: "atividade", id: a.id },
      mensagem: `A atividade "${a.titulo}" foi realizada e ainda não tem evidência.`,
    }));
  }
  return achados;
}
