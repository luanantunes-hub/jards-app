// POST /api/ticketeria/lojas/{id}/publico/importar: o produtor importa contatos de uma planilha para o Público. Quem pede precisa EDITAR a Ticketeria da organização.
//
//   { arquivo, declaro, contatos: [{ nome, email, whatsapp }] }   (até MAX_CONTATOS_POR_IMPORTACAO)
//   → 200 { recebidos, novos, ja_existiam, declarados }
//
// O arquivo é lido no navegador; aqui chegam só os contatos já conferidos, e tudo é conferido de novo. `declaro: true` grava a declaração do produtor (quem, quando e qual versão do texto):
// só assim o contato importado recebe divulgação. Sem ela entra como "sem aceite". Contato que já existia não perde a declaração anterior; quem saiu da lista continua fora.

import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { VERSAO_DA_DECLARACAO, lerCorpoDaImportacaoDeContatos } from "@/lib/ticketeria/contatos-importados";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";
const TAMANHO_MAXIMO = 1024 * 1024;
const LOTE = 500;

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "importar-contatos", max: 10 });
  if (a.erro) return a.erro;
  const texto = await req.text();
  if (new TextEncoder().encode(texto).length > TAMANHO_MAXIMO) return resposta({ error: "corpo_grande_demais" }, 413);
  let bruto: unknown;
  try { bruto = JSON.parse(texto); } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const leitura = lerCorpoDaImportacaoDeContatos(bruto);
  if (!leitura.ok) return resposta({ error: "dados_invalidos", problema: leitura.problema }, 400);
  const { corpo } = leitura;
  try {
    const t = clienteDaTicketeria(createAdminClient());
    const { data: loja } = await t.from("ticketeria_lojas").select("organization_id").eq("id", a.loja.id).maybeSingle();
    if (!loja) return resposta({ error: "loja_nao_encontrada" }, 404);
    const antes = await t.from("ticketeria_contatos_importados").select("id", { count: "exact", head: true }).eq("loja_id", a.loja.id);
    const agora = new Date().toISOString();
    for (let i = 0; i < corpo.contatos.length; i += LOTE) {
      const linhas = corpo.contatos.slice(i, i + LOTE).map(c => ({
        organization_id: loja.organization_id, loja_id: a.loja.id, email: c.email, nome: c.nome, whatsapp: c.whatsapp, arquivo: corpo.arquivo,
        // Só com a declaração desta importação as colunas da declaração entram: sem ela, a declaração de uma importação anterior fica como estava.
        ...(corpo.declaro ? { novidades_declaradas_em: agora, declarado_por: a.user.id, declaracao_versao: VERSAO_DA_DECLARACAO } : {}),
      }));
      const { error } = await t.from("ticketeria_contatos_importados").upsert(linhas, { onConflict: "loja_id,email" });
      if (error) throw new Error(error.message);
    }
    const depois = await t.from("ticketeria_contatos_importados").select("id", { count: "exact", head: true }).eq("loja_id", a.loja.id);
    const novos = Math.max(0, (depois.count ?? 0) - (antes.count ?? 0));
    return resposta({ recebidos: corpo.contatos.length, novos, ja_existiam: corpo.contatos.length - novos, declarados: corpo.declaro ? corpo.contatos.length : 0 }, 200);
  } catch (erro) {
    console.error("[ticketeria] importar contatos:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_importar" }, 500);
  }
}
