import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { direcaoDoIdioma, type Idioma } from "@/lib/i18n/idiomas";
import { CLASSE_FONTES_DE_IDIOMA } from "@/lib/i18n/fontes";

// Põe o idioma e os textos à disposição de tudo o que está dentro (telas de servidor e de cliente) e marca a região com `lang` e `dir`
// (o árabe vai da direita para a esquerda). Fica no layout da área traduzida, não na raiz: o resto do Jards continua em pt-BR e não lê cookie.
// `contents` não cria caixa: o desenho de dentro fica onde estava; só a língua, a direção e as fontes são herdadas.
export async function ProvedorDeIdioma({ children }: { children: ReactNode }) {
  const idioma = (await getLocale()) as Idioma;
  const mensagens = await getMessages();
  return (
    <NextIntlClientProvider locale={idioma} messages={mensagens}>
      <div lang={idioma} dir={direcaoDoIdioma(idioma)} className={`${CLASSE_FONTES_DE_IDIOMA} contents`}>
        {children}
      </div>
    </NextIntlClientProvider>
  );
}
