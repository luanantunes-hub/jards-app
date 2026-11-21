// O menu e o rodapé do site da loja, escolhidos para o site inteiro (a biblioteca de seções, passo 4; layouts aprovados pelo dono em 20/11/2026). Ficam na coluna `aparencia` do site
// (JSON), lida aqui com tolerância (o que está torto vira o padrão) e conferida com rigor na hora de salvar. Só dados e regras: sem banco, sem tela e sem servidor.

import { lerUrlHttps } from "@/lib/ticketeria/site";

/** Os menus do alto. O "transparente sobre o destaque" fica para quando o destaque puder sangrar até a borda da página. */
export const LAYOUTS_DO_MENU = ["classico", "duas_camadas", "minimo", "centralizado"] as const;
export type LayoutDoMenu = (typeof LAYOUTS_DO_MENU)[number];
export const LAYOUT_PADRAO_DO_MENU: LayoutDoMenu = "classico";
export const ROTULO_DO_LAYOUT_DO_MENU: Record<LayoutDoMenu, { nome: string; frase: string }> = {
  classico: { nome: "Clássico com compra", frase: "Nome, links e um botão de ingressos sempre à vista." },
  duas_camadas: { nome: "Duas camadas", frase: "Faixa fina para imprensa, contato e afins, e o menu abaixo." },
  minimo: { nome: "Mínimo", frase: "Nome, uma ação e o resto atrás do botão Menu." },
  centralizado: { nome: "Centralizado", frase: "Nome no meio e os links embaixo. Para poucas páginas." },
};

export const LAYOUTS_DO_RODAPE = ["simples", "colunas", "newsletter"] as const;
export type LayoutDoRodape = (typeof LAYOUTS_DO_RODAPE)[number];
export const LAYOUT_PADRAO_DO_RODAPE: LayoutDoRodape = "simples";
export const ROTULO_DO_LAYOUT_DO_RODAPE: Record<LayoutDoRodape, { nome: string; frase: string }> = {
  simples: { nome: "Simples", frase: "Nome, contato, redes e políticas, numa linha." },
  colunas: { nome: "Em colunas", frase: "Até três colunas de links, endereço e horário." },
  newsletter: { nome: "Com newsletter", frase: "Colunas e um convite para receber a programação." },
};

export type LinkDoSite = { rotulo: string; url: string };
export type ColunaDoRodape = { titulo: string; links: LinkDoSite[] };
export type CabecalhoDoSite = { layout: LayoutDoMenu; botao_rotulo: string; botao_url: string; faixa: LinkDoSite[] };
export type RodapeDoSite = {
  layout: LayoutDoRodape; nome: string; contato: string; endereco: string; horario: string;
  redes: LinkDoSite[]; politicas: LinkDoSite[]; colunas: ColunaDoRodape[];
  chamada: string; texto: string; botao_rotulo: string; botao_url: string;
};
export type AparenciaDoSite = { cabecalho: CabecalhoDoSite; rodape: RodapeDoSite };

export const MAX_LINKS_DA_FAIXA = 4;
export const MAX_REDES = 6;
export const MAX_POLITICAS = 4;
export const MAX_COLUNAS = 3;
export const MAX_LINKS_POR_COLUNA = 5;

/** O que o site tem quando nada foi escolhido: o menu clássico, com o botão "Ingressos" (que leva ao primeiro evento publicado) e o rodapé simples. */
export const APARENCIA_PADRAO: AparenciaDoSite = {
  cabecalho: { layout: LAYOUT_PADRAO_DO_MENU, botao_rotulo: "Ingressos", botao_url: "", faixa: [] },
  rodape: { layout: LAYOUT_PADRAO_DO_RODAPE, nome: "", contato: "", endereco: "", horario: "", redes: [], politicas: [], colunas: [], chamada: "", texto: "", botao_rotulo: "", botao_url: "" },
};

const texto = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

// ─── Leitura com tolerância (o que vem do banco) ────────────────────────────

function linksTolerantes(v: unknown, max: number): LinkDoSite[] {
  if (!Array.isArray(v)) return [];
  const saida: LinkDoSite[] = [];
  for (const bruto of v) {
    const x = objeto(bruto);
    const rotulo = texto(x.rotulo, 40);
    const u = lerUrlHttps(x.url);
    if (rotulo !== "" && u.ok) saida.push({ rotulo, url: u.url });
    if (saida.length >= max) break;
  }
  return saida;
}

