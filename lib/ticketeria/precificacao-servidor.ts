import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { diaNoFuso } from "@/lib/ticketeria/divulgacao";
import { loteDaVez, podeTerMeia } from "@/lib/ticketeria/catalogo";
import { todas } from "@/lib/ticketeria/modelo-servidor";
import { precoDoLoteNaSessao } from "@/lib/ticketeria/preco-da-sessao";
import { referenciaDePreco, sugestaoDePreco, type LinhaDoQuadro, type QuadroDoEvento } from "@/lib/ticketeria/precificacao";
import { acumuladoDaSessao, candidatosDoEvento, preverPorComparacao, type CurvaDoEvento } from "@/lib/ticketeria/ritmo-comparado";

type Admin = SupabaseClient<Database>;

const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);

/**
 * O quadro de precificação de um evento (plano da Ticketeria, seção 11, P1, só leitura): para cada sessão por vir E CADA SETOR dela com ingresso pago, o preço que vale (o do lote da vez, ou o próprio da sessão), a ocupação, a previsão
 * de lotação por comparação com as sessões passadas do mesmo produtor e a sugestão de direção. As vendas e as curvas saem das mesmas contas do ritmo do próximo evento (modelo-servidor.ts). Null se o
 * evento não é da loja. Lido com a chave de serviço; quem chama já conferiu que a pessoa edita a Ticketeria da loja.
 */
