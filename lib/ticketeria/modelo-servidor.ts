import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { CANAL_DA_IMPRENSA, diaNoFuso } from "@/lib/ticketeria/divulgacao";
import { divulgacaoDaLoja } from "@/lib/ticketeria/divulgacao-servidor";
import { ritmoDoEvento, type RitmoDoEvento } from "@/lib/ticketeria/modelo-painel";
import { acumuladoDaSessao, type CurvaDoEvento } from "@/lib/ticketeria/ritmo-comparado";
import { gastoDaMarca } from "@/lib/ticketeria/campanhas-servidor";
import { compradoresPorEvento, eventosEmComum, normalizarArtista } from "@/lib/ticketeria/publico-em-comum";
import { separarMarca } from "@/lib/ticketeria/campanhas";
import { abrirSessoesLongas, atracaoOAnoTodo, curvaDaCasa, controleDeVisitas, controlesDaTela, controlesDasSemanas, type ItemDePedidoPago, type ResumoDosControles, type VisitaDoDia } from "@/lib/ticketeria/modelo-controles";
import { totalVale } from "@/lib/ticketeria/efeito-total";
import { compararComOsLinks, lerPartesDaBase, type CanalDoResultado, type ParteDaBase } from "@/lib/ticketeria/modelo-resultado";
import type { Confianca } from "@/lib/ticketeria/modelo";
import { avaliarProntidao, consolidarGasto, gastoDasAcoes, montarTabelaSemanal, type EntradaDaProntidao, type ProntidaoDoModelo } from "@/lib/ticketeria/modelo";

type Admin = SupabaseClient<Database>;
const PAGINA = 1000;

/** Todas as linhas de uma consulta, em páginas de 1.000 (a consulta sem .range() corta em silêncio). */
export async function todas<T>(pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await pagina(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    linhas.push(...(data ?? []));
    if ((data ?? []).length < PAGINA) break;
  }
  return linhas;
}

