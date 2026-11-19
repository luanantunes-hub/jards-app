// As listas fechadas da Ticketeria: o banco confere cada uma num CHECK (supabase/migrations/*_ticketeria_lojas_site.sql).

/** `ticketeria_sites.situacao`. */
export type SituacaoDoSite = "rascunho" | "publicado";
export const SITUACOES_DO_SITE: readonly SituacaoDoSite[] = ["rascunho", "publicado"];

/** `ticketeria_site_dominios.situacao`: aguardando o DNS, conferindo, ativo ou com erro. */
export type SituacaoDoDominio = "aguardando" | "verificando" | "ativo" | "erro";
export const SITUACOES_DO_DOMINIO: readonly SituacaoDoDominio[] = ["aguardando", "verificando", "ativo", "erro"];

// Locais, eventos e sessões (T2, supabase/migrations/*_ticketeria_eventos.sql).

/** `ticketeria_eventos.situacao`: rascunho (só a equipe vê), publicado ou cancelado (não volta). */
export type SituacaoDoEvento = "rascunho" | "publicado" | "cancelado";
export const SITUACOES_DO_EVENTO: readonly SituacaoDoEvento[] = ["rascunho", "publicado", "cancelado"];

/** `ticketeria_eventos.classificacao`: a classificação indicativa. */
export type ClassificacaoIndicativa = "livre" | "10" | "12" | "14" | "16" | "18";
export const CLASSIFICACOES_INDICATIVAS: readonly ClassificacaoIndicativa[] = ["livre", "10", "12", "14", "16", "18"];
