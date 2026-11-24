// A página de cada evento no site da loja e a Agenda (C2; desenho aprovado pelo dono em 20/11/2026): o endereço (/e/<slug>), os dados estruturados que o Google lê (schema.org/Event),
// o resumo para o cartão de compartilhamento, o estado do evento e a lista da Agenda. Só lógica e dados (sem banco, sem tela e sem servidor): roda no navegador e nos testes.

import type { EventoNaApi, SessaoNaApi } from "@/lib/ticketeria/integracao";
import { codigoDoCupomValido, normalizarCodigo } from "@/lib/ticketeria/cupom";
import { origemDaPagina } from "@/lib/ticketeria/origem";

/** O endereço público da página do evento no domínio do produtor. */
export const enderecoDoEvento = (host: string, slug: string) => `https://${host}/e/${slug}`;

/** O caminho da página do evento a partir da base do site ("" no domínio da pessoa). */
export const caminhoDoEvento = (base: string, slug: string) => `${base}/e/${slug}`;

/** O slug de um evento como o banco o guarda (a regra de formato do banco). */
export const SLUG_DO_EVENTO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** O resumo da descrição para o cartão de compartilhamento: até `max` letras, cortado numa palavra, em uma linha só; nulo se não há descrição. */
export function descricaoResumida(descricao: string | null, max = 160): string | null {
  const limpa = (descricao ?? "").replace(/\s+/g, " ").trim();
  if (limpa === "") return null;
  if (limpa.length <= max) return limpa;
  const corte = limpa.slice(0, max - 1);
  const espaco = corte.lastIndexOf(" ");
  return `${(espaco > max * 0.6 ? corte.slice(0, espaco) : corte).replace(/[.,;:!?\s]+$/, "")}…`;
}

export type EstadoDoEvento = "aberta" | "esgotado" | "indisponivel";

/** O estado do evento, pelas sessões: alguma à venda = "aberta"; todas esgotadas = "esgotado"; o resto (pausadas, nenhuma) = "indisponivel". */
export function estadoDoEvento(sessoes: readonly Pick<SessaoNaApi, "estado">[]): EstadoDoEvento {
  if (sessoes.some(s => s.estado === "aberta")) return "aberta";
  if (sessoes.length > 0 && sessoes.every(s => s.estado === "esgotada")) return "esgotado";
  return "indisponivel";
}

export type SessaoDaAgenda = Pick<SessaoNaApi, "id" | "inicio" | "quando" | "local" | "estado" | "a_partir_de_centavos" | "poucos" | "url"> & { local_nome: string };

export type ItemDaAgenda = { slug: string; titulo: string; descricao: string | null; imagem: string | null; classificacao: string | null; proxima: { quando: string; local: string } | null; estado: EstadoDoEvento; a_partir_de_centavos: number | null; sessoes: number; lista: SessaoDaAgenda[] };

/** A Agenda: um item por evento com sessão por vir, na ordem da primeira sessão. A "próxima" é a primeira sessão à venda (ou, sem nenhuma, a primeira); o preço é o menor entre as sessões à venda. */
export function agendaDosEventos(eventos: readonly EventoNaApi[]): ItemDaAgenda[] {
  return eventos.filter(e => e.sessoes.length > 0).map(e => {
    const proxima = e.sessoes.find(s => s.estado === "aberta") ?? e.sessoes[0];
    const precos = e.sessoes.filter(s => s.estado === "aberta" && s.a_partir_de_centavos !== null).map(s => s.a_partir_de_centavos as number);
    const lista: SessaoDaAgenda[] = e.sessoes.filter(s => s.estado !== "cancelada" && s.estado !== "encerrada").map(s => ({ id: s.id, inicio: s.inicio, quando: s.quando, local: s.local, local_nome: s.local_nome || s.local, estado: s.estado, a_partir_de_centavos: s.a_partir_de_centavos, poucos: s.poucos, url: s.url }));
    return { slug: e.slug, titulo: e.titulo, descricao: e.descricao, imagem: e.imagem, classificacao: e.classificacao, proxima: { quando: proxima.quando, local: proxima.local }, estado: estadoDoEvento(e.sessoes), a_partir_de_centavos: precos.length > 0 ? Math.min(...precos) : null, sessoes: e.sessoes.length, lista };
  });
}

