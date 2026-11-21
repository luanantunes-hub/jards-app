// Os idiomas do Jards (módulo Ingressos primeiro) e a regra de qual usar. Sem dependências do Next: dá para testar de fora.
// A ordem é a de prioridade do dono (20/11/2026); o português do Brasil é o idioma de origem de todos os textos.

export const IDIOMAS = [
  { codigo: "en", nome: "English", dir: "ltr" },
  { codigo: "zh-Hans", nome: "简体中文", dir: "ltr" },
  { codigo: "es-419", nome: "Español", dir: "ltr" },
  { codigo: "de", nome: "Deutsch", dir: "ltr" },
  { codigo: "ar", nome: "العربية", dir: "rtl" },
  { codigo: "ja", nome: "日本語", dir: "ltr" },
  { codigo: "ru", nome: "Русский", dir: "ltr" },
  { codigo: "id", nome: "Bahasa Indonesia", dir: "ltr" },
  { codigo: "pt-BR", nome: "Português", dir: "ltr" },
  { codigo: "fr", nome: "Français", dir: "ltr" },
] as const;

export type Idioma = (typeof IDIOMAS)[number]["codigo"];

/** O idioma de origem: todo texto nasce nele e ele cobre o que faltar em outro idioma. */
export const IDIOMA_PADRAO: Idioma = "pt-BR";

/** O cookie com o idioma escolhido (preferência da pessoa, sem dado pessoal). */
export const COOKIE_DO_IDIOMA = "jards_idioma";

/**
 * Usar o idioma do navegador quando a pessoa ainda não escolheu. Fica desligado enquanto só algumas telas existem
 * traduzidas: quem abre o link de um e-mail em português com o navegador em inglês não deve cair numa tela solta em inglês.
 * Liga junto com a tradução da compra, quando o idioma da pessoa passa a ser gravado no pedido.
 */
export const NEGOCIAR_PELO_NAVEGADOR = false;

export function ehIdioma(valor: unknown): valor is Idioma {
  return typeof valor === "string" && IDIOMAS.some(i => i.codigo === valor);
}

export function direcaoDoIdioma(idioma: Idioma): "ltr" | "rtl" {
  return IDIOMAS.find(i => i.codigo === idioma)?.dir ?? "ltr";
}

// Como cada língua do navegador cai num dos idiomas daqui. "zh-TW" e "zh-Hant" (chinês tradicional) não entram: só o simplificado existe.
const POR_LINGUA: Record<string, Idioma> = { en: "en", zh: "zh-Hans", es: "es-419", de: "de", ar: "ar", ja: "ja", ru: "ru", id: "id", in: "id", pt: "pt-BR", fr: "fr" };

/** O primeiro idioma suportado do cabeçalho Accept-Language ("pt-BR,pt;q=0.9,en;q=0.8"), na ordem de preferência da pessoa. */
export function idiomaDoNavegador(acceptLanguage: string | null | undefined): Idioma | null {
  if (!acceptLanguage) return null;
  const preferidos = acceptLanguage
    .split(",")
    .map((parte, posicao) => {
      const [tag, ...parametros] = parte.trim().split(";");
      const q = parametros.map(p => p.trim()).find(p => p.startsWith("q="));
      const peso = q ? Number(q.slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), peso: Number.isFinite(peso) ? peso : 0, posicao };
    })
    .filter(p => p.tag && p.peso > 0)
    .sort((a, b) => b.peso - a.peso || a.posicao - b.posicao);
  for (const { tag } of preferidos) {
    const exato = IDIOMAS.find(i => i.codigo.toLowerCase() === tag);
    if (exato) return exato.codigo;
    const [lingua, regiao] = tag.split("-");
    if (lingua === "zh" && regiao && ["tw", "hk", "mo", "hant"].includes(regiao)) continue;
    const idioma = POR_LINGUA[lingua];
    if (idioma) return idioma;
  }
  return null;
}

/** A escolha da pessoa (cookie) vale primeiro; depois, se ligado, o navegador; no fim, o português. */
export function escolherIdioma(entrada: { cookie?: string | null; acceptLanguage?: string | null; negociar?: boolean }): Idioma {
  if (ehIdioma(entrada.cookie)) return entrada.cookie;
  if (entrada.negociar) return idiomaDoNavegador(entrada.acceptLanguage) ?? IDIOMA_PADRAO;
  return IDIOMA_PADRAO;
}
