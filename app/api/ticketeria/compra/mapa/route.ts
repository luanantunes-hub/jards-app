// GET /api/ticketeria/compra/mapa?sessao={id}&ingresso={id}[&acessivel=1]: o mapa de lugares de um ingresso de setor numerado numa sessão, para quem compra (sem login).
//
//   → 200 { setor, corredor, fileiras: [{ nome, assentos: [{ numero, estado: "livre" | "ocupado", tipo? }] }], layout? }   (o lugar bloqueado aparece como ocupado; `tipo` só quando não é comum;
//           `layout` só quando o setor tem um layout que se desenha: formato e limites conferidos aqui, e a tela confere de novo)
//   → 404 { error: "sem_mapa" }   (o ingresso não é de setor numerado, ou a sessão ou o ingresso não estão à venda)
//
// A tela lê de novo a cada vez que abre o mapa, para mostrar o que acabou de ser escolhido por outras pessoas. O limite por IP está no proxy.ts.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { lerMapaDaSessao } from "@/lib/ticketeria/mapa";
import { lerSalaDoMapa } from "@/lib/ticketeria/mapa-sala";
import { marcarReservados } from "@/lib/ticketeria/mapa-reserva";
import { lerLayout } from "@/lib/ticketeria/mapa-layout";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const resposta = (corpo: object, status: number) => NextResponse.json(corpo, { status, headers: { "cache-control": "no-store" } });

export async function GET(req: NextRequest) {
  const sessao = (req.nextUrl.searchParams.get("sessao") ?? "").trim().toLowerCase();
  const ingresso = (req.nextUrl.searchParams.get("ingresso") ?? "").trim().toLowerCase();
  if (!UUID.test(sessao) || !UUID.test(ingresso)) return resposta({ error: "dados_invalidos" }, 400);
  const { data, error } = await clienteDaTicketeria(createAdminClient()).rpc("fn_ticketeria_mapa_da_sessao", { p_sessao: sessao, p_ingresso: ingresso });
  if (error) {
    console.error("[ticketeria] mapa da sessão:", error.message);
    return resposta({ error: "falha" }, 500);
  }
  const mapa = lerMapaDaSessao(data);
  if (!mapa) return resposta({ error: "sem_mapa" }, 404);
  // Os lugares reservados de acessibilidade (art. 23-A): sem a declaração (`acessivel=1`) e com a reserva do setor ainda de pé, aparecem como `reservado`. A conferência de verdade é do banco ao reservar.
  const declarou = req.nextUrl.searchParams.get("acessivel") === "1";
  const temReservado = mapa.fileiras.some(f => f.assentos.some(a => a.tipo === "cadeira_rodas" || a.tipo === "mobilidade_reduzida" || a.tipo === "obeso"));
  let fileiras = mapa.fileiras;
  if (temReservado && !declarou) {
    const ticketeria = clienteDaTicketeria(createAdminClient());
    const { data: ing } = await ticketeria.from("ticketeria_ingressos").select("setor_id").eq("id", ingresso).maybeSingle();
    const { data: reserva } = ing ? await ticketeria.rpc("fn_ticketeria_reserva_do_setor", { p_sessao: sessao, p_setor: ing.setor_id }) : { data: null };
    const liberada = !!reserva && typeof reserva === "object" && !Array.isArray(reserva) && (reserva as { liberada?: unknown }).liberada === true;
    fileiras = marcarReservados(mapa.fileiras, { declarou: false, liberada });
  }
  const { layout: bruto, sala: salaBruta, ...resto } = { ...mapa, fileiras };
  const layout = lerLayout(bruto);
  // O mapa da sala só segue se se entende (planta e setores desenhados); o navegador o confere de novo antes de desenhar.
  const sala = lerSalaDoMapa(salaBruta);
  return resposta({ ...resto, ...(layout ? { layout } : {}), ...(sala ? { sala } : {}) }, 200);
}
