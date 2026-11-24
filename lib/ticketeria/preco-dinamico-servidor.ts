import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { FATOR_BASE, VERSAO_DO_ACEITE, proximoFator, type RegraDinamica } from "@/lib/ticketeria/preco-dinamico";
import { quadroDoEvento } from "@/lib/ticketeria/precificacao-servidor";

type Admin = SupabaseClient<Database>;

/** A plataforma liberou o preço dinâmico? Enquanto o texto do aceite não passa pelo advogado, só com TICKETERIA_PRECO_DINAMICO_LIBERADO=sim (decisão do dono, plano seção 11). */
export const precoDinamicoLiberado = (ambiente: Record<string, string | undefined> = process.env): boolean => ambiente.TICKETERIA_PRECO_DINAMICO_LIBERADO === "sim";

export type RegraDoEvento = RegraDinamica & { aceiteEm: string | null; aceiteVersao: string | null };
export type FatorDaSessao = { sessaoId: string; setorId: string; setor: string; fatorBps: number; direcao: string; motivo: string | null; atualizadoEm: string };

/** A regra do evento (nasce desligada: sem linha, é a padrão desligada) e o fator de cada sessão e setor (o preço dinâmico é por setor: o VIP pode subir enquanto o anel 4 baixa). */
export async function adesaoDoEvento(admin: Admin, eventoId: string): Promise<{ regra: RegraDoEvento | null; fatores: FatorDaSessao[] }> {
  const t = clienteDaTicketeria(admin);
  const { data: r } = await t.from("ticketeria_preco_dinamico").select("ativo, piso_bps, teto_bps, passo_bps, intervalo_minutos, aceite_em, aceite_versao").eq("evento_id", eventoId).maybeSingle();
  const { data: sessoes } = await t.from("ticketeria_sessoes").select("id").eq("evento_id", eventoId);
  const ids = (sessoes ?? []).map(s => s.id);
  const { data: estados } = ids.length > 0 ? await t.from("ticketeria_preco_dinamico_estado").select("sessao_id, setor_id, fator_bps, direcao, motivo, atualizado_em").in("sessao_id", ids) : { data: [] };
  const idsDosSetores = [...new Set((estados ?? []).map(e => e.setor_id))];
  const { data: setores } = idsDosSetores.length > 0 ? await t.from("ticketeria_setores").select("id, nome").in("id", idsDosSetores) : { data: [] };
  const nomeDoSetor = new Map((setores ?? []).map(x => [x.id, x.nome] as const));
  return {
    regra: r ? { ativo: r.ativo, pisoBps: r.piso_bps, tetoBps: r.teto_bps, passoBps: r.passo_bps, intervaloMinutos: r.intervalo_minutos, aceiteEm: r.aceite_em, aceiteVersao: r.aceite_versao } : null,
    fatores: (estados ?? []).map(e => ({ sessaoId: e.sessao_id, setorId: e.setor_id, setor: nomeDoSetor.get(e.setor_id) ?? "Setor", fatorBps: e.fator_bps, direcao: e.direcao, motivo: e.motivo, atualizadoEm: e.atualizado_em })),
  };
}

/** Liga ou desliga a adesão (a rota já conferiu quem é a pessoa, que ela edita a Ticketeria da loja e que a plataforma liberou). Ligar grava o aceite da versão atual do texto. */
export async function definirAdesao(admin: Admin, e: { eventoId: string; ativo: boolean; regra: Pick<RegraDinamica, "pisoBps" | "tetoBps" | "passoBps" | "intervaloMinutos">; usuarioId: string }): Promise<void> {
  const { error } = await clienteDaTicketeria(admin).rpc("fn_ticketeria_preco_dinamico_definir", {
    p_evento: e.eventoId, p_ativo: e.ativo, p_piso: e.regra.pisoBps, p_teto: e.regra.tetoBps, p_passo: e.regra.passoBps, p_intervalo: e.regra.intervaloMinutos,
    p_aceite_versao: e.ativo ? VERSAO_DO_ACEITE : null, p_usuario: e.ativo ? e.usuarioId : null,
  });
  if (error) throw new Error(error.message);
}

/**
 * A rodada do atualizador (cron): para cada evento com adesão ativa, lê a direção de cada sessão por vir e de cada setor dela no quadro de precificação (P1) e move o fator daquele setor um passo (proximoFator), dentro do piso e do teto.
 * Grava só quando o fator ou a direção mudou. Um evento que falha não derruba os outros.
 */
export async function atualizarPrecosDinamicos(admin: Admin, agora: number = Date.now()): Promise<{ eventos: number; sessoes: number; mudaram: number; falhas: number }> {
  const t = clienteDaTicketeria(admin);
  const { data: regras } = await t.from("ticketeria_preco_dinamico").select("evento_id, piso_bps, teto_bps, passo_bps, intervalo_minutos").eq("ativo", true);
  const resumo = { eventos: 0, sessoes: 0, mudaram: 0, falhas: 0 };
  for (const r of regras ?? []) {
    try {
      const { data: evento } = await t.from("ticketeria_eventos").select("loja_id").eq("id", r.evento_id).maybeSingle();
      if (!evento) continue;
      const quadro = await quadroDoEvento(admin, evento.loja_id, r.evento_id, agora);
      if (!quadro) continue;
      resumo.eventos += 1;
      const regra: RegraDinamica = { ativo: true, pisoBps: r.piso_bps, tetoBps: r.teto_bps, passoBps: r.passo_bps, intervaloMinutos: r.intervalo_minutos };
      const { data: estados } = await t.from("ticketeria_preco_dinamico_estado").select("sessao_id, setor_id, fator_bps, direcao, atualizado_em").in("sessao_id", quadro.linhas.map(l => l.sessaoId));
      const porSessaoESetor = new Map((estados ?? []).map(e => [`${e.sessao_id}|${e.setor_id}`, e] as const));
      for (const linha of quadro.linhas) {
        resumo.sessoes += 1;
        const atual = porSessaoESetor.get(`${linha.sessaoId}|${linha.setorId}`);
        const passo = proximoFator({
          regra, fatorAtualBps: atual?.fator_bps ?? FATOR_BASE, direcao: linha.sugestao.direcao, horasAteASessao: (Date.parse(linha.inicio) - agora) / 3_600_000,
          minutosDesdeAUltima: atual && atual.fator_bps !== FATOR_BASE ? Math.floor((agora - Date.parse(atual.atualizado_em)) / 60_000) : null,
        });
        if (atual && !passo.mudou && atual.direcao === passo.direcao) continue;
        const { error } = await t.rpc("fn_ticketeria_preco_dinamico_registrar", { p_sessao: linha.sessaoId, p_setor: linha.setorId, p_fator: passo.fatorBps, p_direcao: passo.direcao, p_motivo: passo.motivo });
        if (error) { resumo.falhas += 1; console.error("[ticketeria] preço dinâmico: registrar:", error.message); continue; }
        if (passo.mudou) resumo.mudaram += 1;
      }
    } catch (erro) {
      resumo.falhas += 1;
      console.error("[ticketeria] preço dinâmico: evento", r.evento_id, erro instanceof Error ? erro.message : erro);
    }
  }
  return resumo;
}