/** A aparência guardada no banco; coluna vazia ou torta vira o padrão, campo a campo. */
export function lerAparencia(json: unknown): AparenciaDoSite {
  const a = objeto(json), c = objeto(a.cabecalho), r = objeto(a.rodape);
  const layoutC = (LAYOUTS_DO_MENU as readonly string[]).includes(String(c.layout)) ? (c.layout as LayoutDoMenu) : LAYOUT_PADRAO_DO_MENU;
  const layoutR = (LAYOUTS_DO_RODAPE as readonly string[]).includes(String(r.layout)) ? (r.layout as LayoutDoRodape) : LAYOUT_PADRAO_DO_RODAPE;
  const urlC = lerUrlHttps(c.botao_url), urlR = lerUrlHttps(r.botao_url);
  const temBotaoC = c.botao_rotulo !== undefined || c.botao_url !== undefined;
  return {
    cabecalho: {
      layout: layoutC,
      botao_rotulo: temBotaoC ? texto(c.botao_rotulo, 30) : APARENCIA_PADRAO.cabecalho.botao_rotulo,
      botao_url: urlC.ok ? urlC.url : "",
      faixa: linksTolerantes(c.faixa, MAX_LINKS_DA_FAIXA),
    },
    rodape: {
      layout: layoutR, nome: texto(r.nome, 80), contato: texto(r.contato, 160), endereco: texto(r.endereco, 200), horario: texto(r.horario, 120),
      redes: linksTolerantes(r.redes, MAX_REDES), politicas: linksTolerantes(r.politicas, MAX_POLITICAS),
      colunas: (Array.isArray(r.colunas) ? r.colunas : []).slice(0, MAX_COLUNAS).map(col => { const x = objeto(col); return { titulo: texto(x.titulo, 40), links: linksTolerantes(x.links, MAX_LINKS_POR_COLUNA) }; }).filter(col => col.titulo !== "" && col.links.length > 0),
      chamada: texto(r.chamada, 80), texto: texto(r.texto, 200), botao_rotulo: texto(r.botao_rotulo, 30), botao_url: urlR.ok ? urlR.url : "",
    },
  };
}

// ─── Leitura rigorosa (o que o editor manda ao salvar) ──────────────────────

type Leitura<T> = { ok: true; valor: T } | { ok: false; erro: string };

function linksRigorosos(v: unknown, max: number, nome: string): Leitura<LinkDoSite[]> {
  const lista = Array.isArray(v) ? v : [];
  const saida: LinkDoSite[] = [];
  for (const [n, bruto] of lista.entries()) {
    const x = objeto(bruto);
    const rotulo = typeof x.rotulo === "string" ? x.rotulo.trim() : "", url = typeof x.url === "string" ? x.url.trim() : "";
    if (rotulo === "" && url === "") continue;
    if (rotulo === "" || url === "") return { ok: false, erro: `${nome} ${n + 1}: o texto e o endereço vêm juntos.` };
    if (rotulo.length > 40) return { ok: false, erro: `${nome} ${n + 1}: o texto pode ter até 40 letras.` };
    const u = lerUrlHttps(url);
    if (!u.ok) return { ok: false, erro: `${nome} ${n + 1}: o endereço tem de começar com https://.` };
    saida.push({ rotulo, url: u.url });
  }
  if (saida.length > max) return { ok: false, erro: `${nome}: no máximo ${max}.` };
  return { ok: true, valor: saida };
}

function botaoRigoroso(rotulo: unknown, url: unknown, nome: string, urlVazioValeu: boolean): Leitura<{ rotulo: string; url: string }> {
  const r = typeof rotulo === "string" ? rotulo.trim() : "", u = typeof url === "string" ? url.trim() : "";
  if (r.length > 30) return { ok: false, erro: `O texto do ${nome} pode ter até 30 letras.` };
  if (u === "") return r === "" || urlVazioValeu ? { ok: true, valor: { rotulo: r, url: "" } } : { ok: false, erro: `O ${nome} precisa do texto e do endereço juntos.` };
  if (r === "") return { ok: false, erro: `O ${nome} precisa do texto e do endereço juntos.` };
  const l = lerUrlHttps(u);
  return l.ok ? { ok: true, valor: { rotulo: r, url: l.url } } : { ok: false, erro: `O endereço do ${nome} tem de começar com https://.` };
}

