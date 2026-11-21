import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactElement } from "react";
import { NextIntlClientProvider } from "next-intl";
import type { Idioma } from "../../lib/i18n/idiomas";

// Os testes que desenham telas já traduzidas precisam do provedor de idioma em volta, como as páginas têm no layout.
// Põe os textos de messages/<idioma>/ticketeria.json (português por padrão) em volta do elemento.
export function comIdioma(elemento: ReactElement, idioma: Idioma = "pt-BR"): ReactElement {
  const arquivo = join(__dirname, "..", "..", "messages", idioma, "ticketeria.json");
  const ticketeria = JSON.parse(readFileSync(arquivo, "utf8"));
  return createElement(NextIntlClientProvider, { locale: idioma, messages: { ticketeria }, children: elemento });
}