export async function quadroDoEvento(admin: Admin, lojaId: string, eventoId: string, agora: number = Date.now()): Promise<QuadroDoEvento | null> {
  const t = clienteDaTicketeria(admin);
  const { data: eventos } = await t.from("ticketeria_eventos").select("id, titulo").eq("loja_id", lojaId);
  if (!(eventos ?? []).some(e => e.id === eventoId)) return null;
  const idsDosEventos = (eventos ?? []).map(e => e.id);
  const { data: sessoesBrutas } = await t.from("ticketeria_sessoes").select("id, evento_id, local_id, sala_id, inicio, cancelada_em").in("evento_id", idsDosEventos);
  const validas = (sessoesBrutas ?? []).filter(s => !s.cancelada_em);
  const futuras = validas.filter(s => s.evento_id === eventoId && Date.parse(s.inicio) > agora).sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
  if (futuras.length === 0) return { linhas: [], referencia: null };

  // As vendas: pedidos pagos da loja e os itens de cada um. O quadro é POR SETOR (cada setor tem a sua demanda): cada item entra no setor do ingresso dele.
  const pagos = (await todas(async (de, ate) => t.from("ticketeria_pedidos").select("id, sessao_id, pago_em").eq("loja_id", lojaId).eq("situacao", "pago").order("created_at", { ascending: true }).range(de, ate))).filter(p => p.pago_em);
  const idsDasSessoes = new Set(validas.map(s => s.id));
  const dasSessoes = pagos.filter(p => idsDasSessoes.has(p.sessao_id));
  const { data: todosIngressos } = await t.from("ticketeria_ingressos").select("id, evento_id, setor_id, categoria, publico, arquivado, meia_de").in("evento_id", idsDosEventos);
  const setorDoIngresso = new Map((todosIngressos ?? []).map(i => [i.id, i.setor_id] as const));
  // Os itens, em blocos de 150 pedidos lidos ao mesmo tempo (um por vez demorava dezenas de segundos numa loja com milhares de pedidos).
  const blocos: string[][] = [];
  for (let i = 0; i < dasSessoes.length; i += 150) blocos.push(dasSessoes.slice(i, i + 150).map(p => p.id));
  const lidos = await Promise.all(blocos.map(async ids => (await t.from("ticketeria_pedido_itens").select("pedido_id, ingresso_id, quantidade, preco_centavos").in("pedido_id", ids)).data ?? []));
  const itensDoPedido = new Map<string, (typeof lidos)[number]>();
  for (const it of lidos.flat()) itensDoPedido.set(it.pedido_id, [...(itensDoPedido.get(it.pedido_id) ?? []), it]);

  // Os locais e os setores (cada setor com os seus lugares, na sala).
  const idsDosLocais = [...new Set(validas.map(s => s.local_id))];
  const [{ data: locais }, { data: setores }] = await Promise.all([
    t.from("ticketeria_locais").select("id, nome, fuso").in("id", idsDosLocais),
    t.from("ticketeria_setores").select("id, nome, sala_id, lugares").in("local_id", idsDosLocais).eq("arquivado", false),
  ]);
  const setoresDaSala = (salaId: string) => (setores ?? []).filter(x => x.sala_id === salaId).sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
  const doLocal = new Map((locais ?? []).map(l => [l.id, l]));
  const titulo = new Map((eventos ?? []).map(e => [e.id, e.titulo]));
  const sessaoPorId = new Map(validas.map(s => [s.id, s] as const));

  type Venda = { porDia: Record<string, number>; total: number; qtdPaga: number; valor: number };
  const vendas = new Map<string, Venda>();
  for (const p of dasSessoes) {
    const sessao = sessaoPorId.get(p.sessao_id);
    if (!sessao) continue;
    const dia = diaNoFuso(p.pago_em as string, doLocal.get(sessao.local_id)?.fuso ?? undefined);
    for (const it of itensDoPedido.get(p.id) ?? []) {
      const setorId = setorDoIngresso.get(it.ingresso_id);
      if (!setorId) continue;
      const chave = `${p.sessao_id}|${setorId}`;
      const v = vendas.get(chave) ?? { porDia: {}, total: 0, qtdPaga: 0, valor: 0 };
      v.total += it.quantidade;
      v.porDia[dia] = (v.porDia[dia] ?? 0) + it.quantidade;
      if (it.preco_centavos > 0) { v.qtdPaga += it.quantidade; v.valor += it.quantidade * it.preco_centavos; }
      vendas.set(chave, v);
    }
  }
  const vendasDoSetor = (sessao: (typeof validas)[number], setorId: string) => {
    const fuso = doLocal.get(sessao.local_id)?.fuso ?? undefined;
    const v = vendas.get(`${sessao.id}|${setorId}`) ?? { porDia: {}, total: 0, qtdPaga: 0, valor: 0 };
    return { fuso, porDia: v.porDia, total: v.total, precoMedioCentavos: v.qtdPaga > 0 ? Math.round(v.valor / v.qtdPaga) : 0, diaDaSessao: diaNoFuso(sessao.inicio, fuso) };
  };

  // As curvas das sessões que já aconteceram e venderam, setor por setor (a base da comparação: o mesmo setor do mesmo local).
  const curvas: CurvaDoEvento[] = [];
  for (const s of validas.filter(x => Date.parse(x.inicio) <= agora)) {
    for (const setor of setoresDaSala(s.sala_id)) {
      const v = vendasDoSetor(s, setor.id);
      if (v.total <= 0) continue;
      curvas.push({
        id: `${s.id}|${setor.id}`, nome: titulo.get(s.evento_id) ?? "Evento", quando: new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: v.fuso ?? "America/Sao_Paulo" }).format(new Date(s.inicio)).replace(" de ", "/").replace(".", ""),
        local: `${doLocal.get(s.local_id)?.nome ?? "Local"} · ${setor.nome}`, localId: setor.id, precoMedioCentavos: v.precoMedioCentavos, lugares: setor.lugares, acumulado: acumuladoDaSessao(v.diaDaSessao, v.porDia),
      });
    }
  }

  // Os preços: o lote da vez de cada ingresso pago do evento (que não é a meia), com o setor dele, e o preço próprio de cada sessão.
  const doPreco = (todosIngressos ?? []).filter(i => i.evento_id === eventoId && podeTerMeia(i.categoria) && i.publico && !i.arquivado && i.meia_de === null);
  const idsDosIngressos = doPreco.map(i => i.id);
  const { data: lotes } = idsDosIngressos.length > 0
    ? await t.from("ticketeria_lotes").select("id, ingresso_id, ordem, preco_centavos, espelho_de, vendas_inicio, vendas_fim").in("ingresso_id", idsDosIngressos)
    : { data: [] };
  const dasVez = doPreco.flatMap(i => { const l = loteDaVez((lotes ?? []).filter(x => x.ingresso_id === i.id), agora); return l !== null && l.preco_centavos > 0 ? [{ ...l, setorId: i.setor_id }] : []; });
  const { data: proprios } = dasVez.length > 0
    ? await t.from("ticketeria_precos_da_sessao").select("sessao_id, lote_id, preco_centavos").in("lote_id", dasVez.map(l => l.id))
    : { data: [] };

  const usados = new Map<string, CurvaDoEvento>();
  const linhas: LinhaDoQuadro[] = futuras.flatMap(s => setoresDaSala(s.sala_id).flatMap(setor => {
    const doSetor = dasVez.filter(l => l.setorId === setor.id);
    if (doSetor.length === 0) return []; // sem ingresso pago neste setor, não há preço para mover
    const v = vendasDoSetor(s, setor.id);
    const fuso = v.fuso ?? "America/Sao_Paulo";
    const precosDaSessao = new Map((proprios ?? []).filter(p => p.sessao_id === s.id).map(p => [p.lote_id, p.preco_centavos] as const));
    const candidatas = doSetor.map(l => ({ base: l.preco_centavos, vigente: precoDoLoteNaSessao(l, precosDaSessao), proprio: precosDaSessao.has(l.id) })).sort((a, b) => a.vigente - b.vigente);
    const menor = candidatas[0] ?? null;
    const precoMedioAtual = v.precoMedioCentavos > 0 ? v.precoMedioCentavos : (menor?.vigente ?? 0);
    const diasAteASessao = Math.max(0, diasEntre(diaNoFuso(new Date(agora), fuso), v.diaDaSessao));
    const chave = `${s.id}|${setor.id}`;
    const parecidos = candidatosDoEvento({ id: chave, localId: setor.id, precoMedioCentavos: precoMedioAtual }, curvas).filter(c => c.usado).map(c => c.curva);
    for (const c of parecidos) usados.set(c.id, c);
    const previsao = preverPorComparacao({ vendidos: v.total, lugares: setor.lugares, diasAteASessao, parecidos });
    return [{
      sessaoId: s.id, setorId: setor.id, setor: setor.nome, inicio: s.inicio, fuso, lugares: setor.lugares, vendidos: v.total, diasAteASessao,
      precoBaseCentavos: menor?.base ?? null, precoVigenteCentavos: menor?.vigente ?? null, precoProprio: menor?.proprio ?? false,
      previsaoPorcento: previsao?.porcento ?? null, faixaBaixo: previsao?.baixo ?? null, faixaAlto: previsao?.alto ?? null, parecidos: previsao?.n ?? 0, selo: previsao?.selo ?? null,
      sugestao: sugestaoDePreco({ vendidos: v.total, lugares: setor.lugares, previsao }),
    }];
  }));
  return { linhas, referencia: referenciaDePreco([...usados.values()]) };
}
