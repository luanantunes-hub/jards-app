// /api/ticketeria/lojas/{id}/envios: os envios de divulgação do Público, por e-mail ou por WhatsApp. Quem pede precisa EDITAR a Ticketeria da organização (tem e-mail de comprador).
//
//   GET  → { ligado, segmentos, segmentos_whatsapp, sessoes, envios }   (o envio está ligado quando o remetente próprio existe; os envios vêm com o resultado em vendas)
//   POST { canal?: "email" | "whatsapp", assunto, mensagem, sessao_id, segmento, teste? }
//        canal "whatsapp" → 201 { envio, pessoas } sem mandar nada: cria o envio e a lista, com o link que abre cada conversa (máx. LIMITE_DE_DESTINATARIOS_WHATSAPP; 409 sem_whatsapp);
//        teste: true → manda UM e-mail para quem pede, sem gravar nada;
//        senão       → 201 { envio, enviados, falhas }; 503 envio_desligado; 409 sem_destinatarios | envio_repetido | sessao_indisponivel; 413 destinatarios_demais
// Só recebe quem aceitou novidades e não saiu da lista. O limite é de LIMITE_DE_DESTINATARIOS pessoas por envio, por enquanto.

import { type NextRequest } from "next/server";
import { appUrl } from "@/lib/email/config";
import { divulgacaoConfigurada, enviarEmailDeDivulgacao } from "@/lib/email/divulgacao";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { acaoDoEnvio, destinatariosDoSegmento, emailDeDivulgacao, enderecoDeCompraDoEnvio, enviarDivulgacao, lerEnvio, limiteDoCanal, segmentosDoPublico } from "@/lib/ticketeria/envios";
import { pessoasDoEnvioPorWhatsapp } from "@/lib/ticketeria/envios-whatsapp-servidor";
import { enviosDaLoja, portasDoEnvioDoSupabase } from "@/lib/ticketeria/envios-servidor";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { entradaDoPublico } from "@/lib/ticketeria/publico-servidor";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const TAMANHO_MAXIMO = 16 * 1024;

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "envios", max: 30 });
  if (a.erro) return a.erro;
  try {
    const admin = createAdminClient();
    const [{ envios, sessoes }, entrada] = await Promise.all([enviosDaLoja(admin, a.loja.id), entradaDoPublico(admin, a.loja.id)]);
    return resposta({ ligado: divulgacaoConfigurada(), segmentos: segmentosDoPublico(entrada), segmentos_whatsapp: segmentosDoPublico(entrada, "whatsapp"), sessoes, envios });
  } catch (erro) {
    console.error("[ticketeria] envios da loja:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "envio", max: 10 });
  if (a.erro) return a.erro;
  const texto = await req.text();
  if (new TextEncoder().encode(texto).length > TAMANHO_MAXIMO) return resposta({ error: "corpo_grande_demais" }, 413);
  let bruto: unknown;
  try { bruto = JSON.parse(texto); } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const leitura = lerEnvio(bruto);
  if (!leitura.ok) return resposta({ error: "dados_invalidos", problemas: leitura.problemas }, 400);
  const { envio } = leitura;
  // O e-mail só sai com o remetente próprio configurado; o WhatsApp não manda nada (o produtor abre cada conversa), então não depende dele.
  if (envio.canal === "email" && !divulgacaoConfigurada()) return resposta({ error: "envio_desligado" }, 503);
  try {
    const admin = createAdminClient();
    const t = clienteDaTicketeria(admin);
    const [{ data: loja }, { data: sessao }] = await Promise.all([
      t.from("ticketeria_lojas").select("nome, organization_id").eq("id", a.loja.id).maybeSingle(),
      t.from("ticketeria_sessoes").select("evento_id, inicio, cancelada_em").eq("id", envio.sessao_id).maybeSingle(),
    ]);
    const { data: evento } = sessao ? await t.from("ticketeria_eventos").select("id").eq("id", sessao.evento_id).eq("loja_id", a.loja.id).maybeSingle() : { data: null };
    if (!loja || !sessao || !evento || sessao.cancelada_em || Date.parse(sessao.inicio) <= Date.now()) return resposta({ error: "sessao_indisponivel" }, 409);
    const origem = appUrl();
    const acao = acaoDoEnvio(envio.assunto, new Date(), envio.canal);

    if (envio.teste) {
      const email = a.user.email;
      if (!email) return resposta({ error: "sem_email_para_o_teste" }, 409);
      const e = emailDeDivulgacao({ loja: loja.nome, nome: email.split("@")[0], assunto: `[Teste] ${envio.assunto}`, mensagem: envio.mensagem, enderecoDeCompra: enderecoDeCompraDoEnvio(origem, envio.sessao_id, acao), enderecoParaSair: `${origem}/novidades/teste` });
      const r = await enviarEmailDeDivulgacao({ to: email, subject: e.assunto, html: e.html, text: e.texto, enderecoDoCliqueUnico: `${origem}/api/ticketeria/novidades/sair?token=teste`, idempotencyKey: `ticketeria-envio-teste-${a.user.id}-${Date.now()}` });
      return r.ok ? resposta({ teste: true }, 200) : resposta({ error: "teste_falhou" }, 502);
    }

    const entrada = await entradaDoPublico(admin, a.loja.id);
    const destinatarios = destinatariosDoSegmento(entrada, envio.segmento, envio.canal);
    if (destinatarios.length === 0) return resposta({ error: envio.canal === "whatsapp" ? "sem_whatsapp" : "sem_destinatarios" }, 409);
    const limite = limiteDoCanal(envio.canal);
    if (destinatarios.length > limite) return resposta({ error: "destinatarios_demais", total: destinatarios.length, limite }, 413);
    // O mesmo envio repetido em poucos minutos (duplo clique, aba reaberta): recusa.
    const desde = new Date(Date.now() - 2 * 60_000).toISOString();
    const { data: repetido } = await t.from("ticketeria_envios").select("id").eq("loja_id", a.loja.id).eq("assunto", envio.assunto).eq("segmento", envio.segmento).eq("canal", envio.canal).gte("created_at", desde).limit(1);
    if ((repetido ?? []).length > 0) return resposta({ error: "envio_repetido" }, 409);

    const portas = portasDoEnvioDoSupabase(admin, { organizationId: loja.organization_id, lojaId: a.loja.id, usuarioId: a.user.id, registrarErro: erro => console.error("[ticketeria] envio:", erro instanceof Error ? erro.message : erro) });
    if (envio.canal === "whatsapp") {
      // O WhatsApp só prepara o envio: cria o envio e as pessoas (cada uma com o seu link de sair da lista) e devolve a lista, com o link que abre cada conversa.
      const { envio: criado } = await portas.criar({ canal: "whatsapp", assunto: envio.assunto, mensagem: envio.mensagem, sessao_id: envio.sessao_id, acao, segmento: envio.segmento, destinatarios });
      const lista = await pessoasDoEnvioPorWhatsapp(admin, a.loja.id, criado, origem);
      return resposta({ envio: criado, pessoas: lista?.pessoas ?? [] }, 201);
    }
    const resultado = await enviarDivulgacao({ loja: loja.nome, origem, assunto: envio.assunto, mensagem: envio.mensagem, sessao_id: envio.sessao_id, segmento: envio.segmento, destinatarios, enderecoParaSair: token => `${origem}/novidades/${token}` }, portas);
    return resposta(resultado, 201);
  } catch (erro) {
    console.error("[ticketeria] envio falhou:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_no_envio" }, 500);
  }
}