const DISPONIBILIDADE: Partial<Record<SessaoNaApi["estado"], string>> = { aberta: "https://schema.org/InStock", esgotada: "https://schema.org/SoldOut" };

/** Os dados estruturados do evento para o Google (schema.org/Event): um Event por sessão que ainda vai acontecer e não foi cancelada, com local, preço e disponibilidade. */
export function dadosEstruturadosDoEvento(evento: Pick<EventoNaApi, "titulo" | "descricao" | "imagem" | "sessoes">, url: string, organizador: string): Record<string, unknown>[] {
  return evento.sessoes.filter(s => s.estado !== "cancelada" && s.estado !== "encerrada").map(s => {
    const lugar: Record<string, unknown> = { "@type": "Place", name: s.local_nome || s.local };
    if (s.cidade || s.uf) lugar.address = { "@type": "PostalAddress", ...(s.cidade ? { addressLocality: s.cidade } : {}), ...(s.uf ? { addressRegion: s.uf } : {}), addressCountry: "BR" };
    const dados: Record<string, unknown> = {
      "@context": "https://schema.org", "@type": "Event", name: evento.titulo, startDate: s.inicio, eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", location: lugar, url, organizer: { "@type": "Organization", name: organizador },
    };
    const resumo = descricaoResumida(evento.descricao, 300);
    if (resumo) dados.description = resumo;
    if (evento.imagem && /^https:\/\//.test(evento.imagem)) dados.image = [evento.imagem];
    const disponibilidade = DISPONIBILIDADE[s.estado];
    if (disponibilidade) dados.offers = { "@type": "Offer", url: s.url, priceCurrency: "BRL", availability: disponibilidade, ...(s.a_partir_de_centavos !== null ? { price: (s.a_partir_de_centavos / 100).toFixed(2) } : {}) };
    return dados;
  });
}

/** O JSON para dentro de um <script type="application/ld+json">: sem "<" (nada fecha a tag antes da hora) e sem os separadores de linha que quebram o script. */
export function jsonParaScript(dados: unknown): string {
  return JSON.stringify(dados).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

// ─── O que viaja do link da página do evento para a compra (C2b-1) ──────────

/** A busca de uma página (`searchParams` do Next ou `location.search`): um valor, uma lista deles ou nada. */
export type BuscaDaPagina = Record<string, string | string[] | undefined>;

const primeiro = (v: string | string[] | undefined): string | null => (Array.isArray(v) ? v[0] : v) ?? null;

/**
 * Os parâmetros que o link de divulgação traz e a compra precisa receber: o cupom (`?cupom=VERAO`, conferido no formato) e a origem da divulgação (`canal`, `acao` e as `utm_*`, recortados
 * como a compra os recorta). Só estes: nada mais que esteja na busca da página vai para a compra. O cupom só é CONFERIDO de verdade na compra (se existe, se vale para a sessão).
 */
export function parametrosParaACompra(busca: BuscaDaPagina): URLSearchParams {
  const saida = new URLSearchParams();
  const cupom = normalizarCodigo(primeiro(busca.cupom));
  if (codigoDoCupomValido(cupom)) saida.set("cupom", cupom);
  const entrada = new URLSearchParams();
  for (const [chave, valor] of Object.entries(busca)) { const v = primeiro(valor); if (v !== null) entrada.set(chave, v); }
  const origem = origemDaPagina(entrada.toString(), "", "");
  if (origem?.canal) saida.set("canal", origem.canal);
  if (origem?.acao) saida.set("acao", origem.acao);
  for (const [campo, valor] of Object.entries(origem?.utm ?? {})) saida.set(campo, valor);
  return saida;
}

/** O endereço da compra (`/comprar/<sessão>`) com o que veio no link da página do evento. Sem nada a levar, o próprio endereço. */
export function enderecoDaCompra(url: string, busca: BuscaDaPagina): string {
  const extra = parametrosParaACompra(busca);
  if (extra.size === 0) return url;
  try {
    const u = new URL(url);
    for (const [chave, valor] of extra) u.searchParams.set(chave, valor);
    return u.toString();
  } catch {
    return url;
  }
}

/** O cupom que a página de compra recebe na busca (`?cupom=`), no formato do banco; nulo se não veio ou não é um código. */
export function cupomDaBusca(busca: BuscaDaPagina): string | null {
  const c = normalizarCodigo(primeiro(busca.cupom));
  return codigoDoCupomValido(c) ? c : null;
}

// ─── A contagem na página do evento (C2b-1) ─────────────────────────────────

const FUSO_DA_CONTAGEM = "America/Sao_Paulo";
const diaNoFuso = (instante: number) => new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_DA_CONTAGEM, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instante));

