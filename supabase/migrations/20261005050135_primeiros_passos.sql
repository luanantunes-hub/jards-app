-- Cartão "Primeiros passos" da Visão geral: guarda quando a pessoa o ocultou,
-- para ele não voltar em outro aparelho. O progresso não é guardado: cada
-- passo é lido dos próprios dados da organização.

alter table public.profiles
  add column if not exists primeiros_passos_ocultos_em timestamptz;

grant update (primeiros_passos_ocultos_em) on public.profiles to authenticated;
