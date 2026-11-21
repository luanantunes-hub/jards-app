import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { enviarEmailDeDivulgacao, enviarLoteDeDivulgacao } from "@/lib/email/divulgacao";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { processarFila, vendasPorAcao, type PedidoDoEnvio, type PortasDaFila, type PortasDoEnvio, type ResultadoDaRodada } from "@/lib/ticketeria/envios";
import { diaCurtoEHora } from "@/lib/ticketeria/vendas";

type Admin = SupabaseClient<Database>;
const PAGINA = 1000;

/** A porta de criar um envio no Supabase (com a chave de serviço): grava o envio e as pessoas, todas "pendente", cada uma com o seu token do link de sair da lista. */
export function portasDoEnvioDoSupabase(admin: Admin, d: { organizationId: string; lojaId: string; usuarioId: string | null }): PortasDoEnvio {
  const t = clienteDaTicketeria(admin);
  return {
    async criar(dados) {
      const { data: envio, error } = await t.from("ticketeria_envios").insert({
        organization_id: d.organizationId, loja_id: d.lojaId, canal: dados.canal, assunto: dados.assunto, mensagem: dados.mensagem, sessao_id: dados.sessao_id, acao: dados.acao,
        segmento: dados.segmento, destinatarios: dados.destinatarios.length, created_by: d.usuarioId,
      }).select("id").single();
      if (error || !envio) throw new Error(error?.message ?? "não foi possível criar o envio");
      const criados: { id: string; email: string; nome: string; token: string }[] = [];
      for (let i = 0; i < dados.destinatarios.length; i += 200) {
        const { data, error: erroDasPessoas } = await t.from("ticketeria_envio_destinatarios")
          .insert(dados.destinatarios.slice(i, i + 200).map(p => ({ organization_id: d.organizationId, envio_id: envio.id, email: p.email, nome: p.nome.slice(0, 120) }))).select("id, email, nome, token");
        if (erroDasPessoas) throw new Error(erroDasPessoas.message);
        criados.push(...(data ?? []));
      }
      return { envio: envio.id, destinatarios: criados };
    },
  };
}