/**
 * Quanto falta para a próxima sessão que ainda vai acontecer (não cancelada, não encerrada), contando DIAS DO CALENDÁRIO no horário de Brasília: "A próxima sessão é hoje", "...é amanhã",
 * "Faltam 5 dias para a próxima sessão". Nulo se não há sessão por vir. `agora` vem de fora (a página o lê uma vez), para o texto não depender do relógio de quem desenha.
 */
export function contagemParaOEvento(sessoes: readonly Pick<SessaoNaApi, "inicio" | "estado">[], agora: number): { dias: number; frase: string } | null {
  const hoje = Date.parse(diaNoFuso(agora));
  let menor: number | null = null;
  for (const s of sessoes) {
    if (s.estado === "cancelada" || s.estado === "encerrada") continue;
    const inicio = Date.parse(s.inicio);
    if (!Number.isFinite(inicio)) continue;
    const dias = Math.round((Date.parse(diaNoFuso(inicio)) - hoje) / 86_400_000);
    if (dias < 0) continue;
    if (menor === null || dias < menor) menor = dias;
  }
  if (menor === null) return null;
  return { dias: menor, frase: menor === 0 ? "A próxima sessão é hoje" : menor === 1 ? "A próxima sessão é amanhã" : `Faltam ${menor} dias para a próxima sessão` };
}

// ─── A Agenda por seções (a biblioteca de seções, passo 2): os dados que os cinco layouts usam ───────────

const FUSO_DA_AGENDA = "America/Sao_Paulo";
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA_CURTA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const SEMANA_LONGA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export type PartesDoDia = { ano: number; mes: number; dia: number; semana: number; hora: number; minuto: number };

/** O dia e a hora de um instante no horário de Brasília (mês de 0 a 11, semana de 0 = domingo a 6 = sábado). Nulo se o texto não é uma data. */
export function partesDoInstante(iso: string): PartesDoDia | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_DA_AGENDA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t));
  const n = (tipo: string) => Number(partes.find(p => p.type === tipo)?.value ?? 0);
  const ano = n("year"), mes = n("month") - 1, dia = n("day");
  return { ano, mes, dia, semana: new Date(Date.UTC(ano, mes, dia)).getUTCDay(), hora: n("hour"), minuto: n("minute") };
}

const chaveDoMes = (p: Pick<PartesDoDia, "ano" | "mes">) => `${p.ano}-${String(p.mes + 1).padStart(2, "0")}`;
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const horaCurta = (p: PartesDoDia) => (p.minuto === 0 ? `${p.hora}h` : `${p.hora}h${String(p.minuto).padStart(2, "0")}`);

/** "Sáb, 28 de novembro". */
export const diaPorExtensoDaAgenda = (p: PartesDoDia) => `${SEMANA_LONGA[p.semana]}, ${p.dia} de ${MESES[p.mes]}`;