/** A tabela semanal de uma loja e o que a prontidão precisa saber: junta o que o Jards já coleta (vendas, gasto das conexões, histórico importado, ações e visitas). Lido com a chave de serviço. */
export async function entradaDaLoja(admin: Admin, lojaId: string): Promise<EntradaDaProntidao> {
  const t = clienteDaTicketeria(admin);
  // As vendas pagas da Ticketeria por dia e as ações registradas (já somadas pelo painel da Divulgação).
  const painel = await divulgacaoDaLoja(admin, lojaId);
  const [vendasImportadas, conexoes, gastoImportado, { data: ga4 }] = await Promise.all([
    todas(async (de, ate) => t.from("ticketeria_historico_vendas").select("dia, ingressos").eq("loja_id", lojaId).order("dia", { ascending: true }).range(de, ate)),
    todas(async (de, ate) => t.from("ticketeria_midia_diaria").select("dia, canal, gasto_centavos").eq("loja_id", lojaId).order("dia", { ascending: true }).range(de, ate)),
    todas(async (de, ate) => t.from("ticketeria_historico_gasto").select("dia, canal, gasto_centavos").eq("loja_id", lojaId).order("dia", { ascending: true }).range(de, ate)),
    t.from("ticketeria_conexoes_midia").select("id, situacao").eq("loja_id", lojaId).eq("provedor", "ga4").maybeSingle(),
  ]);
  const vendas: Record<string, number> = { ...painel.por_dia };
  for (const v of vendasImportadas) vendas[v.dia] = (vendas[v.dia] ?? 0) + Number(v.ingressos);
  const { gasto, ignoradas } = consolidarGasto({
    conexoes: conexoes.map(l => ({ dia: l.dia, canal: l.canal, centavos: Number(l.gasto_centavos) })),
    planilhas: gastoImportado.map(l => ({ dia: l.dia, canal: l.canal, centavos: Number(l.gasto_centavos) })),
    acoes: painel.acoes.map(a => ({ nome: a.nome, canal: a.canal, inicio: a.inicio, fim: a.fim, gasto_centavos: a.gasto_centavos })),
  });
  // Visitas do GA4: o primeiro e o último dia lidos e as sessões de cada dia e origem (o controle de visitas sem anúncio).
  const ga4Conectado = !!ga4 && (ga4.situacao === "ativa" || ga4.situacao === "erro");
  let primeiroDiaDeVisitas: string | null = null;
  let ultimoDiaDeVisitas: string | null = null;
  let visitas: VisitaDoDia[] = [];
  if (ga4) {
    const [{ data: primeiro }, { data: ultimo }] = await Promise.all([
      t.from("ticketeria_visitas_diarias").select("dia").eq("conexao_id", ga4.id).order("dia", { ascending: true }).limit(1),
      t.from("ticketeria_visitas_diarias").select("dia").eq("conexao_id", ga4.id).order("dia", { ascending: false }).limit(1),
    ]);
    primeiroDiaDeVisitas = primeiro?.[0]?.dia ?? null;
    ultimoDiaDeVisitas = ultimo?.[0]?.dia ?? null;
    if (primeiroDiaDeVisitas) visitas = (await todas(async (de, ate) => t.from("ticketeria_visitas_diarias").select("dia, origem, sessoes").eq("conexao_id", ga4.id).order("dia", { ascending: true }).order("origem", { ascending: true }).range(de, ate))).map(v => ({ dia: v.dia, origem: v.origem, sessoes: Number(v.sessoes) }));
  }
  // Marca x evento: o gasto de marca (campanhas marcadas como marca e ações sem evento) vira um canal à parte quando cada lado tem semanas suficientes (lib/ticketeria/campanhas.ts).
  const marca = [
    ...(await gastoDaMarca(admin, lojaId)),
    ...gastoDasAcoes(painel.acoes.filter(a => !a.evento_id).map(a => ({ nome: a.nome, canal: a.canal, inicio: a.inicio, fim: a.fim, gasto_centavos: a.gasto_centavos }))).map(l => ({ dia: l.dia, canal: l.canal, centavos: l.centavos })),
  ];
  const semanal = separarMarca(montarTabelaSemanal({ vendas, gasto }), marca).tabela;
  const { controles, resumo } = await controlesDaLoja(t, lojaId, semanal.map(s => s.semana));
  const doGa4 = controleDeVisitas(visitas, primeiroDiaDeVisitas, ultimoDiaDeVisitas, semanal.map(s => s.semana));
  const tabela = semanal.map(s => ({ ...s, controles: { ...controles[s.semana], visitas: doGa4.valores[s.semana] ?? 0 } }));
  return { tabela, ga4Conectado, primeiroDiaDeVisitas, ultimoDiaDeVisitas, ignoradas, controles: controlesDaTela(tabela, resumo, { conectado: ga4Conectado, semanas: doGa4.semanasLidas }), resumo };
}

type Cliente = ReturnType<typeof clienteDaTicketeria>;

