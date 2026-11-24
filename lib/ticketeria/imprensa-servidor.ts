import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { CANAL_DA_IMPRENSA, assuntoDoNome, diaNoFuso } from "@/lib/ticketeria/divulgacao";
import { todas } from "@/lib/ticketeria/modelo-servidor";
import { efeitoDaMarcacao, picoSemExplicacao, resumoPorVeiculo, veiculosConhecidos, type EfeitoDaMarcacao, type PicoSemExplicacao } from "@/lib/ticketeria/imprensa";

type Admin = SupabaseClient<Database>;

export type MarcacaoDeImprensa = { id: string; veiculo: string; assunto: string; dia: string; eventoId: string | null; evento: string | null; efeito: EfeitoDaMarcacao };
export type ImprensaDaLoja = {
  marcacoes: MarcacaoDeImprensa[];
  veiculos: ReturnType<typeof resumoPorVeiculo>;
  /** Os veículos já marcados, para o campo de registrar reconhecer o mesmo veículo. */ conhecidos: { nome: string; vezes: number }[];
  pico: PicoSemExplicacao | null;
};

/** A imprensa da loja: cada crítica ou matéria marcada com o que as vendas mostraram, o resumo por veículo e o pico de venda sem explicação. Lido com a chave de serviço. */
export async function imprensaDaLoja(admin: Admin, lojaId: string, hoje: string = diaNoFuso(new Date())): Promise<ImprensaDaLoja> {
  const t = clienteDaTicketeria(admin);
  const [{ data: acoes }, { data: eventos }, { data: descartados }, gastoDiario, pagos] = await Promise.all([
    t.from("ticketeria_acoes_divulgacao").select("id, nome, canal, inicio, evento_id, veiculo").eq("loja_id", lojaId).eq("canal", CANAL_DA_IMPRENSA).order("inicio", { ascending: false }),
    t.from("ticketeria_eventos").select("id, titulo").eq("loja_id", lojaId),
    t.from("ticketeria_picos_descartados").select("evento_id, dia").eq("loja_id", lojaId),
    todas(async (de, ate) => t.from("ticketeria_midia_diaria").select("dia, gasto_centavos").eq("loja_id", lojaId).order("dia", { ascending: true }).range(de, ate)),
    todas(async (de, ate) => t.from("ticketeria_pedidos").select("id, sessao_id, pago_em").eq("loja_id", lojaId).eq("situacao", "pago").order("created_at", { ascending: true }).range(de, ate)),
  ]);
  const titulo = new Map((eventos ?? []).map(e => [e.id, e.titulo]));
  const gasto = new Map<string, number>();
  for (const g of gastoDiario) gasto.set(g.dia, (gasto.get(g.dia) ?? 0) + Number(g.gasto_centavos));
  // As vendas por dia de cada evento e da casa toda.
  const idsDosEventos = [...titulo.keys()];
  const { data: sessoes } = idsDosEventos.length > 0 ? await t.from("ticketeria_sessoes").select("id, evento_id").in("evento_id", idsDosEventos) : { data: [] };
  const eventoDaSessao = new Map((sessoes ?? []).map(s => [s.id, s.evento_id]));
  const porEvento = new Map<string, Map<string, number>>();
  const daCasa = new Map<string, number>();
  const comPagamento = pagos.filter(p => p.pago_em);
  const porPedido = new Map(comPagamento.map(p => [p.id, p]));
  for (let i = 0; i < comPagamento.length; i += 150) {
    const { data: itens } = await t.from("ticketeria_pedido_itens").select("pedido_id, quantidade").in("pedido_id", comPagamento.slice(i, i + 150).map(p => p.id));
    for (const it of itens ?? []) {
      const p = porPedido.get(it.pedido_id);
      if (!p?.pago_em) continue;
      const dia = diaNoFuso(p.pago_em);
      daCasa.set(dia, (daCasa.get(dia) ?? 0) + it.quantidade);
      const evento = p.sessao_id ? eventoDaSessao.get(p.sessao_id) : undefined;
      if (!evento) continue;
      const m = porEvento.get(evento) ?? new Map<string, number>();
      m.set(dia, (m.get(dia) ?? 0) + it.quantidade);
      porEvento.set(evento, m);
    }
  }
  const marcacoes: MarcacaoDeImprensa[] = (acoes ?? []).map(a => {
    const veiculo = a.veiculo ?? a.nome;
    return { id: a.id, veiculo, assunto: assuntoDoNome(a.nome, a.veiculo), dia: a.inicio, eventoId: a.evento_id, evento: a.evento_id ? titulo.get(a.evento_id) ?? null : null,
      efeito: efeitoDaMarcacao(a.inicio, a.evento_id ? porEvento.get(a.evento_id) ?? new Map() : daCasa, gasto, hoje) };
  });
  const pico = picoSemExplicacao(
    [...porEvento].map(([eventoId, vendas]) => ({ eventoId, evento: titulo.get(eventoId) ?? "O evento", vendas })),
    gasto, marcacoes.map(m => ({ dia: m.dia, eventoId: m.eventoId })), new Set((descartados ?? []).map(d => `${d.evento_id ?? ""}|${d.dia}`)), hoje,
  );
  return { marcacoes, veiculos: resumoPorVeiculo(marcacoes), conhecidos: veiculosConhecidos((acoes ?? []).map(a => ({ canal: a.canal, veiculo: a.veiculo }))), pico };
}

/** "Não foi imprensa": o pico deste evento neste dia não volta. */
export async function descartarPico(admin: Admin, lojaId: string, organizationId: string, eventoId: string | null, dia: string): Promise<void> {
  const t = clienteDaTicketeria(admin);
  const { error } = await t.from("ticketeria_picos_descartados").insert({ organization_id: organizationId, loja_id: lojaId, evento_id: eventoId, dia });
  if (error && error.code !== "23505") throw new Error(error.message);
}
