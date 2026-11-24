import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { CANAL_DA_IMPRENSA, SEPARADOR_DO_ASSUNTO, diaNoFuso } from "@/lib/ticketeria/divulgacao";
import { normalizarVeiculo, somarDias, veiculosConhecidos } from "@/lib/ticketeria/imprensa";
import {
  CAMINHOS_COMUNS_DE_FEED, DIAS_DA_PRIMEIRA_LEITURA, feedPorPadrao, FRASE_DO_MOTIVO, MAX_MATERIAS_POR_LEITURA, VEICULOS_PADRAO, feedAnunciado, lerFeed, lerSite, motivoClaro, motivoDaNoticia,
  pareceFeed, textoDoHtml, valeAbrir, type EventoProcurado, type Motivo,
} from "@/lib/ticketeria/imprensa-monitor";
import { ler, porteiroDoRobots } from "@/lib/ticketeria/imprensa-leitura";

// O monitoramento da imprensa no servidor (lib/ticketeria/imprensa-monitor.ts): a lista de veículos de cada casa, a descoberta do RSS, a leitura diária e o que fazer com cada achado.

type Admin = SupabaseClient<Database>;
type Situacao = "aguardando" | "lendo" | "sem_rss" | "bloqueado" | "erro";
const BLOQUEIO = new Set([401, 403, 429, 451]);
/** O nome do veículo nas marcações: sem a seção ("Folha de S.Paulo · Ilustrada" → "Folha de S.Paulo"), para o peso aprender o veículo. */
const veiculoDoNome = (nome: string): string => nome.split(SEPARADOR_DO_ASSUNTO)[0].trim();

/** O RSS de um site: o próprio endereço, se já for um feed; o que a página anuncia; ou um dos caminhos comuns. Respeita o robots.txt. */
export async function descobrirFeed(site: string): Promise<{ feed: string | null; situacao: Situacao }> {
  const pode = porteiroDoRobots();
  try {
    if (!(await pode(site))) return { feed: null, situacao: "bloqueado" };
    const r = await ler(site);
    if (BLOQUEIO.has(r.status)) return { feed: null, situacao: "bloqueado" };
    if (r.status === 200 && pareceFeed(r.corpo)) return { feed: r.url, situacao: "lendo" };
    const candidatos = [r.status === 200 ? feedAnunciado(r.corpo, r.url) : null, feedPorPadrao(site), ...CAMINHOS_COMUNS_DE_FEED.map(c => new URL(c, r.url).toString())].filter((x): x is string => !!x);
    for (const c of candidatos) {
      if (!(await pode(c))) continue;
      const f = await ler(c).catch(() => null);
      if (f && f.status === 200 && pareceFeed(f.corpo)) return { feed: f.url, situacao: "lendo" };
    }
    return { feed: null, situacao: "sem_rss" };
  } catch {
    return { feed: null, situacao: "erro" };
  }
}

/** A grande imprensa padrão, na primeira vez que a casa abre a lista (a linha fica mesmo depois de "parar de acompanhar", para não voltar). */
async function semearPadrao(admin: Admin, lojaId: string, organizationId: string) {
  const t = clienteDaTicketeria(admin);
  const { count } = await t.from("ticketeria_veiculos_acompanhados").select("id", { count: "exact", head: true }).eq("loja_id", lojaId);
  if ((count ?? 0) > 0) return;
  await t.from("ticketeria_veiculos_acompanhados").upsert(VEICULOS_PADRAO.map(v => ({ organization_id: organizationId, loja_id: lojaId, nome: v.nome, site: v.site, feed: v.feed, origem: "padrao", situacao: "aguardando" })), { onConflict: "loja_id,site", ignoreDuplicates: true });
}