/** O selo na imagem do cartão: "Esgotado" quando todas as sessões esgotaram, "Últimos ingressos" quando alguma à venda tem poucos; senão nada. */
export function seloDoItem(item: Pick<ItemDaAgenda, "estado" | "lista">): { texto: string; tom: "esgotado" | "poucos" } | null {
  if (item.estado === "esgotado") return { texto: "Esgotado", tom: "esgotado" };
  if (item.estado === "aberta" && item.lista.some(s => s.estado === "aberta" && s.poucos)) return { texto: "Últimos ingressos", tom: "poucos" };
  return null;
}

/** O botão do cartão: diz o que acontece depois. Esgotado leva à lista de espera; sem venda, só "Ver o evento". */
export function botaoDoItem(estado: EstadoDoEvento): { texto: string; forte: boolean } {
  if (estado === "aberta") return { texto: "Datas e ingressos", forte: true };
  if (estado === "esgotado") return { texto: "Lista de espera", forte: false };
  return { texto: "Ver o evento", forte: false };
}

/** O período do evento numa frase: uma data só ("Sáb, 28 de novembro"), "Em cartaz até 6 de dezembro" se a primeira sessão já começou ou é hoje, ou "28 nov a 6 dez". */
export function periodoDoItem(item: Pick<ItemDaAgenda, "lista">, agora: number): string | null {
  const dias = item.lista.map(s => partesDoInstante(s.inicio)).filter((p): p is PartesDoDia => p !== null);
  if (dias.length === 0) return null;
  const primeiro = dias[0], ultimo = dias[dias.length - 1];
  const hoje = partesDoInstante(new Date(agora).toISOString());
  const mesmoDia = primeiro.ano === ultimo.ano && primeiro.mes === ultimo.mes && primeiro.dia === ultimo.dia;
  if (mesmoDia) return diaPorExtensoDaAgenda(primeiro);
  if (hoje && Date.UTC(primeiro.ano, primeiro.mes, primeiro.dia) <= Date.UTC(hoje.ano, hoje.mes, hoje.dia)) return `Em cartaz até ${ultimo.dia} de ${MESES[ultimo.mes]}`;
  const curto = (p: PartesDoDia) => `${p.dia} ${MESES[p.mes].slice(0, 3)}`;
  return `${curto(primeiro)} a ${curto(ultimo)}`;
}

/** O menor preço à venda, por extenso ("a partir de R$ 40,00"), formatado por quem chama; aqui só o número. */
export const precoDoItem = (item: Pick<ItemDaAgenda, "estado" | "a_partir_de_centavos">): number | null => (item.estado === "aberta" ? item.a_partir_de_centavos : null);

/** Uma cor estável por espaço (o mesmo nome dá sempre a mesma cor), para o pino e a listra do cartão. */
const CORES_DOS_ESPACOS = ["#5B3FA0", "#B4402E", "#1F6F5C", "#C58A12", "#2B5CB0", "#9A3F8A"];
export function corDoEspaco(nome: string): string {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CORES_DOS_ESPACOS[h % CORES_DOS_ESPACOS.length];
}

/** Uma linha da lista por mês e do calendário: uma SESSÃO de um evento. */
export type LinhaDaAgenda = { item: ItemDaAgenda; sessao: SessaoDaAgenda; partes: PartesDoDia; dia: string; semana: string; hora: string };

/** Todas as sessões de todos os eventos, em ordem de data. */
export function linhasDaAgenda(itens: readonly ItemDaAgenda[]): LinhaDaAgenda[] {
  const linhas: LinhaDaAgenda[] = [];
  for (const item of itens) for (const sessao of item.lista) {
    const partes = partesDoInstante(sessao.inicio);
    if (partes) linhas.push({ item, sessao, partes, dia: String(partes.dia).padStart(2, "0"), semana: SEMANA_CURTA[partes.semana], hora: horaCurta(partes) });
  }
  return linhas.sort((a, b) => Date.parse(a.sessao.inicio) - Date.parse(b.sessao.inicio));
}