const rpc = async <T>(chamada: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T | null> => {
  const { data, error } = await chamada;
  if (error) throw new Error(error.message);
  return data;
};

/** As portas da fila de UM envio por e-mail: o banco reivindica e marca (duas rodadas nunca pegam a mesma pessoa) e o Resend manda em lotes de 100. */
export function portasDaFilaDoSupabase(admin: Admin, envioId: string, enderecoDoCliqueUnico: (token: string) => string, registrarErro?: (erro: unknown) => void): PortasDaFila {
  const t = clienteDaTicketeria(admin);
  return {
    async reivindicar(n) {
      const linhas = await rpc(t.rpc("fn_ticketeria_reivindicar_destinatarios", { p_envio: envioId, p_n: n }));
      return (linhas ?? []).map(l => ({ id: l.id, email: l.email, nome: l.nome, token: l.token }));
    },
    async enviarLote(emails, chave) {
      const r = await enviarLoteDeDivulgacao(emails.map(e => ({ to: e.para, subject: e.assunto, html: e.html, text: e.texto, enderecoDoCliqueUnico: enderecoDoCliqueUnico(e.token), idempotencyKey: chave })), chave);
      if (!r.ok) registrarErro?.(new Error(`lote recusado: ${r.erro}`));
      return r.ok ? { ok: true, ids: r.ids } : { ok: false };
    },
    async enviarUm(e, chave) {
      const r = await enviarEmailDeDivulgacao({ to: e.para, subject: e.assunto, html: e.html, text: e.texto, enderecoDoCliqueUnico: enderecoDoCliqueUnico(e.token), idempotencyKey: chave });
      return r.ok ? { ok: true, id: r.id } : { ok: false };
    },
    async marcar(marcas) {
      for (let i = 0; i < marcas.length; i += 200) await rpc(t.rpc("fn_ticketeria_marcar_destinatarios", { p_itens: marcas.slice(i, i + 200).map(m => ({ id: m.id, ok: m.ok, provedor_id: m.provedorId ?? null })) }));
    },
    async atualizar() { return Number((await rpc(t.rpc("fn_ticketeria_atualizar_envio", { p_envio: envioId }))) ?? 0); },
    agora: () => Date.now(),
    registrarErro,
  };
}

/** Roda a fila de um envio por e-mail: carrega o que ele diz (assunto, mensagem, sessão e ação do link, nome da loja) e manda o que estiver pendente, por até `orcamentoMs`. */
export async function processarEnvioDeEmail(admin: Admin, envioId: string, origem: string, orcamentoMs?: number): Promise<ResultadoDaRodada | null> {
  const t = clienteDaTicketeria(admin);
  const { data: envio } = await t.from("ticketeria_envios").select("id, loja_id, assunto, mensagem, sessao_id, acao, canal, situacao").eq("id", envioId).maybeSingle();
  if (!envio || envio.canal !== "email" || envio.situacao !== "enviando" || !envio.sessao_id || !envio.acao) return null;
  const { data: loja } = await t.from("ticketeria_lojas").select("nome").eq("id", envio.loja_id).maybeSingle();
  const registrarErro = (erro: unknown) => console.error("[ticketeria] fila do envio:", erro instanceof Error ? erro.message : erro);
  return processarFila(
    { loja: loja?.nome ?? "o organizador", origem, assunto: envio.assunto, mensagem: envio.mensagem, sessao_id: envio.sessao_id, acao: envio.acao, enderecoParaSair: token => `${origem}/novidades/${token}`, orcamentoMs },
    portasDaFilaDoSupabase(admin, envio.id, token => `${origem}/api/ticketeria/novidades/sair?token=${token}`, registrarErro),
  );
}

export type EnvioDaLista = { id: string; assunto: string; canal: string; quando: string; destinatarios: number; enviados: number; falhas: number; abertos: number; cliques: number; devolvidos: number; situacao: string; ingressos: number; vendido_centavos: number };
export type SessaoParaEnviar = { id: string; evento: string; quando: string };

/** Os envios da loja com o resultado em vendas (as compras pagas que voltaram pelo link do envio), e as sessões à venda para escolher. */
export async function enviosDaLoja(admin: Admin, lojaId: string, agora: number = Date.now()): Promise<{ envios: EnvioDaLista[]; sessoes: SessaoParaEnviar[] }> {
  const t = clienteDaTicketeria(admin);
  const { data: envios, error } = await t.from("ticketeria_envios").select("id, assunto, canal, acao, destinatarios, enviados, falhas, abertos, cliques, devolvidos, situacao, created_at, enviado_em").eq("loja_id", lojaId).order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  const pedidos: PedidoDoEnvio[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error: erroDosPedidos } = await t.from("ticketeria_pedidos").select("id, total_centavos, origem_acao").eq("loja_id", lojaId).eq("situacao", "pago").in("origem_canal", ["email", "whatsapp"]).not("origem_acao", "is", null).order("created_at", { ascending: true }).range(de, de + PAGINA - 1);
    if (erroDosPedidos) throw new Error(erroDosPedidos.message);
    pedidos.push(...(data ?? []).map(p => ({ id: p.id, total_centavos: Number(p.total_centavos), origem_acao: p.origem_acao })));
    if ((data ?? []).length < PAGINA) break;
  }
  const quantidade: Record<string, number> = {};
  for (let i = 0; i < pedidos.length; i += 150) {
    const { data } = await t.from("ticketeria_pedido_itens").select("pedido_id, quantidade").in("pedido_id", pedidos.slice(i, i + 150).map(p => p.id));
    for (const it of data ?? []) quantidade[it.pedido_id] = (quantidade[it.pedido_id] ?? 0) + it.quantidade;
  }
  const vendas = vendasPorAcao(pedidos, quantidade);
  const [{ data: eventos }, { data: locais }] = await Promise.all([t.from("ticketeria_eventos").select("id, titulo").eq("loja_id", lojaId), t.from("ticketeria_locais").select("id, fuso").eq("loja_id", lojaId)]);
  const ids = (eventos ?? []).map(e => e.id);
  const { data: sessoes } = ids.length > 0 ? await t.from("ticketeria_sessoes").select("id, evento_id, local_id, inicio, cancelada_em").in("evento_id", ids).order("inicio", { ascending: true }) : { data: [] };
  const titulo = new Map((eventos ?? []).map(e => [e.id, e.titulo]));
  const fuso = new Map((locais ?? []).map(l => [l.id, l.fuso]));
  return {
    envios: (envios ?? []).map(e => ({
      id: e.id, assunto: e.assunto, canal: e.canal, quando: e.enviado_em ?? e.created_at, destinatarios: e.destinatarios, enviados: e.enviados, falhas: e.falhas, abertos: e.abertos, cliques: e.cliques, devolvidos: e.devolvidos, situacao: e.situacao,
      ingressos: e.acao ? vendas[e.acao]?.ingressos ?? 0 : 0, vendido_centavos: e.acao ? vendas[e.acao]?.vendido_centavos ?? 0 : 0,
    })),
    sessoes: (sessoes ?? []).filter(s => !s.cancelada_em && Date.parse(s.inicio) > agora).map(s => ({ id: s.id, evento: titulo.get(s.evento_id) ?? "Evento", quando: diaCurtoEHora(s.inicio, fuso.get(s.local_id)) })),
  };
}
