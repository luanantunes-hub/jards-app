// O fechamento de uma reunião: busca a transcrição no Vexa, grava (uma vez só), marca como concluída e registra o uso. Usado pelo aviso do Vexa (webhook) e pela conferência periódica
// (lib/reunioes/conferir.ts), que cobre o caso de o aviso se perder.

import type { SupabaseClient } from "@supabase/supabase-js";
import { buscarTranscricao } from "./vexa";
import { registrarUsoDaReuniao } from "./uso";

export type ReuniaoParaConcluir = { id: string; iniciada_em: string | null };

/** Devolve `true` quando fechou. Falha ao buscar a transcrição deixa a reunião "processando" com o erro anotado (e devolve `false`), para tentar de novo. */
export async function concluirReuniao(admin: SupabaseClient, reuniao: ReuniaoParaConcluir, vexaId: string, comecouEm: string | null, terminouEm: string | null): Promise<boolean> {
  const iniciadaEm = reuniao.iniciada_em ?? comecouEm;
  const fim = terminouEm ? new Date(terminouEm) : new Date();
  await admin.from("reunioes").update({ status: "processando", ...(iniciadaEm && !reuniao.iniciada_em ? { iniciada_em: iniciadaEm } : {}) }).eq("id", reuniao.id);
  try {
    const trechos = await buscarTranscricao(vexaId);
    const { count } = await admin.from("reuniao_transcricoes").select("id", { count: "exact", head: true }).eq("reuniao_id", reuniao.id);
    if ((count ?? 0) === 0 && trechos.length > 0) {
      await admin.from("reuniao_transcricoes").insert(trechos.map(t => ({ reuniao_id: reuniao.id, falante: t.falante, texto: t.texto, inicio_ms: t.inicio_ms, fim_ms: t.fim_ms, confianca: t.confianca })));
    }
    await admin.from("reunioes").update({ status: "concluida", finalizada_em: fim.toISOString() }).eq("id", reuniao.id);
    await registrarUsoDaReuniao(admin, reuniao.id, iniciadaEm, fim);
    return true;
  } catch (erro) {
    await admin.from("reunioes").update({ erro: erro instanceof Error ? erro.message : "Não foi possível buscar a transcrição" }).eq("id", reuniao.id);
    return false;
  }
}