export type VeiculoDaTela = { id: string; nome: string; site: string; origem: string; situacao: Situacao; noticias: number; achados: number };
/** Os veículos acompanhados da casa (com quantos achados nos últimos 30 dias) e as sugestões: veículos marcados à mão que ainda não são acompanhados. */
export async function veiculosDaLoja(admin: Admin, lojaId: string, organizationId: string, hoje: string = diaNoFuso(new Date())): Promise<{ veiculos: VeiculoDaTela[]; sugestoes: { nome: string; vezes: number }[] }> {
  await semearPadrao(admin, lojaId, organizationId);
  const t = clienteDaTicketeria(admin);
  const [{ data: linhas }, { data: achados }, { data: acoes }] = await Promise.all([
    t.from("ticketeria_veiculos_acompanhados").select("id, nome, site, origem, situacao, noticias_lidas").eq("loja_id", lojaId).eq("parado", false).order("created_at"),
    t.from("ticketeria_imprensa_achados").select("veiculo_id").eq("loja_id", lojaId).gte("publicado_em", somarDias(hoje, -30)).in("situacao", ["registrado", "a_confirmar"]),
    t.from("ticketeria_acoes_divulgacao").select("canal, veiculo").eq("loja_id", lojaId).eq("canal", CANAL_DA_IMPRENSA),
  ]);
  const porVeiculo = new Map<string, number>();
  for (const a of achados ?? []) if (a.veiculo_id) porVeiculo.set(a.veiculo_id, (porVeiculo.get(a.veiculo_id) ?? 0) + 1);
  const veiculos = (linhas ?? []).map(v => ({ id: v.id, nome: v.nome, site: v.site, origem: v.origem, situacao: v.situacao as Situacao, noticias: v.noticias_lidas, achados: porVeiculo.get(v.id) ?? 0 }));
  const acompanhados = veiculos.map(v => normalizarVeiculo(veiculoDoNome(v.nome)));
  const sugestoes = veiculosConhecidos(acoes ?? []).filter(s => !acompanhados.some(a => a === normalizarVeiculo(s.nome) || a.startsWith(normalizarVeiculo(s.nome))));
  return { veiculos, sugestoes };
}