/** As linhas agrupadas por mês ("Novembro", "Dezembro de 2027" quando não é o ano de `ano`). */
export function agruparPorMes(linhas: readonly LinhaDaAgenda[], ano: number): { chave: string; titulo: string; linhas: LinhaDaAgenda[] }[] {
  const grupos = new Map<string, { chave: string; titulo: string; linhas: LinhaDaAgenda[] }>();
  for (const l of linhas) {
    const chave = chaveDoMes(l.partes);
    const g = grupos.get(chave) ?? { chave, titulo: maiuscula(MESES[l.partes.mes]) + (l.partes.ano === ano ? "" : ` de ${l.partes.ano}`), linhas: [] };
    g.linhas.push(l);
    grupos.set(chave, g);
  }
  return [...grupos.values()];
}

/** A grade de um mês para o calendário: quantos espaços vazios antes do dia 1 (a semana começa na segunda) e quantos dias o mês tem. */
export function gradeDoMes(ano: number, mes: number): { vazios: number; dias: number; titulo: string } {
  const primeiro = new Date(Date.UTC(ano, mes, 1)).getUTCDay();
  return { vazios: (primeiro + 6) % 7, dias: new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate(), titulo: `${maiuscula(MESES[mes])} de ${ano}` };
}

/** Os dias do mês que têm sessão, com as linhas de cada um. */
export function diasComSessao(linhas: readonly LinhaDaAgenda[], ano: number, mes: number): Map<number, LinhaDaAgenda[]> {
  const mapa = new Map<number, LinhaDaAgenda[]>();
  for (const l of linhas) if (l.partes.ano === ano && l.partes.mes === mes) mapa.set(l.partes.dia, [...(mapa.get(l.partes.dia) ?? []), l]);
  return mapa;
}

/** Os filtros da agenda, tirados dos próprios dados: os meses que têm sessão e os espaços. */
export function filtrosDaAgenda(linhas: readonly LinhaDaAgenda[], ano: number): { meses: { chave: string; titulo: string }[]; espacos: string[] } {
  return { meses: agruparPorMes(linhas, ano).map(g => ({ chave: g.chave, titulo: g.titulo })), espacos: [...new Set(linhas.map(l => l.sessao.local_nome))] };
}

/** Os eventos que passam nos filtros (mês, espaço e nome) e as sessões deles que passam: o evento fica se alguma sessão passa. */
export function filtrarAgenda(itens: readonly ItemDaAgenda[], f: { mes: string | null; espaco: string | null; busca: string }): ItemDaAgenda[] {
  const busca = f.busca.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return itens.filter(item => {
    if (busca !== "" && !item.titulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(busca)) return false;
    return item.lista.some(s => {
      const p = partesDoInstante(s.inicio);
      return p !== null && (f.mes === null || chaveDoMes(p) === f.mes) && (f.espaco === null || s.local_nome === f.espaco);
    });
  });
}

/** A chamada do destaque "próximo evento": "Próximo espetáculo · faltam 8 dias", "... · amanhã" ou "... · hoje". Sem sessão por vir, só "Próximo espetáculo". */
export function chamadaDoProximoEvento(contagem: { dias: number } | null): string {
  if (contagem === null) return "Próximo espetáculo";
  return `Próximo espetáculo · ${contagem.dias === 0 ? "hoje" : contagem.dias === 1 ? "amanhã" : `faltam ${contagem.dias} dias`}`;
}

/** Os botões do destaque "próximo evento": a primeira sessão à venda leva à compra; esgotado, à lista de espera; sem venda, à página do evento. "Ver todas as datas" só quando há mais de uma. */
export function botoesDoProximoEvento(item: Pick<ItemDaAgenda, "estado" | "lista" | "slug">): { principal: { texto: string; url: string | null }; secundario: { texto: string } | null } {
  const aberta = item.lista.find(s => s.estado === "aberta");
  const principal = item.estado === "aberta" && aberta ? { texto: "Escolher ingressos", url: aberta.url }
    : item.estado === "esgotado" && item.lista[0] ? { texto: "Entrar na lista de espera", url: item.lista[0].url }
      : { texto: "Ver o evento", url: null };
  return { principal, secundario: item.lista.length > 1 ? { texto: "Ver todas as datas" } : null };
}
