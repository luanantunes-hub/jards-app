import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { COOKIE_DO_IDIOMA, NEGOCIAR_PELO_NAVEGADOR, escolherIdioma } from "@/lib/i18n/idiomas";
import { carregarMensagens } from "@/lib/i18n/mensagens";

// Qual idioma e quais textos servem a este pedido. Só as telas que usam o provedor ou getTranslations passam por aqui:
// o resto do Jards não lê cookie nem cabeçalho por causa disto e continua como estava.
export default getRequestConfig(async () => {
  const cookie = (await cookies()).get(COOKIE_DO_IDIOMA)?.value;
  const acceptLanguage = NEGOCIAR_PELO_NAVEGADOR && !cookie ? (await headers()).get("accept-language") : null;
  const locale = escolherIdioma({ cookie, acceptLanguage, negociar: NEGOCIAR_PELO_NAVEGADOR });
  return { locale, messages: await carregarMensagens(locale) };
});