/** O menu que o editor manda: o layout, o botão de ingressos (o endereço pode ficar vazio: leva ao primeiro evento publicado) e a faixa fina. */
export function lerCabecalhoParaSalvar(e: unknown): Leitura<CabecalhoDoSite> {
  const x = objeto(e);
  if (!(LAYOUTS_DO_MENU as readonly string[]).includes(String(x.layout))) return { ok: false, erro: "Escolha um dos menus." };
  const botao = botaoRigoroso(x.botao_rotulo, x.botao_url, "botão de ingressos", true);
  if (!botao.ok) return botao;
  const faixa = linksRigorosos(x.faixa, MAX_LINKS_DA_FAIXA, "Link da faixa");
  if (!faixa.ok) return faixa;
  return { ok: true, valor: { layout: x.layout as LayoutDoMenu, botao_rotulo: botao.valor.rotulo, botao_url: botao.valor.url, faixa: x.layout === "duas_camadas" ? faixa.valor : [] } };
}

/** O rodapé que o editor manda. */
export function lerRodapeParaSalvar(e: unknown): Leitura<RodapeDoSite> {
  const x = objeto(e);
  if (!(LAYOUTS_DO_RODAPE as readonly string[]).includes(String(x.layout))) return { ok: false, erro: "Escolha um dos rodapés." };
  const limite = (campo: string, max: number, nome: string): Leitura<string> => { const v = typeof x[campo] === "string" ? (x[campo] as string).trim() : ""; return v.length > max ? { ok: false, erro: `${nome} pode ter até ${max} letras.` } : { ok: true, valor: v }; };
  const nome = limite("nome", 80, "O nome"), contato = limite("contato", 160, "O contato"), endereco = limite("endereco", 200, "O endereço"), horario = limite("horario", 120, "O horário"), chamada = limite("chamada", 80, "A chamada"), corpo = limite("texto", 200, "O texto");
  for (const l of [nome, contato, endereco, horario, chamada, corpo]) if (!l.ok) return l;
  const redes = linksRigorosos(x.redes, MAX_REDES, "Rede");
  if (!redes.ok) return redes;
  const politicas = linksRigorosos(x.politicas, MAX_POLITICAS, "Política");
  if (!politicas.ok) return politicas;
  const botao = botaoRigoroso(x.botao_rotulo, x.botao_url, "botão da newsletter", false);
  if (!botao.ok) return botao;
  const colunas: ColunaDoRodape[] = [];
  const listaDeColunas = Array.isArray(x.colunas) ? x.colunas : [];
  if (listaDeColunas.length > MAX_COLUNAS) return { ok: false, erro: `No máximo ${MAX_COLUNAS} colunas.` };
  for (const [n, bruto] of listaDeColunas.entries()) {
    const c = objeto(bruto);
    const titulo = typeof c.titulo === "string" ? c.titulo.trim() : "";
    const links = linksRigorosos(c.links, MAX_LINKS_POR_COLUNA, `Coluna ${n + 1}, link`);
    if (!links.ok) return links;
    if (titulo === "" && links.valor.length === 0) continue;
    if (titulo === "" || links.valor.length === 0) return { ok: false, erro: `Coluna ${n + 1}: o título e ao menos um link vêm juntos.` };
    if (titulo.length > 40) return { ok: false, erro: `Coluna ${n + 1}: o título pode ter até 40 letras.` };
    colunas.push({ titulo, links: links.valor });
  }
  const layout = x.layout as LayoutDoRodape;
  return { ok: true, valor: { layout, nome: nome.ok ? nome.valor : "", contato: contato.ok ? contato.valor : "", endereco: endereco.ok ? endereco.valor : "", horario: horario.ok ? horario.valor : "", redes: redes.valor, politicas: politicas.valor, colunas: layout === "simples" ? [] : colunas, chamada: layout === "newsletter" && chamada.ok ? chamada.valor : "", texto: layout === "newsletter" && corpo.ok ? corpo.valor : "", botao_rotulo: layout === "newsletter" ? botao.valor.rotulo : "", botao_url: layout === "newsletter" ? botao.valor.url : "" } };
}

/** O endereço do botão do menu: o escolhido, ou o da página do primeiro evento publicado, ou nenhum (o botão some). */
export function destinoDoBotaoDoMenu(cabecalho: Pick<CabecalhoDoSite, "botao_rotulo" | "botao_url">, caminhoDoPrimeiroEvento: string | null): { rotulo: string; url: string; externo: boolean } | null {
  if (cabecalho.botao_rotulo === "") return null;
  if (cabecalho.botao_url !== "") return { rotulo: cabecalho.botao_rotulo, url: cabecalho.botao_url, externo: true };
  return caminhoDoPrimeiroEvento ? { rotulo: cabecalho.botao_rotulo, url: caminhoDoPrimeiroEvento, externo: false } : null;
}
