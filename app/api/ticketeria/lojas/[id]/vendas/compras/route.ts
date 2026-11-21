// GET /api/ticketeria/lojas/{id}/vendas/compras?pagina=0&filtro=todas|pagas|aguardando: uma página da lista de compras (30 por vez, da mais recente), com o filtro aplicado
// no banco. Com ?id=<pedido> devolve só essa compra (a busca do topo leva a ela, esteja em que página estiver). Quem pede precisa EDITAR a Ticketeria da organização
// (a mesma regra da lista de vendas: dado pessoal e dinheiro). Só leitura.

import { type NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { createAdminClient } from "@/lib/supabase/admin";
import { comprasDaLoja, type FiltroDeCompras } from "@/lib/ticketeria/vendas-servidor";

export const dynamic = "force-dynamic";

const FILTROS: readonly FiltroDeCompras[] = ["todas", "pagas", "aguardando"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "vendas-compras", max: 90 });
  if (a.erro) return a.erro;
  const busca = req.nextUrl.searchParams;
  const filtro = (busca.get("filtro") ?? "todas") as FiltroDeCompras;
  const pagina = Number(busca.get("pagina") ?? "0");
  const id = busca.get("id") ?? undefined;
  if (!FILTROS.includes(filtro) || !Number.isInteger(pagina) || pagina < 0 || pagina > 10000 || (id !== undefined && !UUID.test(id))) return resposta({ error: "pedido_invalido" }, 400);
  try {
    return resposta(await comprasDaLoja(createAdminClient(), a.loja.id, { pagina, filtro, id }));
  } catch (erro) {
    console.error("[ticketeria] compras da loja:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}
