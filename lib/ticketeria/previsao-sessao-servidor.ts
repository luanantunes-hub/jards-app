import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { diaNoFuso } from "@/lib/ticketeria/divulgacao";
import { partesNoFuso } from "@/lib/ticketeria/eventos";
import { vendasPorSessao } from "@/lib/ticketeria/esgotamento-servidor";
import {
  comoCadaDiaVende, esgotou, forcaDoEvento, fraseDosDias, opcoesDoESe, procuraSobrando, type DiaEHorario, type EstimativaDaSessao, type ProcuraSobrando, type SessaoDaCasa,
} from "@/lib/ticketeria/previsao-sessao";

type Admin = SupabaseClient<Database>;
const PAGINA = 1000;
const FUSO_PADRAO = "America/Sao_Paulo";

export type SessaoComVenda = { id: string; vendidos: number; lugares: number; esgotou: boolean };
export type PrevisaoDoEvento = {
  procura: ProcuraSobrando | null; opcoes: EstimativaDaSessao[]; forca: { forca: number; sessoes: number } | null;
  /** A venda de cada sessão do evento (para a lista de sessões). */ sessoes: SessaoComVenda[];
  /** O espaço e a sala da sessão nova (os mais usados pelo evento), para abrir o cadastro já preenchido. */ local: { localId: string; salaId: string } | null;
};
export type PrevisaoDaLoja = { hoje: string; dias: DiaEHorario[]; frase: string | null; evento: PrevisaoDoEvento | null };

/**
 * A previsão por sessão de uma loja: como cada dia e horário vende na casa e, com `eventoId`, a procura sobrando do evento e as opções do "e se eu acrescentar uma sessão?".
 * Só sessões de um dia, não canceladas (a exposição tem outra lógica de lotação). Lido com a chave de serviço (quem chama já foi conferido como quem edita a Ticketeria).
 */
export async function previsaoDaLoja(admin: Admin, lojaId: string, eventoId: string | null, hoje: string = diaNoFuso(new Date())): Promise<PrevisaoDaLoja> {
  const t = clienteDaTicketeria(admin);
  const [{ data: eventos }, { data: locais }] = await Promise.all([
    t.from("ticketeria_eventos").select("id").eq("loja_id", lojaId),
    t.from("ticketeria_locais").select("id, fuso").eq("loja_id", lojaId),
  ]);
  const ids = (eventos ?? []).map(e => e.id);
  const vazio: PrevisaoDaLoja = { hoje, dias: [], frase: null, evento: null };
  if (ids.length === 0 || (eventoId && !ids.includes(eventoId))) return vazio;
  const fuso = new Map((locais ?? []).map(l => [l.id, l.fuso]));
  const sessoes: { id: string; evento_id: string; local_id: string; sala_id: string; inicio: string; fim: string | null }[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    for (let de = 0; ; de += PAGINA) {
      const { data, error } = await t.from("ticketeria_sessoes").select("id, evento_id, local_id, sala_id, inicio, fim").in("evento_id", ids.slice(i, i + 100)).is("cancelada_em", null).order("inicio").range(de, de + PAGINA - 1);
      if (error) throw new Error(error.message);
      sessoes.push(...(data ?? []));
      if ((data ?? []).length < PAGINA) break;
    }
  }
  const deUmDia = sessoes.filter(s => !s.fim || diaNoFuso(s.fim, fuso.get(s.local_id)) <= diaNoFuso(s.inicio, fuso.get(s.local_id)));
  if (deUmDia.length === 0) return vazio;
  const { data: setores } = await t.from("ticketeria_setores").select("sala_id, lugares").in("local_id", [...new Set(deUmDia.map(s => s.local_id))]).eq("arquivado", false);
  const lugaresDaSala = new Map<string, number>();
  for (const x of setores ?? []) lugaresDaSala.set(x.sala_id, (lugaresDaSala.get(x.sala_id) ?? 0) + x.lugares);
  const vendas = await vendasPorSessao(admin, deUmDia.map(s => s.id));
  const daCasa: SessaoDaCasa[] = deUmDia.map(s => {
    const p = partesNoFuso(s.inicio, fuso.get(s.local_id) ?? FUSO_PADRAO);
    return { id: s.id, eventoId: s.evento_id, localId: s.local_id, salaId: s.sala_id, dia: p.dia, hora: p.hora, lugares: lugaresDaSala.get(s.sala_id) ?? 0, vendidos: (vendas.get(s.id) ?? []).reduce((a, v) => a + v.quantidade, 0) };
  });
  const dias = comoCadaDiaVende(daCasa, hoje);
  const resultado: PrevisaoDaLoja = { hoje, dias, frase: fraseDosDias(dias), evento: null };
  if (!eventoId) return resultado;

  const doEvento = daCasa.filter(s => s.eventoId === eventoId);
  // Quem está na lista de espera do evento (ainda não avisado): cada linha é uma pessoa.
  let naEspera = 0;
  const idsDoEvento = doEvento.map(s => s.id);
  for (let i = 0; i < idsDoEvento.length; i += 150) {
    const { count } = await t.from("ticketeria_espera").select("id", { count: "exact", head: true }).in("sessao_id", idsDoEvento.slice(i, i + 150)).is("avisado_em", null);
    naEspera += count ?? 0;
  }
  const forca = forcaDoEvento(doEvento, dias, hoje);
  const procura = procuraSobrando(doEvento, naEspera, hoje);
  const salas = new Map<string, { localId: string; salaId: string; n: number }>();
  for (const s of doEvento) salas.set(s.salaId, { localId: s.localId, salaId: s.salaId, n: (salas.get(s.salaId)?.n ?? 0) + 1 });
  const maisUsada = [...salas.values()].sort((a, b) => b.n - a.n)[0];
  resultado.evento = {
    procura, forca,
    // As opções só fazem sentido com procura sobrando: sem sinal medido, o Jards não sugere sessão a mais.
    opcoes: procura ? opcoesDoESe(doEvento, dias, forca, naEspera, hoje) : [],
    sessoes: doEvento.map(s => ({ id: s.id, vendidos: s.vendidos, lugares: s.lugares, esgotou: esgotou(s) })),
    local: maisUsada ? { localId: maisUsada.localId, salaId: maisUsada.salaId } : null,
  };
  return resultado;
}