/** Os controles de cada semana (proximidade da sessão, feriado, virada de lote, preço, cupom) e o que a loja tem de cada coisa. Lido com a chave de serviço. */
async function controlesDaLoja(t: Cliente, lojaId: string, semanas: string[]): Promise<{ controles: ReturnType<typeof controlesDasSemanas>; resumo: ResumoDosControles }> {
  const [{ data: eventos }, { data: locais }, { data: datas }, { data: imprensa }] = await Promise.all([
    t.from("ticketeria_eventos").select("id").eq("loja_id", lojaId),
    t.from("ticketeria_locais").select("id, fuso").eq("loja_id", lojaId),
    t.from("ticketeria_datas_de_pico").select("dia, nome").eq("loja_id", lojaId),
    t.from("ticketeria_acoes_divulgacao").select("inicio").eq("loja_id", lojaId).eq("canal", CANAL_DA_IMPRENSA),
  ]);
  const idsDosEventos = (eventos ?? []).map(e => e.id);
  const fuso = new Map((locais ?? []).map(l => [l.id, l.fuso]));
  const [{ data: sessoesBrutas }, { data: ingressos }, { count: cupons }] = idsDosEventos.length === 0 ? [{ data: [] }, { data: [] }, { count: 0 }] : await Promise.all([
    t.from("ticketeria_sessoes").select("id, evento_id, local_id, sala_id, inicio, fim, cancelada_em").in("evento_id", idsDosEventos),
    t.from("ticketeria_ingressos").select("id").in("evento_id", idsDosEventos),
    t.from("ticketeria_cupons").select("id", { count: "exact", head: true }).in("evento_id", idsDosEventos),
  ]);
  const validas = (sessoesBrutas ?? []).filter(s => !s.cancelada_em);
  // A lotação de cada sessão (os lugares dos setores em uso da sala), para o controle do tamanho do que está à venda.
  const idsDosLocais = [...new Set(validas.map(s => s.local_id))];
  const { data: setores } = idsDosLocais.length > 0 ? await t.from("ticketeria_setores").select("sala_id, lugares").in("local_id", idsDosLocais).eq("arquivado", false) : { data: [] };
  const lugaresDaSala = new Map<string, number>();
  for (const x of setores ?? []) lugaresDaSala.set(x.sala_id, (lugaresDaSala.get(x.sala_id) ?? 0) + x.lugares);
  // A exposição (uma sessão que fica aberta vários dias) vale o período inteiro, não só o dia da abertura.
  const abertas = abrirSessoesLongas(validas.map(s => ({ inicio: diaNoFuso(s.inicio, fuso.get(s.local_id)), fim: s.fim ? diaNoFuso(s.fim, fuso.get(s.local_id)) : null, lugares: lugaresDaSala.get(s.sala_id) ?? 0 })));
  const sessoes = abertas.dias;
  const lugaresDasSessoes = abertas.lugares;
  const idsDosIngressos = (ingressos ?? []).map(i => i.id);
  const lotes: { ordem: number; vendas_inicio: string | null }[] = [];
  for (let i = 0; i < idsDosIngressos.length; i += 150) {
    const { data } = await t.from("ticketeria_lotes").select("ordem, vendas_inicio").in("ingresso_id", idsDosIngressos.slice(i, i + 150));
    for (const l of data ?? []) lotes.push({ ordem: l.ordem, vendas_inicio: l.vendas_inicio });
  }
  // As compras pagas: o dia, o cupom e cada item (quantidade e preço).
  const pagos = await todas(async (de, ate) => t.from("ticketeria_pedidos").select("id, sessao_id, pago_em, cupom_id").eq("loja_id", lojaId).eq("situacao", "pago").order("created_at", { ascending: true }).range(de, ate));
  const itens: ItemDePedidoPago[] = [];
  const porPedido = new Map(pagos.map(p => [p.id, p]));
  // Para a curva da casa: cada ingresso de uma sessão que já aconteceu, com quantas semanas antes dela foi comprado.
  const hoje = diaNoFuso(new Date());
  const sessaoPorId = new Map(validas.map(s => [s.id, { evento: s.evento_id, dia: diaNoFuso(s.inicio, fuso.get(s.local_id)) }]));
  // Para o boca a boca e a urgência: as vendas de cada sessão de um dia (a exposição fica de fora: tem outra lógica de lotação).
  const vendasDasSessoes = new Map(validas.filter(s => !s.fim || diaNoFuso(s.fim, fuso.get(s.local_id)) <= diaNoFuso(s.inicio, fuso.get(s.local_id)))
    .map(s => [s.id, { dia: diaNoFuso(s.inicio, fuso.get(s.local_id)), lugares: lugaresDaSala.get(s.sala_id) ?? 0, vendas: [] as { dia: string; quantidade: number }[] }]));
  const vendasDaCurva: { evento: string; semanasAntes: number; quantidade: number }[] = [];
  for (let i = 0; i < pagos.length; i += 150) {
    const { data } = await t.from("ticketeria_pedido_itens").select("pedido_id, quantidade, preco_centavos").in("pedido_id", pagos.slice(i, i + 150).map(p => p.id));
    for (const it of data ?? []) {
      const p = porPedido.get(it.pedido_id);
      if (p?.pago_em) itens.push({ dia: diaNoFuso(p.pago_em), quantidade: it.quantidade, precoCentavos: it.preco_centavos, comCupom: p.cupom_id !== null });
      const sessao = p?.sessao_id ? sessaoPorId.get(p.sessao_id) : undefined;
      const daSessao = p?.sessao_id ? vendasDasSessoes.get(p.sessao_id) : undefined;
      if (p?.pago_em && daSessao) daSessao.vendas.push({ dia: diaNoFuso(p.pago_em), quantidade: it.quantidade });
      if (p?.pago_em && sessao && sessao.dia < hoje) {
        const dias = (Date.parse(`${sessao.dia}T00:00:00Z`) - Date.parse(`${diaNoFuso(p.pago_em)}T00:00:00Z`)) / 86400000;
        if (dias >= 0) vendasDaCurva.push({ evento: sessao.evento, semanasAntes: Math.floor(dias / 7), quantidade: it.quantidade });
      }
    }
  }
  const viradasDeLote = lotes.filter(l => l.ordem > 0 && l.vendas_inicio).map(l => diaNoFuso(l.vendas_inicio as string));
  const curva = curvaDaCasa(vendasDaCurva);
  const controles = controlesDasSemanas({ semanas, sessoes, lugaresDasSessoes, curvaDaCasa: curva?.curva ?? null, datasProprias: (datas ?? []).map(d => ({ dia: d.dia, nome: d.nome })), viradasDeLote, itens, vendasDasSessoes: [...vendasDasSessoes.values()], imprensa: (imprensa ?? []).map(a => a.inicio) });
  const permanente = atracaoOAnoTodo(validas.map(s => ({ evento: s.evento_id, inicio: diaNoFuso(s.inicio, fuso.get(s.local_id)), fim: s.fim ? diaNoFuso(s.fim, fuso.get(s.local_id)) : null })));
  return { controles, resumo: { eventos: idsDosEventos.length, sessoes: validas.length, lotes: lotes.length, cupons: cupons ?? 0, datasProprias: (datas ?? []).length, curva, permanente, imprensa: (imprensa ?? []).length } };
}

