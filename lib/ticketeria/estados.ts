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

// O catálogo (T3, supabase/migrations/*_ticketeria_catalogo.sql).

/** `ticketeria_ingressos.categoria`. Gratuito e cortesia custam zero; as outras, mais que zero (o banco confere). */
export type CategoriaDoIngresso = "inteira" | "meia" | "social" | "gratuito" | "cortesia" | "outra";
export const CATEGORIAS_DO_INGRESSO: readonly CategoriaDoIngresso[] = ["inteira", "meia", "social", "gratuito", "cortesia", "outra"];

// O núcleo de pagamento (T4, supabase/migrations/*_ticketeria_pagamentos.sql).

/** `ticketeria_taxas.quem_paga` e `ticketeria_pedidos.quem_paga_taxa`: o comprador (por cima do preço) ou o produtor (descontada). */
export type QuemPagaATaxa = "comprador" | "produtor";
export const QUEM_PAGA_A_TAXA: readonly QuemPagaATaxa[] = ["comprador", "produtor"];

/** `ticketeria_pedidos.situacao`. A reserva vencida segue "aguardando_pagamento" com `reservado_ate` no passado. */
export type SituacaoDoPedido = "aguardando_pagamento" | "pago" | "cancelado";
export const SITUACOES_DO_PEDIDO: readonly SituacaoDoPedido[] = ["aguardando_pagamento", "pago", "cancelado"];

/** `ticketeria_transacoes.tipo`. */
export type TipoDeTransacao = "pagamento" | "estorno" | "repasse" | "ajuste";
export const TIPOS_DE_TRANSACAO: readonly TipoDeTransacao[] = ["pagamento", "estorno", "repasse", "ajuste"];

/** `ticketeria_partidas.conta`: o que o provedor recebeu (positivo), o que é do produtor e o que é do Jards (negativos). */
export type ContaDoRazao = "psp_a_receber" | "produtor" | "plataforma";
export const CONTAS_DO_RAZAO: readonly ContaDoRazao[] = ["psp_a_receber", "produtor", "plataforma"];
