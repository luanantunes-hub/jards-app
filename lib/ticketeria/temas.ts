// Os temas do site da loja (construtor, passo 2; desenho aprovado pelo dono em 20/11/2026): cinco jeitos prontos de o site inteiro parecer (fundo, fonte, cantos e botões). A cor que o produtor
// escolhe segue sendo a cor de destaque (cabeçalho e, em alguns temas, botões). Só dados e contas, sem tela e sem servidor (roda no navegador e nos testes). Fontes do próprio aparelho (nada é
// carregado de fora): rápido e sem rastro, com a pequena variação de uma serifa de um aparelho para outro.

import { TEMAS_DO_SITE, type TemaDoSite } from "@/lib/ticketeria/estados";
import { corDoTema } from "@/lib/ticketeria/site";

export type DefinicaoDoTema = {
  id: TemaDoSite; nome: string; descricao: string;
  fundo: string; texto: string; borda: string;
  /** O arredondamento dos cantos de cartões, botões e imagens. */
  raio: string;
  /** A fonte do texto e a dos títulos. */
  fonte: string; fonteDosTitulos: string;
  /** "grafite": o botão é sempre o grafite do Jards (claro, no tema escuro); "acento": o botão usa a cor de destaque do site. */
  botao: "grafite" | "acento";
};

const SANS = "var(--font-site-sans, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif)";
const SERIFA = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif";

export const TEMAS: Record<TemaDoSite, DefinicaoDoTema> = {
  classico: { id: "classico", nome: "Clássico", descricao: "Limpo e neutro. Fundo branco, cantos médios.", fundo: "#ffffff", texto: "#282525", borda: "rgba(0,0,0,.10)", raio: "0.75rem", fonte: SANS, fonteDosTitulos: SANS, botao: "grafite" },
  editorial: { id: "editorial", nome: "Editorial", descricao: "Títulos em serifa, fundo creme, cantos retos. Bom para teatro e música.", fundo: "#FBF8F3", texto: "#282525", borda: "rgba(40,37,37,.16)", raio: "0.125rem", fonte: SANS, fonteDosTitulos: SERIFA, botao: "grafite" },
  moderno: { id: "moderno", nome: "Moderno", descricao: "Títulos fortes, cantos bem arredondados, botões na cor de destaque.", fundo: "#ffffff", texto: "#1b1b1f", borda: "rgba(0,0,0,.10)", raio: "1.25rem", fonte: SANS, fonteDosTitulos: SANS, botao: "acento" },
  noite: { id: "noite", nome: "Noite", descricao: "Fundo escuro e texto claro. Bom para shows e baladas.", fundo: "#14121A", texto: "#F2F0F5", borda: "rgba(255,255,255,.16)", raio: "0.75rem", fonte: SANS, fonteDosTitulos: SANS, botao: "acento" },
  calor: { id: "calor", nome: "Calor", descricao: "Fundo quente, serifa suave. Bom para festivais e feiras.", fundo: "#FFF6EC", texto: "#3A2A1C", borda: "rgba(58,42,28,.18)", raio: "0.75rem", fonte: SANS, fonteDosTitulos: SERIFA, botao: "acento" },
};

/** O tema do site: o nome guardado, ou o clássico se vier algo que não existe. */
export function temaDoSite(valor: unknown): DefinicaoDoTema {
  return typeof valor === "string" && (TEMAS_DO_SITE as readonly string[]).includes(valor) ? TEMAS[valor as TemaDoSite] : TEMAS.classico;
}

const canal = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminancia = (cor: string) => { const n = parseInt(cor.slice(1), 16); return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255); };

/** A razão de contraste entre duas cores "#RRGGBB" (de 1 a 21). */
export function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

/** O texto do botão: branco ou grafite, o que contrasta MAIS com o fundo do botão (a regra do cabeçalho, por luminância, deixa cores médias no lado mais fraco). */
export function textoDoBotao(fundo: string): "#ffffff" | "#282525" {
  return contraste(fundo, "#ffffff") >= contraste(fundo, "#282525") ? "#ffffff" : "#282525";
}

/** O botão do site: cor e texto. Tema "acento" usa a cor de destaque, mas se ela quase some no fundo do tema (contraste abaixo de 3), cai no botão do texto do tema, que sempre lê. */
export function botaoDoTema(tema: DefinicaoDoTema, cor: string): { fundo: string; texto: string } {
  const destaque = corDoTema(cor);
  if (tema.botao === "acento" && contraste(destaque, tema.fundo) >= 3) return { fundo: destaque, texto: textoDoBotao(destaque) };
  if (tema.id === "noite") return { fundo: tema.texto, texto: tema.fundo };
  if (tema.botao === "acento") return { fundo: tema.texto, texto: tema.fundo };
  return { fundo: "#282525", texto: "#ffffff" };
}

/** As variáveis de CSS que o site usa (SiteView aplica na raiz e todo bloco lê delas). */
export function variaveisDoTema(valor: unknown, cor: string): Record<string, string> {
  const tema = temaDoSite(valor);
  const botao = botaoDoTema(tema, cor);
  return {
    "--site-fundo": tema.fundo, "--site-texto": tema.texto, "--site-borda": tema.borda, "--site-raio": tema.raio,
    "--site-fonte": tema.fonte, "--site-fonte-titulos": tema.fonteDosTitulos, "--site-botao": botao.fundo, "--site-botao-texto": botao.texto,
  };
}