/** A prontidão do modelo de uma loja: confere se há dado para o modelo rodar. */
export async function prontidaoDaLoja(admin: Admin, lojaId: string): Promise<ProntidaoDoModelo> {
  return avaliarProntidao(await entradaDaLoja(admin, lojaId));
}

export type ResultadoParaATela = {
  execucao: { id: string; created_at: string; semanas: number; confianca: Confianca; motor: string; versao_motor: string; r_hat_maximo: number; divergencias: number; ess_minimo: number; base: { porcento: number; baixo: number; alto: number; partes: ParteDaBase[] } };
  comparacao: ReturnType<typeof compararComOsLinks>;
  /** O que cada canal fez no ano (gasto semanal e curva), para a tela. */
  canais: CanalDoResultado[];
  /** A rodada mais recente que NÃO deu (se for mais nova que a última boa): a frase aparece para o dono. */
  ultimaFalha: { motivo: string; created_at: string } | null;
};

/** O último resultado bom do modelo de uma loja, ao lado do que os links de divulgação mostram; null se ainda não há. Lido com a chave de serviço. */
export async function resultadoDaLoja(admin: Admin, lojaId: string): Promise<ResultadoParaATela | null> {
  const t = clienteDaTicketeria(admin);
  const [{ data: boa }, { data: ultima }] = await Promise.all([
    t.from("ticketeria_mmm_execucoes").select("id, created_at, semanas, confianca, motor, versao_motor, r_hat_maximo, divergencias, ess_minimo, base_porcento, base_baixo, base_alto, base_partes").eq("loja_id", lojaId).eq("situacao", "ok").order("created_at", { ascending: false }).limit(1),
    t.from("ticketeria_mmm_execucoes").select("situacao, motivo, created_at").eq("loja_id", lojaId).order("created_at", { ascending: false }).limit(1),
  ]);
  const e = boa?.[0];
  const falha = ultima?.[0]?.situacao === "falhou" ? ultima[0] : null;
  if (!e) return null;
  const { data: linhas } = await t.from("ticketeria_mmm_canais").select("canal, porcento, intervalo_baixo, intervalo_alto, ingressos, gasto_centavos, custo_por_ingresso_centavos, saturacao_gasto_centavos, margem_grande, gasto_constante, curva, atraso, porcento_total").eq("execucao_id", e.id).order("porcento", { ascending: false });
  const canais: CanalDoResultado[] = (linhas ?? []).map(c => ({
    canal: c.canal, porcento: Number(c.porcento), baixo: Number(c.intervalo_baixo), alto: Number(c.intervalo_alto), ingressos: Number(c.ingressos), gasto_centavos: Number(c.gasto_centavos),
    custo_por_ingresso_centavos: c.custo_por_ingresso_centavos === null ? null : Number(c.custo_por_ingresso_centavos), saturacao_gasto_centavos: c.saturacao_gasto_centavos === null ? null : Number(c.saturacao_gasto_centavos),
    margem_grande: c.margem_grande, gasto_constante: c.gasto_constante, curva: Array.isArray(c.curva) ? (c.curva as { gasto_centavos: number; ingressos: number }[]) : [], atraso: c.atraso === null ? null : Number(c.atraso),
    porcento_total: c.porcento_total === null ? null : Number(c.porcento_total),
  }));
  // O efeito total só vale quando o boca a boca ou a urgência pesam nesta rodada (senão é ruído em cima do direto): fica nulo e a tela mostra só o "sozinho".
  if (!totalVale(lerPartesDaBase(e.base_partes) ?? [])) for (const c of canais) c.porcento_total = null;
  // O que os links mostram: os ingressos vendidos por canal de origem (todas as sessões).
  const painel = await divulgacaoDaLoja(admin, lojaId);
  const porCanalDoLink: Record<string, number> = {};
  for (const l of painel.linhas) porCanalDoLink[l.chave] = (porCanalDoLink[l.chave] ?? 0) + l.ingressos;
  return {
    execucao: { id: e.id, created_at: e.created_at, semanas: Number(e.semanas), confianca: e.confianca as Confianca, motor: String(e.motor), versao_motor: String(e.versao_motor), r_hat_maximo: Number(e.r_hat_maximo), divergencias: Number(e.divergencias), ess_minimo: Number(e.ess_minimo), base: { porcento: Number(e.base_porcento), baixo: Number(e.base_baixo), alto: Number(e.base_alto), partes: lerPartesDaBase(e.base_partes) ?? [] } },
    comparacao: compararComOsLinks(canais, porCanalDoLink), canais,
    ultimaFalha: falha && Date.parse(falha.created_at) > Date.parse(e.created_at) ? { motivo: String(falha.motivo ?? ""), created_at: falha.created_at } : null,
  };
}

