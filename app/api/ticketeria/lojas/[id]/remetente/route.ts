// /api/ticketeria/lojas/{id}/remetente: o remetente de e-mail da loja (o domínio do produtor, de onde sai a divulgação). Quem pede precisa EDITAR a Ticketeria da organização.
//
//   GET → { remetente }   assinatura, domínio, registros de DNS, cota do mês (sem os ids do Stripe e do Resend)
//   PUT { dominio, endereco_local?, nome_exibicao, responder_para? }
//        → 200 { remetente }  cria o domínio no provedor na primeira vez (ou ao trocar de domínio) e devolve os registros que o produtor tem de criar no DNS dele;
//        400 dados_invalidos { problemas } | 402 email_nao_ativo (sem assinatura) | 409 dominio_em_uso | 503 provedor_indisponivel | 502 provedor_falhou
//
// O e-mail só passa a sair depois que o domínio é verificado (POST …/verificar) e com a assinatura ativa.

import type { NextRequest } from "next/server";
import { criarDominio, dominiosConfigurados, removerDominio } from "@/lib/email/resend-dominios";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { lerRemetente } from "@/lib/ticketeria/remetente";
import { emailsDoPeriodo, remetenteDaLoja, remetenteParaATela } from "@/lib/ticketeria/remetente-servidor";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";
const TAMANHO_MAXIMO = 4 * 1024;

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "remetente", max: 60 });
  if (a.erro) return a.erro;
  try {
    const admin = createAdminClient();
    const r = await remetenteDaLoja(admin, a.loja.id);
    return resposta({ remetente: remetenteParaATela(r, r ? await emailsDoPeriodo(admin, a.loja.id, r) : 0) });
  } catch (erro) {
    console.error("[ticketeria] remetente da loja:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}

export async function PUT(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "remetente-salvar", max: 20 });
  if (a.erro) return a.erro;
  const texto = await req.text();
  if (new TextEncoder().encode(texto).length > TAMANHO_MAXIMO) return resposta({ error: "corpo_grande_demais" }, 413);
  let bruto: unknown;
  try { bruto = JSON.parse(texto); } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const leitura = lerRemetente(bruto);
  if (!leitura.ok) return resposta({ error: "dados_invalidos", problemas: leitura.problemas }, 400);
  const novo = leitura.remetente;
  try {
    const admin = createAdminClient();
    const atual = await remetenteDaLoja(admin, a.loja.id);
    // O domínio é por assinatura: sem ela ativa o produtor ainda não chegou nesta etapa.
    if (!atual || atual.assinatura !== "ativa") return resposta({ error: "email_nao_ativo", motivo: "sem_assinatura" }, 402);
    const t = clienteDaTicketeria(admin);
    const campos = { endereco_local: novo.endereco_local, nome_exibicao: novo.nome_exibicao, responder_para: novo.responder_para, updated_at: new Date().toISOString() };
    if (atual.dominio !== novo.dominio || !atual.resend_domain_id) {
      if (!dominiosConfigurados()) return resposta({ error: "provedor_indisponivel" }, 503);
      const criado = await criarDominio(novo.dominio);
      if (!criado.ok) {
        if (criado.semChave) return resposta({ error: "provedor_indisponivel" }, 503);
        if (criado.jaExiste) return resposta({ error: "dominio_em_uso" }, 409);
        console.error("[ticketeria] criar domínio:", criado.erro);
        return resposta({ error: "provedor_falhou" }, 502);
      }
      const { error } = await t.from("ticketeria_remetentes").update({
        ...campos, dominio: novo.dominio, resend_domain_id: criado.dominio.id, situacao: criado.dominio.situacao, registros: criado.dominio.registros as unknown as Json, verificado_em: null,
      }).eq("loja_id", a.loja.id);
      if (error) {
        await removerDominio(criado.dominio.id);
        return resposta({ error: error.code === "23505" ? "dominio_em_uso" : "falha_ao_salvar" }, error.code === "23505" ? 409 : 500);
      }
      if (atual.resend_domain_id) await removerDominio(atual.resend_domain_id);
    } else {
      const { error } = await t.from("ticketeria_remetentes").update(campos).eq("loja_id", a.loja.id);
      if (error) return resposta({ error: "falha_ao_salvar" }, 500);
    }
    const r = await remetenteDaLoja(admin, a.loja.id);
    return resposta({ remetente: remetenteParaATela(r, r ? await emailsDoPeriodo(admin, a.loja.id, r) : 0) });
  } catch (erro) {
    console.error("[ticketeria] salvar remetente:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_salvar" }, 500);
  }
}