/** "Acompanhar": confere o endereço, acha o RSS agora e grava (se o site já estava na lista e foi parado, volta). */
export async function acompanharSite(admin: Admin, lojaId: string, organizationId: string, entrada: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const lido = lerSite(entrada);
  if (!lido.ok) return lido;
  const t = clienteDaTicketeria(admin);
  const { feed, situacao } = await descobrirFeed(lido.site);
  const { error } = await t.from("ticketeria_veiculos_acompanhados").upsert(
    { organization_id: organizationId, loja_id: lojaId, nome: lido.nome, site: lido.site, feed, origem: "produtor", situacao, parado: false },
    { onConflict: "loja_id,site" },
  );
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Os eventos à venda que a leitura procura: com sessão de hoje até 120 dias, o título, o artista e o nome dos espaços das sessões. */
async function eventosProcurados(admin: Admin, lojaId: string, hoje: string): Promise<EventoProcurado[]> {
  const t = clienteDaTicketeria(admin);
  const [{ data: eventos }, { data: locais }] = await Promise.all([
    t.from("ticketeria_eventos").select("id, titulo, artista, situacao").eq("loja_id", lojaId).neq("situacao", "cancelado"),
    t.from("ticketeria_locais").select("id, nome").eq("loja_id", lojaId),
  ]);
  const ids = (eventos ?? []).map(e => e.id);
  if (ids.length === 0) return [];
  const { data: sessoes } = await t.from("ticketeria_sessoes").select("evento_id, local_id, inicio").in("evento_id", ids).is("cancelada_em", null).gte("inicio", `${hoje}T00:00:00Z`).lte("inicio", `${somarDias(hoje, 120)}T23:59:59Z`);
  const nomeDoLocal = new Map((locais ?? []).map(l => [l.id, l.nome]));
  const porEvento = new Map<string, Set<string>>();
  for (const s of sessoes ?? []) { const l = nomeDoLocal.get(s.local_id); (porEvento.get(s.evento_id) ?? porEvento.set(s.evento_id, new Set()).get(s.evento_id)!).add(l ?? ""); }
  return (eventos ?? []).filter(e => porEvento.has(e.id)).map(e => ({ id: e.id, titulo: e.titulo, artista: e.artista ?? null, locais: [...(porEvento.get(e.id) ?? [])].filter(Boolean) }));
}

/** Cria a marcação de imprensa de um achado (veículo, título da notícia, dia e evento). */
async function registrar(admin: Admin, lojaId: string, organizationId: string, a: { veiculo: string; titulo: string; dia: string; eventoId: string }): Promise<string> {
  const t = clienteDaTicketeria(admin);
  const veiculo = veiculoDoNome(a.veiculo).slice(0, 60);
  const { data, error } = await t.from("ticketeria_acoes_divulgacao").insert({
    organization_id: organizationId, loja_id: lojaId, canal: CANAL_DA_IMPRENSA, veiculo, nome: `${veiculo}${SEPARADOR_DO_ASSUNTO}${a.titulo}`.slice(0, 80).trim(), inicio: a.dia, fim: a.dia, gasto_centavos: 0, evento_id: a.eventoId,
  }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "acao_nao_criada");
  return data.id;
}

/** A leitura de uma casa: cada veículo acompanhado, as notícias novas, a busca do nome (no texto das matérias abertas que valem abrir) e o que fazer com cada achado. */
export async function lerImprensaDaLoja(admin: Admin, lojaId: string, organizationId: string, hoje: string = diaNoFuso(new Date())): Promise<{ veiculos: number; achados: number }> {
  const t = clienteDaTicketeria(admin);
  const eventos = await eventosProcurados(admin, lojaId, hoje);
  if (eventos.length === 0) return { veiculos: 0, achados: 0 };
  await semearPadrao(admin, lojaId, organizationId);
  const { data: veiculos } = await t.from("ticketeria_veiculos_acompanhados").select("id, nome, site, feed, situacao, ultima_leitura").eq("loja_id", lojaId).eq("parado", false);
  const pode = porteiroDoRobots();
  let achados = 0;
  for (const v of veiculos ?? []) {
    let feed = v.feed, situacao: Situacao = "lendo", lidas = 0;
    try {
      if (!feed) { const d = await descobrirFeed(v.site); feed = d.feed; situacao = d.situacao; }
      if (feed) {
        if (!(await pode(feed))) situacao = "bloqueado";
        else {
          const r = await ler(feed);
          if (BLOQUEIO.has(r.status)) situacao = "bloqueado";
          else if (r.status !== 200 || !pareceFeed(r.corpo)) situacao = "erro";
          else {
            const desde = v.ultima_leitura ? somarDias(diaNoFuso(v.ultima_leitura), -1) : somarDias(hoje, -DIAS_DA_PRIMEIRA_LEITURA);
            const noticias = lerFeed(r.corpo).filter(n => !n.publicado || n.publicado >= desde);
            lidas = noticias.length;
            let abertas = 0;
            for (const n of noticias) {
              let motivos = eventos.map(e => ({ e, m: motivoDaNoticia(n, e) }));
              // Abre a matéria quando ainda dá para melhorar: algum dúbio (pode virar claro com o espaço no texto) ou nenhum achado mas a chamada cita a casa ou parece agenda.
              const melhorar = motivos.some(x => x.m && !motivoClaro(x.m)) || (motivos.every(x => !x.m) && valeAbrir(n, eventos));
              if (melhorar && abertas < MAX_MATERIAS_POR_LEITURA && (await pode(n.link))) {
                abertas++;
                const materia = await ler(n.link).catch(() => null);
                if (materia && materia.status === 200) { const texto = textoDoHtml(materia.corpo).slice(0, 200000); motivos = eventos.map(e => ({ e, m: motivoDaNoticia({ ...n, texto }, e) })); }
              }
              for (const { e, m } of motivos) {
                if (!m) continue;
                achados += await guardarAchado(admin, lojaId, organizationId, { veiculoId: v.id, veiculo: v.nome, eventoId: e.id, titulo: n.titulo, link: n.link, dia: n.publicado ?? hoje, motivo: m });
              }
            }
          }
        }
      }
    } catch {
      situacao = "erro";
    }
    await t.from("ticketeria_veiculos_acompanhados").update({ feed, situacao, noticias_lidas: lidas, ultima_leitura: new Date().toISOString() }).eq("id", v.id);
  }
  return { veiculos: (veiculos ?? []).length, achados };
}

/** Grava um achado (se ainda não havia: o mesmo link do mesmo evento não volta) e, se for claro, já registra a marcação. Devolve 1 se é novo. */
async function guardarAchado(admin: Admin, lojaId: string, organizationId: string, a: { veiculoId: string; veiculo: string; eventoId: string; titulo: string; link: string; dia: string; motivo: Motivo }): Promise<number> {
  const t = clienteDaTicketeria(admin);
  const claro = motivoClaro(a.motivo);
  const { data } = await t.from("ticketeria_imprensa_achados").upsert({
    organization_id: organizationId, loja_id: lojaId, veiculo_id: a.veiculoId, evento_id: a.eventoId, titulo: a.titulo.slice(0, 300), link: a.link, publicado_em: a.dia, motivo: a.motivo, situacao: claro ? "registrado" : "a_confirmar",
  }, { onConflict: "loja_id,evento_id,link", ignoreDuplicates: true }).select("id");
  const novo = data?.[0];
  if (!novo) return 0;
  if (claro) {
    const acao = await registrar(admin, lojaId, organizationId, { veiculo: a.veiculo, titulo: a.titulo, dia: a.dia, eventoId: a.eventoId });
    await t.from("ticketeria_imprensa_achados").update({ acao_id: acao }).eq("id", novo.id);
  }
  return 1;
}

export type AchadoDaTela = { id: string; veiculo: string; titulo: string; link: string; dia: string; evento: string; motivo: string };
/** Os achados para a tela: os que esperam confirmação (todos) e os registrados sozinhos dos últimos 30 dias. */
export async function achadosDaLoja(admin: Admin, lojaId: string, hoje: string = diaNoFuso(new Date())): Promise<{ aConfirmar: AchadoDaTela[]; registrados: AchadoDaTela[] }> {
  const t = clienteDaTicketeria(admin);
  const [{ data: linhas }, { data: veiculos }, { data: eventos }] = await Promise.all([
    t.from("ticketeria_imprensa_achados").select("id, veiculo_id, evento_id, titulo, link, publicado_em, motivo, situacao").eq("loja_id", lojaId).or(`situacao.eq.a_confirmar,and(situacao.eq.registrado,publicado_em.gte.${somarDias(hoje, -30)})`).order("publicado_em", { ascending: false }).limit(200),
    t.from("ticketeria_veiculos_acompanhados").select("id, nome").eq("loja_id", lojaId),
    t.from("ticketeria_eventos").select("id, titulo").eq("loja_id", lojaId),
  ]);
  const nomeDoVeiculo = new Map((veiculos ?? []).map(v => [v.id, v.nome]));
  const titulo = new Map((eventos ?? []).map(e => [e.id, e.titulo]));
  const tela = (a: NonNullable<typeof linhas>[number]): AchadoDaTela => ({ id: a.id, veiculo: (a.veiculo_id && nomeDoVeiculo.get(a.veiculo_id)) || "Imprensa", titulo: a.titulo, link: a.link, dia: a.publicado_em, evento: titulo.get(a.evento_id) ?? "Evento", motivo: FRASE_DO_MOTIVO[a.motivo as Motivo] ?? "" });
  return { aConfirmar: (linhas ?? []).filter(a => a.situacao === "a_confirmar").map(tela), registrados: (linhas ?? []).filter(a => a.situacao === "registrado").map(tela) };
}

/** O que o produtor faz com um achado: confirmar (vira marcação), descartar ("não é sobre o evento") ou desfazer (apaga a marcação de um registrado sozinho). */
export async function decidirAchado(admin: Admin, lojaId: string, organizationId: string, achadoId: string, acao: "confirmar" | "descartar" | "desfazer"): Promise<{ ok: true } | { ok: false; erro: string }> {
  const t = clienteDaTicketeria(admin);
  const { data: a } = await t.from("ticketeria_imprensa_achados").select("id, veiculo_id, evento_id, titulo, publicado_em, situacao, acao_id").eq("id", achadoId).eq("loja_id", lojaId).maybeSingle();
  if (!a) return { ok: false, erro: "achado_nao_encontrado" };
  if (acao === "confirmar" && a.situacao === "a_confirmar") {
    const { data: v } = a.veiculo_id ? await t.from("ticketeria_veiculos_acompanhados").select("nome").eq("id", a.veiculo_id).maybeSingle() : { data: null };
    const id = await registrar(admin, lojaId, organizationId, { veiculo: v?.nome ?? "Imprensa", titulo: a.titulo, dia: a.publicado_em, eventoId: a.evento_id });
    await t.from("ticketeria_imprensa_achados").update({ situacao: "registrado", acao_id: id }).eq("id", a.id);
    return { ok: true };
  }
  if (acao === "descartar" && a.situacao === "a_confirmar") { await t.from("ticketeria_imprensa_achados").update({ situacao: "descartado" }).eq("id", a.id); return { ok: true }; }
  if (acao === "desfazer" && a.situacao === "registrado") {
    if (a.acao_id) await t.from("ticketeria_acoes_divulgacao").delete().eq("id", a.acao_id).eq("loja_id", lojaId);
    await t.from("ticketeria_imprensa_achados").update({ situacao: "desfeito", acao_id: null }).eq("id", a.id);
    return { ok: true };
  }
  return { ok: false, erro: "situacao_mudou" };
}
