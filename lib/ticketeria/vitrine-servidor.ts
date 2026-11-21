import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { corDoTema } from "@/lib/ticketeria/site";
import { ROTULO_DA_CLASSIFICACAO } from "@/lib/ticketeria/eventos";
import { diaEHoraDoEvento } from "@/lib/ticketeria/pagamento/ingressos";
import { MAX_PARCELAS, PARCELAMENTO_LIBERADO } from "@/lib/ticketeria/pagamento/compra";
import { estadoDaVenda, faixasDoIngresso, limitarFaixas, type IngressoDaVitrine, type VitrineDaSessao } from "@/lib/ticketeria/vitrine";

type Admin = SupabaseClient<Database>;

/** O título e a cor do site da loja (o cabeçalho das telas de compra); sem site, o nome da loja e o grafite. */
export async function siteDaLoja(admin: Admin, lojaId: string): Promise<{ titulo: string; cor: string }> {
  const t = clienteDaTicketeria(admin);
  const [{ data: site }, { data: loja }] = await Promise.all([
    t.from("ticketeria_sites").select("titulo, nome, cor").eq("loja_id", lojaId).maybeSingle(),
    t.from("ticketeria_lojas").select("nome").eq("id", lojaId).maybeSingle(),
  ]);
  return { titulo: site?.titulo || site?.nome || loja?.nome || "Ingressos", cor: corDoTema(site?.cor) };
}

/** A vitrine de uma sessão para quem compra (sem login: o servidor lê com a chave de serviço e só devolve o que se pode mostrar). Nula se a sessão não existe. */
export async function vitrineDaSessao(admin: Admin, sessaoId: string, agora: number = Date.now()): Promise<VitrineDaSessao | null> {
  const t = clienteDaTicketeria(admin);
  const { data: sessao } = await t.from("ticketeria_sessoes").select("id, evento_id, local_id, inicio, cancelada_em").eq("id", sessaoId).maybeSingle();
  if (!sessao) return null;
  const [{ data: evento }, { data: local }] = await Promise.all([
    t.from("ticketeria_eventos").select("id, loja_id, titulo, descricao, classificacao, situacao").eq("id", sessao.evento_id).maybeSingle(),
    t.from("ticketeria_locais").select("nome, cidade, uf, fuso").eq("id", sessao.local_id).maybeSingle(),
  ]);
  if (!evento || !local) return null;
  const [site, { data: conta }, { data: lojaDoEvento }] = await Promise.all([siteDaLoja(admin, evento.loja_id), t.from("ticketeria_contas_asaas").select("situacao").eq("loja_id", evento.loja_id).maybeSingle(), t.from("ticketeria_lojas").select("parcelas_max").eq("id", evento.loja_id).maybeSingle()]);
  const estado = estadoDaVenda({ eventoPublicado: evento.situacao === "publicado", canceladaEm: sessao.cancelada_em, inicio: sessao.inicio, contaAprovada: conta?.situacao === "aprovada" }, agora);
  const quando = diaEHoraDoEvento(sessao.inicio, local.fuso);
  const vitrine: VitrineDaSessao = {
    estado, sessao_id: sessao.id, site, parcelas_max: Math.max(1, Math.min(lojaDoEvento?.parcelas_max ?? 1, PARCELAMENTO_LIBERADO ? MAX_PARCELAS : 1)),
    evento: {
      titulo: evento.titulo, descricao: evento.descricao, classificacao: evento.classificacao ? ROTULO_DA_CLASSIFICACAO[evento.classificacao] ?? null : null,
      quando: quando.charAt(0).toUpperCase() + quando.slice(1), local: [local.nome, [local.cidade, local.uf].filter(Boolean).join("/")].filter(Boolean).join(", "),
    },
    ingressos: [],
  };
  if (estado !== "aberta") return vitrine;

  const { data: setores } = await t.from("ticketeria_setores").select("id, nome, numerado, lugares").eq("local_id", sessao.local_id);
  const { data: ingressos } = await t.from("ticketeria_ingressos").select("id, nome, descricao, limite_por_pedido, setor_id, ordem, created_at")
    .eq("evento_id", evento.id).eq("publico", true).eq("arquivado", false).in("setor_id", (setores ?? []).map(s => s.id)).order("ordem").order("created_at");
  const ids = (ingressos ?? []).map(i => i.id);
  const { data: lotes } = ids.length > 0
    ? await t.from("ticketeria_lotes").select("id, ingresso_id, ordem, preco_centavos, quantidade, vendas_inicio, vendas_fim").in("ingresso_id", ids)
    : { data: [] };
  const ocupados = new Map<string, number>(await Promise.all((lotes ?? []).map(async l => {
    const { data } = await t.rpc("fn_ticketeria_ocupados", { p_sessao: sessao.id, p_lote: l.id, p_fora: null });
    return [l.id, Number(data ?? 0)] as const;
  })));
  // Num setor numerado o que se compra não passa dos lugares livres do mapa (os tipos de ingresso do setor dividem os mesmos lugares).
  const livresDoSetor = new Map<string, number>(await Promise.all((setores ?? []).filter(s => s.numerado).map(async s => {
    const { data } = await t.rpc("fn_ticketeria_lugares_livres_do_setor", { p_sessao: sessao.id, p_setor: s.id });
    return [s.id, Number(data ?? 0)] as const;
  })));
  // O setor é um balde só: o que se compra não passa dos lugares que restam dele (inteira, meia e os outros tipos somados).
  const baldeDoSetor = new Map<string, number>(await Promise.all((setores ?? []).map(async s => {
    const { data } = await t.rpc("fn_ticketeria_ocupados_do_setor", { p_sessao: sessao.id, p_setor: s.id, p_fora: null });
    const balde = Math.max(0, s.lugares - Number(data ?? 0));
    return [s.id, s.numerado ? Math.min(balde, livresDoSetor.get(s.id) ?? balde) : balde] as const;
  })));
  for (const i of ingressos ?? []) {
    if (!(lotes ?? []).some(l => l.ingresso_id === i.id)) continue; // sem nenhum lote, o ingresso ainda não tem o que vender
    let faixas = faixasDoIngresso((lotes ?? []).filter(l => l.ingresso_id === i.id).map(l => ({ ...l, ocupados: ocupados.get(l.id) ?? 0 })), agora);
    const setor = (setores ?? []).find(s => s.id === i.setor_id);
    if (setor) faixas = limitarFaixas(faixas, baldeDoSetor.get(setor.id) ?? 0);
    const doIngresso: IngressoDaVitrine = { id: i.id, nome: i.nome, descricao: i.descricao, limite: i.limite_por_pedido, faixas, ...(setor?.numerado ? { numerado: { setor: setor.nome } } : {}) };
    vitrine.ingressos.push(doIngresso);
  }
  return vitrine;
}
