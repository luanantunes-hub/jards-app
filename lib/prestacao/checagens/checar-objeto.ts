// Checagens do objeto (P3.1): metas propostas × resultados e a situação de
// cada local de realização, com a severidade e a fonte do regime (Rouanet:
// IN 29/2026, art. 69, II).
//
//  * sem metas, o relatório não tem o que comparar;
//  * depois do fim da execução, meta sem realizado e local ainda "previsto"
//    são dados que faltam;
//  * meta abaixo do previsto pede justificativa, escrita na própria meta.

import { execucaoTerminou, quantidade, rotuloDoLocal } from "../objeto";
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
