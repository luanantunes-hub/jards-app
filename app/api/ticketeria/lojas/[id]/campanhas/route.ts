// /api/ticketeria/lojas/{id}/campanhas: as campanhas do Meta e do Google da loja e a marcação de cada uma (marca ou evento), para o modelo separar o gasto da marca. Quem pede precisa EDITAR a
// Ticketeria da organização.
//   GET → { campanhas: [{ id, nome, canal, gasto90dias, marcacao, eventoId, sugerida }], eventos: [{ id, titulo }] }
//   PUT { itens: [{ id, marcacao: "marca" | "evento" | null, evento_id? }] } → 200 { campanhas } | 400 dados_invalidos (campanha ou evento de outra loja, marcação torta)

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { campanhasDaLoja } from "@/lib/ticketeria/campanhas-servidor";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { diaNoFuso } from "@/lib/ticketeria/divulgacao";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ITENS = 500;

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "campanhas", max: 60 });
  if (a.erro) return a.erro;
  try {
    const admin = createAdminClient();
    const [campanhas, { data: eventos }] = await Promise.all([
      campanhasDaLoja(admin, a.loja.id, diaNoFuso(new Date())),
      clienteDaTicketeria(admin).from("ticketeria_eventos").select("id, titulo").eq("loja_id", a.loja.id).order("titulo", { ascending: true }),
    ]);
    return resposta({ campanhas, eventos: eventos ?? [] });
  } catch (erro) {
    console.error("[ticketeria] campanhas:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}

export async function PUT(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "campanhas-salvar", max: 20 });
  if (a.erro) return a.erro;
  const corpo = (await req.json().catch(() => null)) as { itens?: unknown } | null;
  if (!corpo || !Array.isArray(corpo.itens) || corpo.itens.length === 0 || corpo.itens.length > MAX_ITENS) return resposta({ error: "dados_invalidos" }, 400);
  const itens: { id: string; marcacao: "marca" | "evento" | null; evento_id: string | null }[] = [];
  for (const bruto of corpo.itens) {
    const o = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
    const id = typeof o.id === "string" && UUID.test(o.id) ? o.id : null;
    const marcacao = o.marcacao === "marca" || o.marcacao === "evento" ? o.marcacao : o.marcacao === null ? null : undefined;
    const evento = marcacao === "evento" && typeof o.evento_id === "string" && UUID.test(o.evento_id) ? o.evento_id : null;
    if (!id || marcacao === undefined || (marcacao === "evento" && !evento)) return resposta({ error: "dados_invalidos" }, 400);
    itens.push({ id, marcacao, evento_id: evento });
  }
  try {
    const admin = createAdminClient();
    const t = clienteDaTicketeria(admin);
    // Tudo tem de ser desta loja: as campanhas e os eventos escolhidos.
    const [{ data: daLoja }, { data: eventos }] = await Promise.all([
      t.from("ticketeria_campanhas").select("id").eq("loja_id", a.loja.id).in("id", itens.map(i => i.id)),
      t.from("ticketeria_eventos").select("id").eq("loja_id", a.loja.id),
    ]);
    const campanhas = new Set((daLoja ?? []).map(c => c.id));
    const idsDosEventos = new Set((eventos ?? []).map(e => e.id));
    if (itens.some(i => !campanhas.has(i.id) || (i.evento_id && !idsDosEventos.has(i.evento_id)))) return resposta({ error: "dados_invalidos" }, 400);
    for (const i of itens) {
      const { error } = await t.from("ticketeria_campanhas").update({ marcacao: i.marcacao, evento_id: i.evento_id, sugerida: false, updated_at: new Date().toISOString() }).eq("id", i.id).eq("loja_id", a.loja.id);
      if (error) throw new Error(error.message);
    }
    return resposta({ campanhas: await campanhasDaLoja(admin, a.loja.id, diaNoFuso(new Date())) });
  } catch (erro) {
    console.error("[ticketeria] salvar campanhas:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_salvar" }, 500);
  }
}
