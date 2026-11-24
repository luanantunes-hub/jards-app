// /api/ticketeria/lojas/{id}/preco-dinamico?evento={eventoId}: a adesão do evento ao preço dinâmico (plano da Ticketeria, seção 11, P2). Quem pede precisa EDITAR a Ticketeria da organização.
//
//   GET  → { liberado, regra, fatores }: se a plataforma liberou o recurso, a regra do evento (desligada se nunca aderiu) e o fator de cada sessão;
//   PUT  → liga ou desliga. Só com a plataforma liberando (TICKETERIA_PRECO_DINAMICO_LIBERADO=sim: o texto do aceite ainda é um rascunho para o advogado). Ligar exige `aceito: true` e grava o aceite.
//          Corpo: { ativo, aceito?, piso_pct, teto_pct, passo_pct, intervalo_minutos } (piso de -90 a 0, teto de 0 a 1000, passo de 1 a 50, intervalo de 30 a 1440).

import { type NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { LIMITES_DA_REGRA } from "@/lib/ticketeria/preco-dinamico";
import { adesaoDoEvento, definirAdesao, precoDinamicoLiberado } from "@/lib/ticketeria/preco-dinamico-servidor";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function eventoDaLoja(admin: ReturnType<typeof createAdminClient>, lojaId: string, eventoId: string): Promise<boolean> {
  const { data } = await clienteDaTicketeria(admin).from("ticketeria_eventos").select("id").eq("id", eventoId).eq("loja_id", lojaId).maybeSingle();
  return Boolean(data);
}

export async function GET(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "preco-dinamico", max: 60 });
  if (a.erro) return a.erro;
  const evento = req.nextUrl.searchParams.get("evento") ?? "";
  if (!UUID.test(evento)) return resposta({ error: "evento_invalido" }, 400);
  const admin = createAdminClient();
  if (!(await eventoDaLoja(admin, a.loja.id, evento))) return resposta({ error: "evento_nao_encontrado" }, 404);
  try {
    return resposta({ liberado: precoDinamicoLiberado(), ...(await adesaoDoEvento(admin, evento)) });
  } catch (erro) {
    console.error("[ticketeria] preço dinâmico (ler):", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}

const inteiroEntre = (v: unknown, min: number, max: number): number | null => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null);

export async function PUT(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "preco-dinamico-escrever", max: 20 });
  if (a.erro) return a.erro;
  if (!precoDinamicoLiberado()) return resposta({ error: "recurso_nao_liberado" }, 403);
  const evento = req.nextUrl.searchParams.get("evento") ?? "";
  if (!UUID.test(evento)) return resposta({ error: "evento_invalido" }, 400);
  let corpo: Record<string, unknown>;
  try { corpo = (await req.json()) as Record<string, unknown>; } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const ativo = corpo.ativo === true;
  if (ativo && corpo.aceito !== true) return resposta({ error: "aceite_obrigatorio" }, 400);
  const piso = inteiroEntre(corpo.piso_pct, LIMITES_DA_REGRA.piso.min / 100, LIMITES_DA_REGRA.piso.max / 100);
  const teto = inteiroEntre(corpo.teto_pct, LIMITES_DA_REGRA.teto.min / 100, LIMITES_DA_REGRA.teto.max / 100);
  const passo = inteiroEntre(corpo.passo_pct, LIMITES_DA_REGRA.passo.min / 100, LIMITES_DA_REGRA.passo.max / 100);
  const intervalo = inteiroEntre(corpo.intervalo_minutos, LIMITES_DA_REGRA.intervalo.min, LIMITES_DA_REGRA.intervalo.max);
  if (piso === null || teto === null || passo === null || intervalo === null) return resposta({ error: "regra_invalida" }, 400);
  const admin = createAdminClient();
  if (!(await eventoDaLoja(admin, a.loja.id, evento))) return resposta({ error: "evento_nao_encontrado" }, 404);
  try {
    await definirAdesao(admin, { eventoId: evento, ativo, regra: { pisoBps: piso * 100, tetoBps: teto * 100, passoBps: passo * 100, intervaloMinutos: intervalo }, usuarioId: a.user.id });
    return resposta({ liberado: true, ...(await adesaoDoEvento(admin, evento)) });
  } catch (erro) {
    console.error("[ticketeria] preço dinâmico (definir):", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_gravar" }, 500);
  }
}
