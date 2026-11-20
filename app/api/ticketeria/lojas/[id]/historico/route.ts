// /api/ticketeria/lojas/{id}/historico: o histórico importado de planilha (vendas e gastos de eventos antigos).
//   GET  → { importacoes: [...], semanas: { vendas, gasto } }
//   POST { tipo: "vendas" | "gasto", arquivo, linhas: [{ dia, canal, ingressos, valor_centavos } | { dia, canal, gasto_centavos }] } → { id }
//        O navegador já leu e somou o arquivo: aqui só chegam totais por dia e canal. O corpo é conferido de novo (nada que chega é confiável) e gravado de uma vez, ou nada.
// Quem pede precisa EDITAR a Ticketeria da organização.

import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { lerCorpoDaImportacao } from "@/lib/ticketeria/historico";
import { historicoDaLoja } from "@/lib/ticketeria/historico-servidor";
import type { Json } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const TAMANHO_MAXIMO = 3 * 1024 * 1024;

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "historico", max: 60 });
  if (a.erro) return a.erro;
  try {
    return resposta(await historicoDaLoja(createAdminClient(), a.loja.id));
  } catch (erro) {
    console.error("[ticketeria] histórico da loja:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "historico-importar", max: 8 });
  if (a.erro) return a.erro;
  const texto = await req.text();
  if (new TextEncoder().encode(texto).length > TAMANHO_MAXIMO) return resposta({ error: "corpo_grande_demais" }, 413);
  let bruto: unknown;
  try { bruto = JSON.parse(texto); } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const leitura = lerCorpoDaImportacao(bruto);
  if (!leitura.ok) return resposta({ error: "dados_invalidos", problema: leitura.problema }, 400);
  const { data, error } = await clienteDaTicketeria(createAdminClient()).rpc("fn_ticketeria_historico_importar", { p_loja: a.loja.id, p_tipo: leitura.corpo.tipo, p_arquivo: leitura.corpo.arquivo, p_linhas: leitura.corpo.linhas as unknown as Json });
  if (error) {
    console.error("[ticketeria] importar histórico:", error.message);
    return resposta({ error: "falha_ao_gravar" }, 500);
  }
  return resposta({ id: data }, 201);
}
