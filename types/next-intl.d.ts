import type { Idioma } from "@/lib/i18n/idiomas";
import type ticketeria from "../messages/pt-BR/ticketeria.json";

// Deixa o editor e o tsc conferirem as chaves: t("sair.espera.pergunta") com erro de digitação não compila.
declare module "next-intl" {
  interface AppConfig {
    Locale: Idioma;
    Messages: { ticketeria: typeof ticketeria };
  }
}
