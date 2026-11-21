import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { enderecoDeCompraDoEnvio, enderecoDoWhatsapp, mensagemDeWhatsapp, type PessoaDoWhatsapp } from "@/lib/ticketeria/envios";
import { entradaDoPublico } from "@/lib/ticketeria/publico-servidor";
import { montarPublico, recebeNovidades } from "@/lib/ticketeria/publico";

type Admin = SupabaseClient<Database>;

/** As pessoas de um envio por WhatsApp, cada uma com o link que abre a conversa (a mensagem já escrita, o link de compra marcado e o link para sair da lista). Só entra quem ainda aceita novidades e tem WhatsApp: quem saiu da lista depois de o envio ser preparado some daqui. */
export async function pessoasDoEnvioPorWhatsapp(admin: Admin, lojaId: string, envioId: string, origem: string): Promise<{ envio: { id: string; assunto: string; destinatarios: number; enviados: number }; pessoas: PessoaDoWhatsapp[] } | null> {
  const t = clienteDaTicketeria(admin);
  const { data: envio } = await t.from("ticketeria_envios").select("id, assunto, mensagem, sessao_id, acao, canal, destinatarios, enviados").eq("id", envioId).eq("loja_id", lojaId).maybeSingle();
  if (!envio || envio.canal !== "whatsapp" || !envio.sessao_id || !envio.acao) return null;
  const { data: loja } = await t.from("ticketeria_lojas").select("nome").eq("id", lojaId).maybeSingle();
  const { data: linhas } = await t.from("ticketeria_envio_destinatarios").select("id, email, nome, token, situacao").eq("envio_id", envioId).order("nome", { ascending: true });
  const contatos = new Map(montarPublico(await entradaDoPublico(admin, lojaId)).contatos.filter(recebeNovidades).map(c => [c.email, c]));
  const pessoas: PessoaDoWhatsapp[] = [];
  for (const l of linhas ?? []) {
    const c = contatos.get(l.email);
    if (!c?.whatsapp) continue;
    const texto = mensagemDeWhatsapp({ loja: loja?.nome ?? "o organizador", nome: l.nome, mensagem: envio.mensagem, enderecoDeCompra: enderecoDeCompraDoEnvio(origem, envio.sessao_id, envio.acao, "whatsapp"), enderecoParaSair: `${origem}/novidades/${l.token}` });
    pessoas.push({ id: l.id, nome: l.nome, whatsapp: c.whatsapp, link: enderecoDoWhatsapp(c.whatsapp, texto), enviada: l.situacao === "enviado" });
  }
  return { envio: { id: envio.id, assunto: envio.assunto, destinatarios: envio.destinatarios, enviados: envio.enviados }, pessoas };
}

/** Marca uma pessoa como "enviada" (o produtor abriu a conversa) e atualiza a contagem do envio; quando todas estão marcadas, o envio fica "enviado". */
export async function marcarEnviadaPorWhatsapp(admin: Admin, lojaId: string, envioId: string, destinatarioId: string): Promise<boolean> {
  const t = clienteDaTicketeria(admin);
  const { data: envio } = await t.from("ticketeria_envios").select("id, canal, destinatarios").eq("id", envioId).eq("loja_id", lojaId).maybeSingle();
  if (!envio || envio.canal !== "whatsapp") return false;
  const { data: marcada, error } = await t.from("ticketeria_envio_destinatarios").update({ situacao: "enviado", enviado_em: new Date().toISOString() }).eq("id", destinatarioId).eq("envio_id", envioId).select("id");
  if (error) throw new Error(error.message);
  if ((marcada ?? []).length === 0) return false;
  const { count } = await t.from("ticketeria_envio_destinatarios").select("id", { count: "exact", head: true }).eq("envio_id", envioId).eq("situacao", "enviado");
  const enviados = count ?? 0;
  await t.from("ticketeria_envios").update({ enviados, situacao: enviados >= envio.destinatarios ? "enviado" : "enviando", ...(enviados >= envio.destinatarios ? { enviado_em: new Date().toISOString() } : {}) }).eq("id", envioId);
  return true;
}