/**
 * O ritmo de venda da próxima sessão que já vendeu: o que vendeu, a lotação (a soma dos lugares dos setores em uso do local), as vendas por dia e o ritmo dos últimos 7 dias. null se não há sessão
 * por vir com venda. É a conta simples do painel evolutivo, não uma previsão do modelo. Lido com a chave de serviço.
 */
export async function ritmoDoProximoEvento(admin: Admin, lojaId: string, agora: number = Date.now()): Promise<RitmoDoEvento | null> {
  const t = clienteDaTicketeria(admin);
  const { data: eventos } = await t.from("ticketeria_eventos").select("id, titulo, artista").eq("loja_id", lojaId);
  const idsDosEventos = (eventos ?? []).map(e => e.id);
  if (idsDosEventos.length === 0) return null;
  const { data: sessoesBrutas } = await t.from("ticketeria_sessoes").select("id, evento_id, local_id, sala_id, inicio, cancelada_em").in("evento_id", idsDosEventos);
  const validas = (sessoesBrutas ?? []).filter(s => !s.cancelada_em);
  const futuras = validas.filter(s => Date.parse(s.inicio) > agora).sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
  if (futuras.length === 0) return null;
  const pagos = (await todas(async (de, ate) => t.from("ticketeria_pedidos").select("id, sessao_id, pago_em, comprador_email").eq("loja_id", lojaId).eq("situacao", "pago").order("created_at", { ascending: true }).range(de, ate))).filter(p => p.pago_em);
  const idsDasSessoes = new Set(validas.map(s => s.id));
  const dasSessoes = pagos.filter(p => idsDasSessoes.has(p.sessao_id));
  // Quantidade e valor de cada pedido (preço médio só de ingresso pago: cortesia e gratuito não dizem do preço).
  const quantidade = new Map<string, number>();
  const valorPago = new Map<string, { qtd: number; valor: number }>();
  for (let i = 0; i < dasSessoes.length; i += 150) {
    const { data } = await t.from("ticketeria_pedido_itens").select("pedido_id, quantidade, preco_centavos").in("pedido_id", dasSessoes.slice(i, i + 150).map(p => p.id));
    for (const it of data ?? []) {
      quantidade.set(it.pedido_id, (quantidade.get(it.pedido_id) ?? 0) + it.quantidade);
      if (it.preco_centavos > 0) { const v = valorPago.get(it.pedido_id) ?? { qtd: 0, valor: 0 }; v.qtd += it.quantidade; v.valor += it.quantidade * it.preco_centavos; valorPago.set(it.pedido_id, v); }
    }
  }
  const escolhida = futuras.find(s => dasSessoes.some(p => p.sessao_id === s.id));
  if (!escolhida) return null;
  const idsDosLocais = [...new Set(validas.map(s => s.local_id))];
  const [{ data: locais }, { data: setores }] = await Promise.all([
    t.from("ticketeria_locais").select("id, nome, fuso").in("id", idsDosLocais),
    t.from("ticketeria_setores").select("sala_id, lugares").in("local_id", idsDosLocais).eq("arquivado", false),
  ]);
  const lugaresDaSala = new Map<string, number>();
  for (const x of setores ?? []) lugaresDaSala.set(x.sala_id, (lugaresDaSala.get(x.sala_id) ?? 0) + x.lugares);
  const doLocal = new Map((locais ?? []).map(l => [l.id, l]));
  const titulo = new Map((eventos ?? []).map(e => [e.id, e.titulo]));
  // As vendas de uma sessão: por dia (do pagamento, no fuso do local), o total e o preço médio.
  const vendasDaSessao = (sessao: (typeof validas)[number]) => {
    const fuso = doLocal.get(sessao.local_id)?.fuso ?? undefined;
    const porDia: Record<string, number> = {};
    let total = 0, qtdPaga = 0, valor = 0;
    for (const p of dasSessoes.filter(x => x.sessao_id === sessao.id)) {
      const n = quantidade.get(p.id) ?? 0;
      total += n;
      porDia[diaNoFuso(p.pago_em as string, fuso)] = (porDia[diaNoFuso(p.pago_em as string, fuso)] ?? 0) + n;
      const v = valorPago.get(p.id);
      if (v) { qtdPaga += v.qtd; valor += v.valor; }
    }
    return { fuso, porDia, total, precoMedioCentavos: qtdPaga > 0 ? Math.round(valor / qtdPaga) : 0, diaDaSessao: diaNoFuso(sessao.inicio, fuso) };
  };
  const atual = vendasDaSessao(escolhida);
  const lugares = lugaresDaSala.get(escolhida.sala_id) ?? 0;
  const ritmo = ritmoDoEvento({ evento: titulo.get(escolhida.evento_id) ?? "Evento", vendasPorDia: atual.porDia, vendidos: atual.total, lugares, hoje: diaNoFuso(new Date(agora), atual.fuso), diaDaSessao: atual.diaDaSessao });
  if (!ritmo) return null;
  // O público em comum com o evento atual (quem comprou os dois) e o mesmo artista: o que é "parecido" vem da casa (lib/ticketeria/publico-em-comum.ts).
  const compradores = compradoresPorEvento(dasSessoes.map(p => ({ comprador_email: p.comprador_email, sessao_id: p.sessao_id })), Object.fromEntries(validas.map(s => [s.id, s.evento_id])));
  const emComum = new Map(eventosEmComum(compradores, escolhida.evento_id).map(x => [x.eventoId, x.parte]));
  const artistaDe = new Map((eventos ?? []).map(e => [e.id, normalizarArtista(e.artista)]));
  const artistaAtual = artistaDe.get(escolhida.evento_id) ?? "";
  // As curvas dos eventos que já aconteceram (para a comparação): cada sessão passada que vendeu.
  const curvas: CurvaDoEvento[] = [];
  for (const s of validas.filter(x => Date.parse(x.inicio) <= agora)) {
    const v = vendasDaSessao(s);
    if (v.total <= 0) continue;
    curvas.push({
      id: s.id, nome: titulo.get(s.evento_id) ?? "Evento", quando: new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: v.fuso ?? "America/Sao_Paulo" }).format(new Date(s.inicio)).replace(" de ", "/").replace(".", ""),
      local: doLocal.get(s.local_id)?.nome ?? "Local", localId: s.local_id, precoMedioCentavos: v.precoMedioCentavos, lugares: lugaresDaSala.get(s.sala_id) ?? 0, acumulado: acumuladoDaSessao(v.diaDaSessao, v.porDia),
      eventoId: s.evento_id, publicoEmComum: s.evento_id === escolhida.evento_id ? null : emComum.get(s.evento_id) ?? 0, mesmoArtista: !!artistaAtual && artistaDe.get(s.evento_id) === artistaAtual && s.evento_id !== escolhida.evento_id,
    });
  }
  return { ...ritmo, comparacao: { sessaoId: escolhida.id, localId: escolhida.local_id, precoMedioCentavos: atual.precoMedioCentavos, compradores: compradores.get(escolhida.evento_id)?.size ?? 0, acumulado: acumuladoDaSessao(atual.diaDaSessao, atual.porDia), curvas } };
}
