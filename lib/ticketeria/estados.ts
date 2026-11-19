// As listas fechadas da Ticketeria: o banco confere cada uma num CHECK (supabase/migrations/*_ticketeria_lojas_site.sql).

/** `ticketeria_sites.situacao`. */
export type SituacaoDoSite = "rascunho" | "publicado";
export const SITUACOES_DO_SITE: readonly SituacaoDoSite[] = ["rascunho", "publicado"];

/** `ticketeria_site_dominios.situacao`: aguardando o DNS, conferindo, ativo ou com erro. */
export type SituacaoDoDominio = "aguardando" | "verificando" | "ativo" | "erro";
export const SITUACOES_DO_DOMINIO: readonly SituacaoDoDominio[] = ["aguardando", "verificando", "ativo", "erro"];
